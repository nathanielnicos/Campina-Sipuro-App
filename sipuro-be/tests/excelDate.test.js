'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toExcelDate } = require('../helpers/excelDate');

test('tanggal-waktu diubah ke nomor seri Excel tanpa bergantung zona waktu', () => {
    // 2026-01-01 00:00:00 = 46023 hari sejak epoch Excel (1899-12-30)
    assert.deepEqual(toExcelDate('2026-01-01 00:00:00'), { v: 46023, t: 'n', z: 'yyyy-mm-dd hh:mm:ss' });
    assert.equal(toExcelDate('2026-01-01 12:00:00').v, 46023.5);
    assert.equal(toExcelDate('2026-01-01T06:00:00').v, 46023.25);
});

test('tanggal saja memakai format tanggal; tanpa jam dianggap 00:00:00', () => {
    assert.deepEqual(toExcelDate('2026-01-01', { dateOnly: true }), { v: 46023, t: 'n', z: 'yyyy-mm-dd' });
});

test('nilai kosong atau tidak dikenal menjadi null (sel kosong)', () => {
    for (const v of [null, undefined, '', '-', 'abc', '01-01-2026']) assert.equal(toExcelDate(v), null);
});

test('hasil sama pada zona waktu berbeda', () => {
    const original = process.env.TZ;
    try {
        for (const tz of ['UTC', 'Asia/Jakarta', 'America/Los_Angeles']) {
            process.env.TZ = tz;
            assert.equal(toExcelDate('2026-06-15 23:59:59').v, toExcelDate('2026-06-15 23:59:59').v);
            assert.equal(toExcelDate('2026-06-15 08:00:00').v, 46188 + 8 / 24);
        }
    } finally {
        if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    }
});
