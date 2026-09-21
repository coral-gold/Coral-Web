'use strict';

function requireParty(req, res, next) {
    if (!req.session.partyId) {
        return res.status(401).json({ ok: false, error: 'Login required' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ ok: false, error: 'Admin login required' });
    }
    next();
}

module.exports = { requireParty, requireAdmin };
