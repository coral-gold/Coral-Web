'use strict';
const fs   = require('fs');
const path = require('path');

// Storage abstraction for uploaded images (product photos, logo, banners).
//
// Why this exists: images saved to a folder inside the deployed app directory
// get wiped whenever the app is redeployed, which is what caused image links
// to go invalid after every code push. This module writes images to a fixed
// persistent folder instead (or S3-compatible object storage), and — as of
// this batch — stores the final permanent public URL directly in the DB
// (e.g. "https://coralgold.in/images/1700-foo.jpg"), exactly as requested,
// rather than an opaque key that needs server-side resolution.
//
// Mode selection, in priority order:
//   1. S3-compatible object storage — set S3_BUCKET, S3_ACCESS_KEY_ID and
//      S3_SECRET_ACCESS_KEY. Most robust: images live entirely outside the
//      app/server.
//   2. Local disk at a fixed persistent folder — set IMAGES_DIR (absolute
//      path on the server, e.g. public_html/Images) and IMAGES_PUBLIC_URL
//      (e.g. https://coralgold.in/images). New uploads are written there and
//      the DB stores the resulting https://…/images/<filename> URL directly.
//   3. Local disk fallback (UPLOAD_DIR, or assets/uploads inside the app) —
//      unchanged from earlier batches, for anyone who hasn't set IMAGES_DIR
//      yet. Stored as an opaque "local:<filename>" key instead of a full URL
//      since there's no known public URL base to build one from.
//
// Backward compatibility: getPublicUrl/getBuffer/delete accept ANY of the
// following forms found in the DB, from any point in this app's history:
//   - a full "http(s)://…" URL (this batch, or S3 from Batch 12 once S3 also
//     started storing full URLs) — used directly, no resolution needed
//   - a tagged opaque key "local:x.jpg" / "s3:x.jpg" (Batch 12)
//   - a bare legacy filename "x.jpg" (Batch 10 and earlier)
// A row written under an older scheme keeps working forever, regardless of
// which mode is active now — switching modes only changes where NEW uploads
// go.

const DEFAULT_UPLOAD_DIR = path.join(__dirname, '../../assets/uploads');
let LOCAL_DIR = process.env.IMAGES_DIR
    ? path.resolve(process.env.IMAGES_DIR)
    : process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : DEFAULT_UPLOAD_DIR;

try {
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.accessSync(LOCAL_DIR, fs.constants.W_OK);
} catch (e) {
    console.error(`[Storage] Images directory "${LOCAL_DIR}" is not usable (${e.message}). Falling back to ${DEFAULT_UPLOAD_DIR}.`);
    LOCAL_DIR = DEFAULT_UPLOAD_DIR;
    try { if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true }); }
    catch (e2) { console.error('[Storage] Fallback upload dir also failed:', e2.message); }
}

// e.g. https://coralgold.in/images — when set, new local uploads store the
// full permanent URL directly in the DB instead of an opaque "local:" key.
const LOCAL_PUBLIC_URL_BASE = (process.env.IMAGES_PUBLIC_URL || '').replace(/\/$/, '') || null;

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

if (MODE === 's3') {
    console.log(`[Storage] Mode: s3 (bucket: ${S3_BUCKET}, public URL base: ${s3PublicUrlBase})`);
} else if (LOCAL_PUBLIC_URL_BASE) {
    console.log(`[Storage] Mode: local, persistent folder ${LOCAL_DIR} — public URL base ${LOCAL_PUBLIC_URL_BASE}`);
} else {
    // Local disk with no known public URL base is exactly the "inside the
    // app directory, gets wiped on redeploy" risk condition — surface it.
    console.warn(
        '[Storage] Using local disk at', LOCAL_DIR, 'with no IMAGES_PUBLIC_URL set.',
        process.env.IMAGES_DIR || process.env.UPLOAD_DIR
            ? 'Set IMAGES_PUBLIC_URL (e.g. https://coralgold.in/images) so uploads store a permanent URL.'
            : 'This folder is inside the app directory and can be wiped by a redeploy. Set IMAGES_DIR to a persistent path and IMAGES_PUBLIC_URL to its public URL, or configure S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY for object storage instead.'
    );
}

function isUrl(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v);
}
function isTagged(v) {
    return typeof v === 'string' && /^(local|s3):/.test(v);
}
function filenameOf(v) {
    if (isUrl(v)) return decodeURIComponent(v.split('/').pop());
    if (isTagged(v)) return v.slice(v.indexOf(':') + 1);
    return v; // bare legacy filename
}
// Which backend a stored value belongs to — for a full URL, matched against
// the currently-configured public URL bases; for a tagged/legacy value,
// read straight from the tag (or assumed local, per Batch 12's rule).
function backendOf(v) {
    if (isUrl(v)) {
        if (s3PublicUrlBase && v.startsWith(s3PublicUrlBase + '/')) return 's3';
        return 'local'; // our own IMAGES_PUBLIC_URL, or an unrecognized external URL
    }
    if (isTagged(v)) return v.slice(0, v.indexOf(':'));
    return 'local';
}

async function saveLocal(buffer, filename) {
    fs.writeFileSync(path.join(LOCAL_DIR, filename), buffer);
    return LOCAL_PUBLIC_URL_BASE ? `${LOCAL_PUBLIC_URL_BASE}/${filename}` : `local:${filename}`;
}

async function saveS3(buffer, filename, contentType) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: filename, Body: buffer, ContentType: contentType || 'image/jpeg',
    }));
    return `${s3PublicUrlBase}/${filename}`;
}

// Saves already-processed image bytes to whichever backend is active.
// Returns the value to store in the DB (image_path) — a full permanent URL
// whenever a public URL base is configured, otherwise an opaque key.
async function save(buffer, filename, contentType) {
    return MODE === 's3' ? saveS3(buffer, filename, contentType) : saveLocal(buffer, filename);
}

async function del(value) {
    if (!value) return;
    const backend  = backendOf(value);
    const filename = filenameOf(value);
    try {
        if (backend === 's3') {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: filename }));
        } else {
            await fs.promises.unlink(path.join(LOCAL_DIR, path.basename(filename))).catch(() => {});
        }
    } catch (e) {
        console.error('[Storage] delete failed for', value, e.message);
    }
}

// Fetches raw bytes — used by PDF generation, which needs to embed the image.
async function getBuffer(value) {
    if (!value) return null;
    const backend  = backendOf(value);
    const filename = filenameOf(value);
    try {
        if (backend === 's3') {
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: filename }));
            const chunks = [];
            for await (const chunk of res.Body) chunks.push(chunk);
            return Buffer.concat(chunks);
        }
        const p = path.join(LOCAL_DIR, path.basename(filename));
        if (fs.existsSync(p)) return fs.readFileSync(p);
        // Not on our local disk and not recognized as our own S3 bucket —
        // if it's some other absolute URL, fetch it directly as a last resort.
        if (isUrl(value)) return await fetchUrlAsBuffer(value);
        return null;
    } catch (e) {
        console.error('[Storage] getBuffer failed for', value, e.message);
        return null;
    }
}

function fetchUrlAsBuffer(url) {
    return new Promise((resolve) => {
        const lib = url.startsWith('https:') ? require('https') : require('http');
        lib.get(url, res => {
            if (res.statusCode !== 200) { res.resume(); return resolve(null); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', () => resolve(null));
    });
}

// Public URL for use in API responses / <img> tags.
function getPublicUrl(value) {
    if (!value) return null;
    if (isUrl(value)) return value; // already a permanent URL — use as-is
    const backend  = backendOf(value);
    const filename = filenameOf(value);
    if (backend === 's3') return `${s3PublicUrlBase}/${filename}`;
    return '/uploads/' + path.basename(filename); // legacy tagged/bare key, served by the app itself
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
                const url = `${s3PublicUrlBase}/${obj.Key}`;
                out.push({ key: url, filename: obj.Key, url, size: obj.Size, mtime: obj.LastModified ? obj.LastModified.getTime() : 0 });
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
            const url  = LOCAL_PUBLIC_URL_BASE ? `${LOCAL_PUBLIC_URL_BASE}/${f}` : `/uploads/${f}`;
            return { key: url, filename: f, url, size: stat.size, mtime: stat.mtimeMs };
        });
}

// The hostname images are actually served from (e.g. "media.coralgold.in"),
// derived from whichever public URL base is configured — used by index.js
// to recognize requests arriving on that hostname (Batch 28 item 1: its
// bare root was falling through to the SPA's own index.html, since Hostinger
// binds every domain pointed at this app to the same Express process).
function getMediaHostname() {
    const base = MODE === 's3' ? s3PublicUrlBase : LOCAL_PUBLIC_URL_BASE;
    if (!base) return null;
    try { return new URL(base).hostname; } catch { return null; }
}

module.exports = {
    mode: MODE,
    localDir: LOCAL_DIR,
    publicUrlBase: MODE === 's3' ? s3PublicUrlBase : LOCAL_PUBLIC_URL_BASE,
    save, delete: del, getBuffer, getPublicUrl, list, getMediaHostname,
};
