'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_WEEK_SPAN, parseWeekString, resolveWeekRange, getWeeksListBetween
} = require('../helpers/weekHelper');

test('parseWeekString: format ketat dan minggu harus ada di tahun ISO-nya', () => {
    assert.deepEqual(parseWeekString('2026-W09'), { year: 2026, week: 9 });
    assert.deepEqual(parseWeekString('2026-W53'), { year: 2026, week: 53 }); // 2026 punya 53 minggu
    assert.equal(parseWeekString('2025-W53'), null); // 2025 hanya 52 minggu
    for (const bad of ['2026-W9', '2026-W00', '2026-W54', 'abc', '', null, undefined, 20260901, '2026-W09x']) {
        assert.equal(parseWeekString(bad), null, String(bad));
    }
});

test('resolveWeekRange: rentang valid menghasilkan daftar minggu berurutan lintas tahun', () => {
    const r = resolveWeekRange('2026-W52', '2027-W02');
    assert.equal(r.ok, true);
    assert.deepEqual(r.weeks.map((w) => `${w.year}-${w.week_number}`), ['2026-52', '2026-53', '2027-1', '2027-2']);
    assert.match(r.weeks[0].start_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('resolveWeekRange: rentang salah ditolak (tanpa clamp)', () => {
    assert.equal(resolveWeekRange('2026-W10', '2026-W05').ok, false);
    assert.equal(resolveWeekRange('x', '2026-W05').ok, false);
    const tooLong = resolveWeekRange('2026-W01', '2029-W01');
    assert.equal(tooLong.ok, false);
    assert.match(tooLong.error, new RegExp(String(MAX_WEEK_SPAN)));
});

test('resolveWeekRange: clamp memotong ke batas untuk tampilan', () => {
    const r = resolveWeekRange('2026-W01', '2029-W01', { clamp: true });
    assert.equal(r.ok, true);
    assert.equal(r.weeks.length, MAX_WEEK_SPAN);
});

test('getWeeksListBetween: rentang tidak valid jatuh ke rolling default 9 minggu', () => {
    assert.equal(getWeeksListBetween(undefined, undefined).length, 9);
    assert.equal(getWeeksListBetween('2026-W10', '2026-W05').length, 9);
    assert.equal(getWeeksListBetween('2026-W10', '2026-W12').length, 3);
});
