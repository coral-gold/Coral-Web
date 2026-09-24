'use strict';
const multer  = require('multer');
const path    = require('path');
const storage = require('../lib/storage');

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

// Compress with sharp: 800px max, quality 75 — same approach as WordPress
// thumbnail generation. Falls back to the original bytes if sharp is
// unavailable. Returns the storage key to persist in the DB (image_path).
async function saveImage(file) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const basename = Date.now() + '-' + safeName.replace(/\.[^.]+$/, '');
    try {
        const sharp = require('sharp');
        const filename = basename + '.jpg';
        const buffer = await sharp(file.buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        return storage.save(buffer, filename, 'image/jpeg');
    } catch (e) {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = basename + ext;
        return storage.save(file.buffer, filename, file.mimetype);
    }
}

module.exports = { imageUpload, xlsxUpload, saveImage };
