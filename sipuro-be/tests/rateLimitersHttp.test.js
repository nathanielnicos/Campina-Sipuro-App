'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

// Uji dengan library asli lewat server HTTP lokal. Dilewati bila express / express-rate-limit belum terpasang.
let express = null;
let rateLimit = null;
try {
    express = require('express');
    ({ rateLimit } = require('express-rate-limit'));
} catch (error) {
    express = null;
}
const skip = express && rateLimit ? false : 'express-rate-limit belum terpasang';

const MODULE_PATH = path.join(__dirname, '..', 'middleware', 'rateLimiters.js');

const startServer = (app) => new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => resolve(server));
});

const post = (server, urlPath) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: urlPath, method: 'POST' }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
});

test('login: percobaan gagal ke-N+1 ditolak 429, login berhasil tidak dihitung', { skip }, async () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '3';
    delete require.cache[MODULE_PATH];
    const { loginLimiter } = require(MODULE_PATH);
    delete process.env.LOGIN_RATE_LIMIT_MAX;

    const app = express();
    app.post('/login', loginLimiter, (req, res) => res.status(req.query.ok ? 200 : 401).json({ success: Boolean(req.query.ok) }));
    const server = await startServer(app);
    try {
        // 5 login berhasil tidak menghabiskan jatah
        for (let i = 0; i < 5; i += 1) assert.equal((await post(server, '/login?ok=1')).status, 200);
        // 3 gagal masih diproses, yang ke-4 ditolak
        for (let i = 0; i < 3; i += 1) assert.equal((await post(server, '/login')).status, 401);
        const blocked = await post(server, '/login');
        assert.equal(blocked.status, 429);
        assert.deepEqual(JSON.parse(blocked.body), { success: false, message: 'Too many requests. Please try again later.' });
    } finally {
        server.close();
        delete require.cache[MODULE_PATH];
    }
});

test('umum: permintaan melewati batas ditolak 429', { skip }, async () => {
    process.env.RATE_LIMIT_MAX = '3';
    delete require.cache[MODULE_PATH];
    const { apiLimiter } = require(MODULE_PATH);
    delete process.env.RATE_LIMIT_MAX;

    const app = express();
    app.use('/api', apiLimiter);
    app.post('/api/ping', (req, res) => res.json({ success: true }));
    const server = await startServer(app);
    try {
        for (let i = 0; i < 3; i += 1) assert.equal((await post(server, '/api/ping')).status, 200);
        assert.equal((await post(server, '/api/ping')).status, 429);
    } finally {
        server.close();
        delete require.cache[MODULE_PATH];
    }
});
