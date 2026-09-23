'use strict';
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../assets/uploads');

// Memory storage for all image uploads — sharp processes before writing to disk
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

// Process buffer with sharp (compress + resize), then save to uploads dir.
// Falls back to raw save if sharp is unavailable.
async function saveImage(file) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const basename = Date.now() + '-' + safeName.replace(/\.[^.]+$/, '');
    try {
        const sharp = require('sharp');
        const filename = basename + '.jpg';
        const filepath = path.join(UPLOAD_DIR, filename);
        await sharp(file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toFile(filepath);
        return filename;
    } catch (e) {
        // sharp unavailable: save original unchanged
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = basename + ext;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
        return filename;
    }
}

module.exports = { imageUpload, xlsxUpload, saveImage };
