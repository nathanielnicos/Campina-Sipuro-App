'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadUploadFormat, loadUploadSettings } = require('../services/upload-format/uploadFormatLoader');
const { SCOPE, defaultFormat } = require('../services/upload-format/uploadFormatRules');

const fakeDb = (rows) => {
    const calls = [];
    return { calls, query: async (sql, params) => { calls.push([sql.replace(/\s+/g, ' ').trim(), params]); return [rows]; } };
};

test('tabel kosong: format bawaan; query per scope', async () => {
    const db = fakeDb([]);
    assert.deepEqual(await loadUploadFormat(db, SCOPE.LOT), defaultFormat(SCOPE.LOT));
    assert.match(db.calls[0][0], /FROM upload_format_settings WHERE scope = \?/);
    assert.deepEqual(db.calls[0][1], ['LOT']);
});

test('nilai tersimpan menggantikan bawaan, sisanya bawaan', async () => {
    const db = fakeDb([
        { setting_key: 'START_ROW', setting_value: '9' },
        { setting_key: 'TIMESTAMP_CELL', setting_value: 'M2' },
        { setting_key: 'COL_LOT_NUMBER', setting_value: 'AA' }
    ]);
    const f = await loadUploadFormat(db, SCOPE.DO);
    assert.equal(f.startRow, 9);
    assert.equal(f.timestampCell, 'M2');
    assert.equal(f.columns.LOT_NUMBER, 26);
    assert.equal(f.columns.ITEM, 2);
    assert.deepEqual((await loadUploadSettings(db, SCOPE.DO)).columns.LOT_NUMBER, 'AA');
});

test('nilai rusak di database ditolak 500 dengan pesan jelas (tidak membaca file dengan format salah)', async () => {
    for (const bad of [
        [{ setting_key: 'START_ROW', setting_value: 'abc' }],
        [{ setting_key: 'COL_ITEM', setting_value: 'B' }],        // kembar dengan Trans Type
        [{ setting_key: 'TIMESTAMP_CELL', setting_value: 'K9' }] // di bawah baris data pertama
    ]) {
        await assert.rejects(loadUploadFormat(fakeDb(bad), SCOPE.DO), (e) => e.status === 500 && /Upload Format/.test(e.message));
    }
});
