'use strict';
const multer = require('multer');
const path   = require('path');

const imgStorage = multer.diskStorage({
    destination: path.join(__dirname, '../../assets/uploads'),
    filename:    (req, file, cb) => {
        const name = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, name);
    }
});

const xlsxStorage = multer.memoryStorage();

const imageUpload = multer({
    storage: imgStorage,
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /image\/(jpeg|png|webp|gif|svg\+xml)/.test(file.mimetype);
        cb(ok ? null : new Error('Only image files allowed'), ok);
    }
});

const xlsxUpload = multer({
    storage: xlsxStorage,
    limits:  { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const ok  = ['.xlsx', '.xls', '.ods'].includes(ext);
        cb(ok ? null : new Error('Only .xlsx / .xls / .ods files allowed'), ok);
    }
});

module.exports = { imageUpload, xlsxUpload };
