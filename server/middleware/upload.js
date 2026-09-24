'use strict';
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Set UPLOAD_DIR env var to a path OUTSIDE the app directory (e.g. /home/u123456/uploads)
// so images survive git-pull deployments. Defaults to assets/uploads inside the repo.
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../../assets/uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /image\/(jpeg|png|webp|gif|svg\+xml)/.test(file.mimetype);
        cb(ok ? null : new Error('Only image files allowed'), ok);
    }
});

const xlsxUpload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const ok  = ['.xlsx', '.xls', '.ods'].includes(ext);
        cb(ok ? null : new Error('Only .xlsx / .xls / .ods files allowed'), ok);
    }
});

// Compress with sharp: 800px max, quality 75 — same approach as WordPress thumbnail generation.
// Falls back to saving original if sharp is unavailable.
async function saveImage(file) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const basename = Date.now() + '-' + safeName.replace(/\.[^.]+$/, '');
    try {
        const sharp = require('sharp');
        const filename = basename + '.jpg';
        const filepath = path.join(UPLOAD_DIR, filename);
        await sharp(file.buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toFile(filepath);
        return filename;
    } catch (e) {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = basename + ext;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
        return filename;
    }
}

module.exports = { imageUpload, xlsxUpload, saveImage, UPLOAD_DIR };
