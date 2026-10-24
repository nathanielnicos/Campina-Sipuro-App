'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSavePayload, MAX_QTY } = require('../helpers/productionPlanValidation');

const wd = (v = 0) => ({ '2026_10': v, '2026_11': v });
const rev = (type, extra = {}) => ({
    revision_type: type, revision_label: 'Label', revision_date: '2026-10-21', weeks_data: wd(1), ...extra
});
const ok = () => ({
    id_product: 5, start_week: '2026-W10', end_week: '2026-W11',
    revisions: [rev('PROPOSED'), rev('CAMPINA_PLAN')]
});
const bad = (mutate, pattern) => {
    const b = ok();
    mutate(b);
    assert.throws(() => validateSavePayload(b), (e) => e.status === 400 && (!pattern || pattern.test(e.message)));
};

test('payload valid menghasilkan item per minggu dari server', () => {
    const v = validateSavePayload(ok());
    assert.equal(v.idProduct, 5);
    assert.equal(v.revisions[0].items.length, 2);
    assert.equal(v.revisions[0].items[0].week_start_date, '2026-03-02');
});

test('nilai nol disimpan sebagai 0, string angka diterima', () => {
    const b = ok();
    b.revisions[0].weeks_data = { '2026_10': 0, '2026_11': '15' };
    const v = validateSavePayload(b);
    assert.deepEqual(v.revisions[0].items.map((i) => i.qty), [0, 15]);
});

test('penolakan: produk, rentang, revisi', () => {
    bad((b) => { b.id_product = 'x'; });
    bad((b) => { b.start_week = '2026-W12'; });
    bad((b) => { b.end_week = '2030-W01'; }, /exceed/);
    bad((b) => { b.revisions = []; });
    bad((b) => { b.revisions = 'x'; });
    bad((b) => { b.revisions[0].revision_type = 'HACK'; });
    bad((b) => { b.revisions[0].revision_label = '   '; });
    bad((b) => { b.revisions[0].revision_label = 'x'.repeat(101); });
    bad((b) => { b.revisions[0].revision_date = '2026-02-31'; });
    bad((b) => { b.revisions[0].id_revision = -3; });
    bad((b) => { b.revisions[0].id_revision = 1; b.revisions[1].id_revision = 1; }, /duplicated/);
});

test('penolakan: qty tidak valid atau minggu hilang', () => {
    bad((b) => { b.revisions[0].weeks_data['2026_10'] = -1; }, /quantity/);
    bad((b) => { b.revisions[0].weeks_data['2026_10'] = 1.5; }, /quantity/);
    bad((b) => { b.revisions[0].weeks_data['2026_10'] = 'abc'; }, /quantity/);
    bad((b) => { b.revisions[0].weeks_data['2026_10'] = MAX_QTY + 1; }, /quantity/);
    bad((b) => { delete b.revisions[0].weeks_data['2026_11']; }, /quantity/);
    bad((b) => { b.revisions[0].weeks_data = null; }, /week data/);
});

test('harus tepat satu Campina Plan', () => {
    bad((b) => { b.revisions = [rev('PROPOSED')]; }, /Campina/);
    bad((b) => { b.revisions = [rev('CAMPINA_PLAN'), rev('CAMPINA_PLAN')]; }, /Campina/);
});
