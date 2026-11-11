'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

let events = [];
let stored = [];
let actorExists = true;
let lockAcquired = 1;
const connection = {
    query: async (sql, params) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        events.push(['query', text, params]);
        if (/GET_LOCK/.test(text)) return [[{ acquired: lockAcquired }]];
        if (/FROM employees/.test(text)) return [actorExists ? [{ id: params[0] }] : []];
        if (/^SELECT setting_key/.test(text)) return [stored];
        return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => events.push(['begin']),
    commit: async () => events.push(['commit']),
    rollback: async () => events.push(['rollback']),
    release: () => events.push(['release'])
};
const fakeDb = {
    getConnection: async () => connection,
    query: async (sql) => { events.push(['db.query', sql.replace(/\s+/g, ' ').trim()]); return [[]]; }
};

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    return originalLoad.apply(this, arguments);
};
const { listUploadFormats } = require(path.join('..', 'controllers/upload-format/uploadFormatListController'));
const { updateUploadFormat } = require(path.join('..', 'controllers/upload-format/uploadFormatUpdateController'));
const { defaultSettings, SCOPE } = require('../services/upload-format/uploadFormatRules');

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const body = (patch = {}) => ({ startRow: 9, timestampCell: 'K1', columns: defaultSettings(SCOPE.DO).columns, ...patch });
const req = (over = {}) => ({ params: { scope: 'DO' }, body: body(), user: { id: 4 }, ...over });

test.beforeEach(() => { events = []; stored = []; actorExists = true; lockAcquired = 1; });

test('daftar: 200 berisi kedua scope', async () => {
    const res = makeRes();
    await listUploadFormats({}, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.data.map((d) => d.scope), ['LOT', 'DO']);
});

test('simpan: transaksi ber-lock, pelaku dari token, 200 dengan format tersimpan', async () => {
    const res = makeRes();
    await updateUploadFormat(req({ body: { ...body(), userId: 999 } }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.data.startRow, 9);
    assert.ok(events.some((e) => e[0] === 'commit'));
    const write = events.find((e) => /^INSERT INTO upload_format_settings/.test(e[1] || ''));
    assert.equal(write[2][3], 4);
    assert.ok(events.some((e) => /RELEASE_LOCK/.test(e[1] || '')));
});

test('isian salah -> 400 tanpa membuka transaksi; scope salah -> 400', async () => {
    let res = makeRes();
    await updateUploadFormat(req({ body: body({ startRow: 0 }) }), res);
    assert.equal(res.code, 400);
    res = makeRes();
    await updateUploadFormat(req({ params: { scope: 'zzz' } }), res);
    assert.equal(res.code, 400);
    assert.ok(!events.some((e) => e[0] === 'begin'));
});

test('tanpa perubahan -> 400 dan rollback; pelaku tidak ada -> 400; lock sibuk -> 409', async () => {
    const d = defaultSettings(SCOPE.DO);
    let res = makeRes();
    await updateUploadFormat(req({ body: { startRow: d.startRow, timestampCell: d.timestampCell, columns: d.columns } }), res);
    assert.equal(res.code, 400);
    assert.ok(events.some((e) => e[0] === 'rollback'));

    events = []; actorExists = false; res = makeRes();
    await updateUploadFormat(req(), res);
    assert.equal(res.code, 400);

    events = []; actorExists = true; lockAcquired = 0; res = makeRes();
    await updateUploadFormat(req(), res);
    assert.equal(res.code, 409);
});
