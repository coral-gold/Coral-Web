'use strict';

// Brute-force protection for login endpoints (Batch 28 item 2).
//
// The previous throttle lived in req.session._loginAttempts — that only
// counts attempts made WITH the same session cookie attached. A scripted
// brute-force attempt has no reason to carry a cookie at all, so every
// request got a fresh, empty session and the "5 attempts per 10 minutes"
// check never actually triggered. This tracks attempts in a server-side
// Map instead, keyed by whatever the caller passes in (IP, or IP+account),
// so it applies no matter what the client does or doesn't send back.
//
// In-memory is enough for this app's single-process Hostinger deployment
// (same assumption the rest of this codebase already makes — see the
// in-memory `jobs` Map in routes/admin.js for background import jobs).

const WINDOW_MS     = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS  = 5;

const attemptsByKey = new Map(); // key -> [timestamp, timestamp, ...]

function prune(key) {
    const now = Date.now();
    const fresh = (attemptsByKey.get(key) || []).filter(t => now - t < WINDOW_MS);
    if (fresh.length) attemptsByKey.set(key, fresh);
    else attemptsByKey.delete(key);
    return fresh;
}

function isBlocked(key) {
    return prune(key).length >= MAX_ATTEMPTS;
}

function recordFailure(key) {
    const fresh = prune(key);
    fresh.push(Date.now());
    attemptsByKey.set(key, fresh);
}

function recordSuccess(key) {
    attemptsByKey.delete(key);
}

// Minutes remaining before this key's oldest attempt ages out of the
// window — used to give the caller a concrete "try again in N minutes".
function minutesRemaining(key) {
    const fresh = prune(key);
    if (fresh.length < MAX_ATTEMPTS) return 0;
    const oldest = Math.min(...fresh);
    return Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 60000));
}

// Periodic sweep so IPs/accounts that stop attempting don't sit in memory
// forever — this Map only ever grows otherwise.
setInterval(() => {
    const now = Date.now();
    for (const [key, arr] of attemptsByKey) {
        const fresh = arr.filter(t => now - t < WINDOW_MS);
        if (fresh.length) attemptsByKey.set(key, fresh);
        else attemptsByKey.delete(key);
    }
}, 5 * 60 * 1000).unref();

module.exports = { isBlocked, recordFailure, recordSuccess, minutesRemaining, MAX_ATTEMPTS };
