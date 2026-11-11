'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseScope, parseUpdateInput, listFormats, updateFormat } = require('../services/upload-format/uploadFormatService');
const { SCOPE, defaultSettings } = require('../services/upload-format/uploadFormatRules');

const bodyOf = (scope, patch = {}) => {
    const d = defaultSettings(scope);
    return { startRow: d.startRow, timestampCell: d.timestampCell, columns: { ...d.columns }, ...patch };
};

test('parseScope: huruf kecil diterima, selain LOT/DO ditolak 400', () => {
    assert.equal(parseScope('lot'), 'LOT');
    assert.equal(parseScope(' do '), 'DO');
    for (const bad of ['', 'x', undefined, null]) assert.throws(() => parseScope(bad), (e) => e.status === 400);
});

test('parseUpdateInput: membersihkan (huruf besar, spasi, baris awal teks angka) dan memvalidasi', () => {
    const out = parseUpdateInput('do', { startRow: ' 9 ', timestampCell: ' m2 ', columns: { ...defaultSettings(SCOPE.DO).columns, ITEM: ' f ' } });
    assert.equal(out.scope, 'DO');
    assert.equal(out.startRow, 9);
    assert.equal(out.timestampCell, 'M2');
    assert.equal(out.columns.ITEM, 'F');

    assert.throws(() => parseUpdateInput('do', bodyOf(SCOPE.DO, { startRow: 'abc' })), (e) => e.status === 400 && /First data row/.test(e.message));
    assert.throws(() => parseUpdateInput('do', bodyOf(SCOPE.DO, { columns: { ...defaultSettings(SCOPE.DO).columns, ITEM: 'B' } })), (e) => e.status === 400 && e.details && e.details.problems.length > 0);
    assert.throws(() => parseUpdateInput('do', {}), (e) => e.status === 400);
    assert.throws(() => parseUpdateInput('x', bodyOf(SCOPE.DO)), (e) => e.status === 400 && /Invalid scope/.test(e.message));
    assert.throws(() => parseUpdateInput('do', bodyOf(SCOPE.DO, { columns: [] })), (e) => e.status === 400);
});

test('listFormats: kedua scope, nilai tersimpan atau bawaan, label dan kolom bawaan untuk tampilan', async () => {
    const db = { query: async () => [[
        { scope: 'DO', setting_key: 'COL_REFERENCE', setting_value: 'AB' },
        { scope: 'LOT', setting_key: 'START_ROW', setting_value: '9' }
    ]] };
    const [lot, doView] = await listFormats(db);
    assert.equal(lot.scope, 'LOT');
    assert.equal(lot.startRow, 9);
    assert.equal(lot.timestampCell, 'I1');
    assert.deepEqual(lot.columns.find((c) => c.key === 'DOC_SOURCE'), { key: 'DOC_SOURCE', label: 'Doc Source', column: 'E', defaultColumn: 'E' });
    assert.deepEqual(lot.defaults, { startRow: 7, timestampCell: 'I1' });
    assert.equal(doView.scope, 'DO');
    assert.equal(doView.columns.find((c) => c.key === 'REFERENCE').column, 'AB');
    assert.equal(doView.columns.find((c) => c.key === 'REFERENCE').defaultColumn, 'Z');
    assert.equal(doView.columns.some((c) => c.key === 'DOC_SOURCE'), false);
});

const fakeConnection = (stored) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            calls.push([text, params]);
            if (/^SELECT/.test(text)) return [stored];
            return [{ affectedRows: 1 }];
        }
    };
};

test('updateFormat: hanya nilai yang berubah ditulis dan dicatat; baris tidak berubah tidak disentuh', async () => {
    const d = defaultSettings(SCOPE.DO);
    const stored = Object.entries(d.columns).map(([k, v]) => ({ setting_key: `COL_${k}`, setting_value: v }))
        .concat([{ setting_key: 'START_ROW', setting_value: '7' }, { setting_key: 'TIMESTAMP_CELL', setting_value: 'I1' }]);
    const conn = fakeConnection(stored);
    const view = await updateFormat(conn, { scope: 'DO', startRow: 9, timestampCell: 'I1', columns: { ...d.columns, REFERENCE: 'AB' }, userId: 4 });

    assert.match(conn.calls[0][0], /FOR UPDATE/);
    const writes = conn.calls.filter((c) => /^INSERT INTO upload_format_settings/.test(c[0]));
    assert.deepEqual(writes.map((c) => c[1]), [['DO', 'START_ROW', '9', 4], ['DO', 'COL_REFERENCE', 'AB', 4]]);
    const logs = conn.calls.filter((c) => /^INSERT INTO upload_format_setting_logs/.test(c[0]));
    assert.deepEqual(logs.map((c) => c[1]), [['DO', 'START_ROW', '7', '9', 4], ['DO', 'COL_REFERENCE', 'Z', 'AB', 4]]);
    assert.equal(view.startRow, 9);
    assert.equal(view.columns.find((c) => c.key === 'REFERENCE').column, 'AB');
});

test('updateFormat: tabel kosong (belum seed) membuat semua baris; hanya perubahan yang dicatat', async () => {
    const d = defaultSettings(SCOPE.LOT);
    const conn = fakeConnection([]);
    await updateFormat(conn, { scope: 'LOT', startRow: 8, timestampCell: d.timestampCell, columns: d.columns, userId: 2 });
    const writes = conn.calls.filter((c) => /^INSERT INTO upload_format_settings/.test(c[0]));
    assert.equal(writes.length, 2 + Object.keys(d.columns).length);
    const logs = conn.calls.filter((c) => /^INSERT INTO upload_format_setting_logs/.test(c[0]));
    assert.deepEqual(logs.map((c) => c[1]), [['LOT', 'START_ROW', '7', '8', 2]]);
});

test('updateFormat: tanpa perubahan -> 400, tidak ada penulisan', async () => {
    const d = defaultSettings(SCOPE.LOT);
    const conn = fakeConnection([]);
    await assert.rejects(updateFormat(conn, { scope: 'LOT', ...d, userId: 2 }), (e) => e.status === 400 && /No changes/.test(e.message));
    assert.equal(conn.calls.length, 1);
});
