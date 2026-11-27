'use strict';

/**
 * Fungsi bersama di services/poCreateService.js yang dipakai createPO, createDraftPO, updatePO, dan cancelPO.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
// Stub dicocokkan lewat file hasil resolusi, bukan akhiran teks require, agar tetap mengenai
// require satu folder (poHelper, poLogHelper, dan poPricing bersebelahan dengan poCreateService).
const stubFiles = new Map([
    [require.resolve('../../utils/dateHelper'), { getWibDateTimeString: () => '2026-10-24 10:00:00' }],
    [require.resolve('../../services/purchase-order/poHelper'), { generateNextPoNumber: async () => 'PO-X' }],
    [require.resolve('../../services/purchase-order/poLogHelper'), { logPOHeader: async () => 1, logPODetails: async () => {} }],
    [require.resolve('../../services/purchase-order/poPricing'), { priceItems: async () => ({}) }]
]);
Module._load = function patchedLoad(request, parent) {
    if (/^\./.test(request)) {
        let file = null;
        try { file = Module._resolveFilename(request, parent); } catch (e) { /* biarkan loader asli melapor */ }
        if (file && stubFiles.has(file)) return stubFiles.get(file);
    }
    return originalLoad.apply(this, arguments);
};
const { findCustomer, getCustomerName, getCurrentPpnPercent } = require('../../services/purchase-order/poCreateService');

const dbReturning = (rows) => ({
    calls: [],
    async query(sql, params) { this.calls.push({ sql: sql.replace(/\s+/g, ' '), params }); return [rows]; }
});

test('getCustomerName: nama perusahaan, atau null bila customer tidak ada', async () => {
    const found = dbReturning([{ company_name: 'ACME', customer_code: 'AC', is_active: 1 }]);
    assert.equal(await getCustomerName(found, 7), 'ACME');
    assert.deepEqual(found.calls[0].params, [7]);
    assert.match(found.calls[0].sql, /FROM sipuro_db\.customers WHERE customer_id = \?/);

    assert.equal(await getCustomerName(dbReturning([]), 7), null);
});

test('findCustomer: baris pertama atau null', async () => {
    assert.equal((await findCustomer(dbReturning([{ company_name: 'A' }]), 1)).company_name, 'A');
    assert.equal(await findCustomer(dbReturning([]), 1), null);
});

test('getCurrentPpnPercent: nilai MySQL berupa teks, kosong atau NULL kembali ke 11', async () => {
    assert.equal(await getCurrentPpnPercent(dbReturning([{ ppn_percent: '12.50' }])), 12.5);
    assert.equal(await getCurrentPpnPercent(dbReturning([{ ppn_percent: null }])), 11);
    assert.equal(await getCurrentPpnPercent(dbReturning([])), 11);
});
