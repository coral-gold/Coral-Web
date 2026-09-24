'use strict';
const fs   = require('fs');
const path = require('path');

// Storage abstraction for uploaded images (product photos, logo, banners).
//
// Why this exists: images saved to a folder inside the deployed app directory
// get wiped whenever the app is redeployed (git pull / fresh checkout), which
// is what caused image links to go invalid after every code push. This module
// makes it possible to store images in S3-compatible object storage instead —
// completely outside the app's filesystem, so a redeploy can never touch them.
//
// Mode selection: S3 mode activates automatically when S3_BUCKET,
// S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are all set. Otherwise falls back
// to local disk at UPLOAD_DIR (unchanged behavior — set UPLOAD_DIR to a path
// outside the repo for it to survive redeploys too, the simpler of the two
// options this batch asked for).
//
// Backward compatibility: every key this module hands out is tagged with the
// backend that stored it (e.g. "s3:1700-foo.jpg" vs a legacy bare filename
// "1700-foo.jpg" from before this module existed). An untagged legacy key is
// always resolved against local disk, regardless of which mode is active now
// — so switching a live site from local to S3 never breaks previously
// uploaded images; only new uploads move to the new backend.

const DEFAULT_UPLOAD_DIR = path.join(__dirname, '../../assets/uploads');
let LOCAL_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : DEFAULT_UPLOAD_DIR;

try {
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.accessSync(LOCAL_DIR, fs.constants.W_OK);
} catch (e) {
    console.error(`[Storage] UPLOAD_DIR "${LOCAL_DIR}" is not usable (${e.message}). Falling back to ${DEFAULT_UPLOAD_DIR}.`);
    LOCAL_DIR = DEFAULT_UPLOAD_DIR;
    try { if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true }); }
    catch (e2) { console.error('[Storage] Fallback upload dir also failed:', e2.message); }
}

const S3_BUCKET     = process.env.S3_BUCKET;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_ENABLED    = !!(S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY);

let s3Client = null;
let s3PublicUrlBase = null;
if (S3_ENABLED) {
    const { S3Client } = require('@aws-sdk/client-s3');
    const endpoint = process.env.S3_ENDPOINT || undefined; // omit for real AWS S3
    s3Client = new S3Client({
        region:   process.env.S3_REGION || 'auto',
        endpoint,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || !!endpoint,
        credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    });
    s3PublicUrlBase = (process.env.S3_PUBLIC_URL_BASE || (endpoint ? `${endpoint.replace(/\/$/, '')}/${S3_BUCKET}` : `https://${S3_BUCKET}.s3.amazonaws.com`))
        .replace(/\/$/, '');
}

const MODE = S3_ENABLED ? 's3' : 'local';

// Local disk being inside the repo/app directory is exactly the condition
// that wipes images on redeploy — surface it loudly at startup.
if (MODE === 'local' && !process.env.UPLOAD_DIR) {
    console.warn(
        '[Storage] Using local disk at', LOCAL_DIR, '(inside the app directory).',
        'This folder can be wiped by a redeploy. Set UPLOAD_DIR to a path outside the app,',
        'or configure S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY for object storage instead.'
    );
} else {
    console.log(`[Storage] Mode: ${MODE}` + (MODE === 's3' ? ` (bucket: ${S3_BUCKET})` : ` (${LOCAL_DIR})`));
}

function isTagged(key) {
    return typeof key === 'string' && /^(local|s3):/.test(key);
}
function untag(key) {
    return isTagged(key) ? key.slice(key.indexOf(':') + 1) : key;
}
function backendOf(key) {
    if (!isTagged(key)) return 'local'; // legacy bare filename — always local disk
    return key.slice(0, key.indexOf(':'));
}

async function saveLocal(buffer, filename) {
    fs.writeFileSync(path.join(LOCAL_DIR, filename), buffer);
    return `local:${filename}`;
}

async function saveS3(buffer, filename, contentType) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: filename, Body: buffer, ContentType: contentType || 'image/jpeg',
    }));
    return `s3:${filename}`;
}

// Saves already-processed image bytes to whichever backend is active.
// Returns the opaque key to store in the DB (image_path).
async function save(buffer, filename, contentType) {
    return MODE === 's3' ? saveS3(buffer, filename, contentType) : saveLocal(buffer, filename);
}

async function del(key) {
    if (!key) return;
    const backend = backendOf(key);
    const bare = untag(key);
    try {
        if (backend === 's3') {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: bare }));
        } else {
            const p = path.join(LOCAL_DIR, path.basename(bare));
            await fs.promises.unlink(p).catch(() => {});
        }
    } catch (e) {
        console.error('[Storage] delete failed for', key, e.message);
    }
}

// Fetches raw bytes — used by PDF generation, which needs to embed the image.
async function getBuffer(key) {
    if (!key) return null;
    const backend = backendOf(key);
    const bare = untag(key);
    try {
        if (backend === 's3') {
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: bare }));
            const chunks = [];
            for await (const chunk of res.Body) chunks.push(chunk);
            return Buffer.concat(chunks);
        }
        const p = path.join(LOCAL_DIR, path.basename(bare));
        return fs.existsSync(p) ? fs.readFileSync(p) : null;
    } catch (e) {
        console.error('[Storage] getBuffer failed for', key, e.message);
        return null;
    }
}

// Public URL for use in API responses / <img> tags.
function getPublicUrl(key) {
    if (!key) return null;
    const backend = backendOf(key);
    const bare = untag(key);
    if (backend === 's3') return `${s3PublicUrlBase}/${bare}`;
    return '/uploads/' + path.basename(bare);
}

// Lists every stored image — used by the Media Library.
async function list() {
    if (MODE === 's3') {
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const out = [];
        let ContinuationToken;
        do {
            const res = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken }));
            for (const obj of res.Contents || []) {
                if (!/\.(jpe?g|png|gif|webp|svg)$/i.test(obj.Key)) continue;
                out.push({
                    key: `s3:${obj.Key}`, filename: obj.Key,
                    url: getPublicUrl(`s3:${obj.Key}`),
                    size: obj.Size, mtime: obj.LastModified ? obj.LastModified.getTime() : 0,
                });
            }
            ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (ContinuationToken);
        return out;
    }
    const IMAGE_RE = /\.(jpe?g|png|gif|webp|svg)$/i;
    return fs.readdirSync(LOCAL_DIR)
        .filter(f => IMAGE_RE.test(f) && f !== '.gitkeep')
        .map(f => {
            const stat = fs.statSync(path.join(LOCAL_DIR, f));
            return { key: `local:${f}`, filename: f, url: getPublicUrl(`local:${f}`), size: stat.size, mtime: stat.mtimeMs };
        });
}

module.exports = {
    mode: MODE,
    localDir: LOCAL_DIR,
    save, delete: del, getBuffer, getPublicUrl, list,
};
