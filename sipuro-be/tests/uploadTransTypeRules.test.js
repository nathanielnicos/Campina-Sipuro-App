'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    SCOPE, DIRECTION, MATCH_BY, QTY_COLUMN, normalizeTransType, validateTransTypeInput, rowToRule, buildRuleFinder
} = require('../services/upload-trans-type/uploadTransTypeRules');
const { loadActiveRules, loadRuleFinder } = require('../services/upload-trans-type/uploadTransTypeLoader');
const { LOT_ROWS, DO_ROWS, findLotRule, findDoRule } = require('./fixtures/transTypeRules');

test('kolom qty menurut arah: IN = Q (16), OUT = T (19)', () => {
    assert.deepEqual({ ...QTY_COLUMN }, { IN: 16, OUT: 19 });
    assert.deepEqual(rowToRule({ trans_type: 'WIP Completion', direction: 'IN', match_by: 'BATCH_LOT' }),
        { label: 'WIP Completion', direction: 'IN', sign: 1, qtyColumn: 16, matchBy: 'BATCH_LOT' });
    assert.deepEqual(rowToRule({ trans_type: 'WIP Issue', direction: 'OUT', match_by: 'LOT' }),
        { label: 'WIP Issue', direction: 'OUT', sign: -1, qtyColumn: 19, matchBy: 'LOT' });
});

test('normalisasi: huruf kecil, spasi dirapikan, null aman', () => {
    assert.equal(normalizeTransType('  WIP   Issue '), 'wip issue');
    assert.equal(normalizeTransType(null), '');
    assert.equal(normalizeTransType(undefined), '');
});

test('jenis dikenali tanpa peduli huruf besar/kecil dan spasi berlebih', () => {
    for (const [text, label] of [
        ['WIP Completion', 'WIP Completion'],
        ['wip completion return', 'WIP Completion Return'],
        ['  GOOD ISSUE SAMPLE QC ', 'Good Issue Sample QC'],
        ['good  issue   sample rnd', 'Good Issue Sample RND'],
        ['WIP ISSUE', 'WIP Issue']
    ]) {
        assert.equal(findLotRule(text).label, label, text);
    }
    assert.equal(findDoRule('sales order ISSUE').direction, DIRECTION.OUT);
    assert.equal(findDoRule('rma receipt').direction, DIRECTION.IN);
    for (const bad of ['', '   ', undefined, null, 'WIP Issues', 'Good Issue Sample', 'Sales Order Issue']) {
        assert.equal(findLotRule(bad), undefined, String(bad));
    }
    assert.equal(findDoRule('WIP Issue'), undefined);
});

test('seed awal: 5 jenis lot dan 2 jenis DO sesuai migrasi', () => {
    assert.deepEqual(LOT_ROWS.map((r) => [r.trans_type, r.direction, r.match_by]), [
        ['WIP Completion', 'IN', 'BATCH_LOT'],
        ['WIP Completion Return', 'OUT', 'BATCH_LOT'],
        ['Good Issue Sample QC', 'OUT', 'LOT'],
        ['Good Issue Sample RND', 'OUT', 'LOT'],
        ['WIP Issue', 'OUT', 'LOT']
    ]);
    assert.deepEqual(DO_ROWS.map((r) => [r.trans_type, r.direction]), [['Sales Order Issue', 'OUT'], ['RMA Receipt', 'IN']]);
});

test('validasi isian jenis: menambah jenis baru harus aman', () => {
    const ok = { scope: SCOPE.LOT, transType: 'X Issue', direction: 'OUT', matchBy: MATCH_BY.LOT };
    assert.deepEqual(validateTransTypeInput(ok), []);
    assert.deepEqual(validateTransTypeInput({ ...ok, direction: 'IN', matchBy: MATCH_BY.BATCH_LOT }), []);
    // jenis non-produksi boleh menambah (arah IN): pemulihan lewat Doc Source atau tambahan output lot
    assert.deepEqual(validateTransTypeInput({ ...ok, direction: 'IN' }), []);
    assert.match(validateTransTypeInput({ ...ok, scope: 'X' })[0], /scope/);
    assert.match(validateTransTypeInput({ ...ok, transType: '   ' })[0], /required/);
    assert.match(validateTransTypeInput({ ...ok, transType: 'a'.repeat(51) })[0], /at most 50/);
    assert.match(validateTransTypeInput({ ...ok, direction: 'X' })[0], /Direction/);
    assert.match(validateTransTypeInput({ ...ok, matchBy: 'BATCH' })[0], /match/);
});

test('buildRuleFinder tanpa aturan: tidak mengenali apa pun', () => {
    assert.equal(buildRuleFinder([])('WIP Issue'), undefined);
    assert.equal(buildRuleFinder()('WIP Issue'), undefined);
});

test('loader: hanya jenis aktif dari scope yang diminta', async () => {
    const calls = [];
    const q = { query: async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, ' '), params }); return [[{ trans_type: 'WIP Issue', direction: 'OUT', match_by: 'LOT' }]]; } };
    const rules = await loadActiveRules(q, SCOPE.LOT);
    assert.match(calls[0].sql, /FROM upload_trans_types WHERE scope = \? AND is_active = 1/);
    assert.deepEqual(calls[0].params, ['LOT']);
    assert.equal(rules[0].sign, -1);
    const find = await loadRuleFinder(q, SCOPE.LOT);
    assert.equal(find('wip issue').matchBy, 'LOT');
    assert.equal(find('lain'), undefined);
});
