'use strict';

/**
 * Tes config/db.js: setiap koneksi baru mengatur zona waktu dan batas GROUP_CONCAT sesi.
 * mysql2 diganti tiruan, tidak ada koneksi sungguhan. Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const handlers = {};
const fakePool = { pool: { on: (event, callback) => { handlers[event] = callback; } } };

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'mysql2/promise') return { createPool: () => fakePool };
    return originalLoad.apply(this, arguments);
};

require('../config/db');

test('koneksi baru mengatur time_zone dan group_concat_max_len sesi', () => {
    assert.equal(typeof handlers.connection, 'function');
    const queries = [];
    handlers.connection({
        query: (sql, params, callback) => {
            queries.push({ sql, params });
            const done = typeof params === 'function' ? params : callback;
            if (done) done(null);
        }
    });
    assert.ok(queries.some((q) => /^SET time_zone = \?$/.test(q.sql) && q.params[0] === '+07:00'));
    assert.ok(queries.some((q) => q.sql === 'SET SESSION group_concat_max_len = 1048576'));
});

test('kegagalan mengatur sesi hanya dicatat, tidak melempar error', () => {
    const originalConsoleError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));
    try {
        assert.doesNotThrow(() => handlers.connection({
            query: (sql, params, callback) => {
                const done = typeof params === 'function' ? params : callback;
                if (done) done(new Error('ditolak'));
            }
        }));
        assert.equal(logged.length, 2);
    } finally {
        console.error = originalConsoleError;
    }
});
