'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', 'middleware', 'rateLimiters.js');

// Memuat rateLimiters.js dengan 'express-rate-limit' palsu, supaya yang diuji adalah konfigurasi kita
const loadWithStub = (env = {}) => {
    const calls = [];
    const originalLoad = Module._load;
    const saved = {};
    Object.keys(env).forEach((k) => { saved[k] = process.env[k]; process.env[k] = env[k]; });
    Module._load = function (request, ...rest) {
        if (request === 'express-rate-limit') {
            return { rateLimit: (options) => { calls.push(options); return { options }; } };
        }
        return originalLoad.call(this, request, ...rest);
    };
    delete require.cache[MODULE_PATH];
    try {
        const exported = require(MODULE_PATH);
        return { exported, calls };
    } finally {
        Module._load = originalLoad;
        delete require.cache[MODULE_PATH];
        Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
    }
};

test('nilai bawaan setiap pembatas', () => {
    const { exported } = loadWithStub({ RATE_LIMIT_MAX: '', LOGIN_RATE_LIMIT_MAX: '', REGISTER_RATE_LIMIT_MAX: '' });
    const o = (name) => exported[name].options;

    assert.equal(o('apiLimiter').limit, 600);
    assert.equal(o('apiLimiter').windowMs, 60 * 1000);

    assert.equal(o('loginLimiter').limit, 10);
    assert.equal(o('loginLimiter').windowMs, 15 * 60 * 1000);
    assert.equal(o('loginLimiter').skipSuccessfulRequests, true);

    assert.equal(o('passwordChangeLimiter').limit, 10);
    assert.equal(o('passwordChangeLimiter').skipSuccessfulRequests, true);

    assert.equal(o('registerLimiter').limit, 20);
    assert.equal(o('registerLimiter').windowMs, 60 * 60 * 1000);
    assert.notEqual(o('registerLimiter').skipSuccessfulRequests, true);
});

test('login dan ganti password memakai pembatas terpisah', () => {
    const { exported } = loadWithStub();
    assert.notEqual(exported.loginLimiter, exported.passwordChangeLimiter);
});

test('semua pembatas memakai header standar dan pesan JSON', () => {
    const { exported } = loadWithStub();
    Object.values(exported).forEach((limiter) => {
        assert.equal(limiter.options.standardHeaders, 'draft-7');
        assert.equal(limiter.options.legacyHeaders, false);
        assert.deepEqual(limiter.options.message, { success: false, message: 'Too many requests. Please try again later.' });
    });
});

test('batas bisa diubah lewat environment variable', () => {
    const { exported } = loadWithStub({ RATE_LIMIT_MAX: '50', LOGIN_RATE_LIMIT_MAX: '3', REGISTER_RATE_LIMIT_MAX: '2' });
    assert.equal(exported.apiLimiter.options.limit, 50);
    assert.equal(exported.loginLimiter.options.limit, 3);
    assert.equal(exported.passwordChangeLimiter.options.limit, 3);
    assert.equal(exported.registerLimiter.options.limit, 2);
});

test('nilai environment yang tidak valid memakai nilai bawaan', () => {
    ['abc', '0', '-5'].forEach((bad) => {
        const { exported } = loadWithStub({ RATE_LIMIT_MAX: bad, LOGIN_RATE_LIMIT_MAX: bad, REGISTER_RATE_LIMIT_MAX: bad });
        assert.equal(exported.apiLimiter.options.limit, 600, bad);
        assert.equal(exported.loginLimiter.options.limit, 10, bad);
        assert.equal(exported.registerLimiter.options.limit, 20, bad);
    });
});
