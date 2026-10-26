'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const rules = require('../services/production-lot/lotAllocationRules');
const { chunk } = require('../helpers/arrayUtils');

test('konstanta status alokasi dan item PO', () => {
    assert.deepEqual({ ...rules.ALLOCATION_STATUS }, {
        OPEN: 'Open', CLOSED: 'Closed', CANCELED: 'Canceled', FORCE_CLOSED: 'Force Closed'
    });
    assert.deepEqual([...rules.ELIGIBLE_HEADER_STATUSES], ['Approved', 'Production Completed']);
    assert.deepEqual([...rules.ELIGIBLE_DETAIL_STATUSES], ['Active', 'Close Requested']);
    assert.deepEqual([...rules.ELIGIBLE_ALLOCATION_STATUSES], ['Open', 'Closed']);
});

test('konstanta dibekukan', () => {
    assert.ok(Object.isFrozen(rules.ALLOCATION_STATUS));
    assert.ok(Object.isFrozen(rules.ELIGIBLE_HEADER_STATUSES));
});

test('allocatedQtySql mengecualikan alokasi Canceled dan memakai referensi kolom', () => {
    const sql = rules.allocatedQtySql('d.po_detail_id');
    assert.match(sql, /SUM\(pla\.allocated_qty\)/);
    assert.match(sql, /pla\.po_detail_id = d\.po_detail_id/);
    assert.match(sql, /pla\.status <> 'Canceled'/);
    assert.match(sql, /^COALESCE\(/);
});

test('kunci alokasi dan kunci lot', () => {
    assert.equal(rules.allocationKey(5, 9), '5_9');
    assert.equal(rules.lotKey('L1', 3), 'L1_3');
    assert.notEqual(rules.lotKey('L1', 3), rules.lotKey('L1', 4));
});

test('chunk memecah array dan menolak ukuran tidak valid', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunk([], 3), []);
    for (const bad of [0, -1, 1.5, NaN, undefined, '2']) {
        assert.throws(() => chunk([1], bad), RangeError);
    }
});

test('tidak ada definisi chunk ganda di services/production-lot', () => {
    const dir = path.join(__dirname, '..', 'services', 'production-lot');
    for (const f of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        assert.doesNotMatch(src, /const chunk\s*=/, `${f} mendefinisikan chunk sendiri`);
    }
});
