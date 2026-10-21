'use strict';

/**
 * Tes draft PO saran PPIC (createDraftPO) dan layanan pembuat PO bersama (services/poCreateService.js):
 * pelaku dari token, created_by kosong, suggested_by terisi, log SUGGEST_CREATE, urutan nomor PO,
 * dan perilaku createPO (customer) yang tidak boleh berubah.
 * Memakai database tiruan. Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const root = path.join(__dirname, '..');

const calls = [];
const notifications = [];

const stubs = {
    'config/db': { sipuroDb: null },
    'helpers/notificationHelper': { createNotification: async (n) => { notifications.push(n); } },
    'helpers/poLogHelper': {
        logPOHeader: async (connection, args) => { calls.push(['logHeader', args]); return 1; },
        logPODetails: async () => {}
    },
    'helpers/dateHelper': { getWibDateTimeString: () => '2026-10-21 10:00:00', getWibYear: () => 2026 },
    'helpers/safeError': { safeError: (e) => String(e) },
    'helpers/poHelper': {
        calculateBaseQty: (qty) => qty,
        generateNextPoNumber: async () => { calls.push(['genNumber']); return { poNumber: '002/PO/AC/2026' }; }
    }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    for (const key of Object.keys(stubs)) {
        if (request === key || request.endsWith('/' + key)) return stubs[key];
    }
    return originalLoad.apply(this, arguments);
};

const state = { customer: { company_name: 'ACME', customer_code: 'AC', delivery_address: 'Jl. Contoh 1', is_active: 1 }, failOn: null };

const connection = {
    async query(sql, params) {
        const s = sql.replace(/\s+/g, ' ');
        calls.push(['sql', s, params]);
        if (state.failOn && state.failOn.test(s)) throw new Error('boom internal detail');
        if (/po_settings/.test(s)) return [[{ setting_id: 1 }]];
        if (/FROM sipuro_db\.customers WHERE customer_id/.test(s)) return [state.customer ? [state.customer] : []];
        if (/company_profile/.test(s)) return [[{ ppn_percent: '11.00' }]];
        if (/FROM sipuro_db\.products/.test(s)) {
            return [params[0].map((id) => ({
                id_product: id, product_name: `P${id}`, base_uom: 'PCS', pcs_per_ctn: 1, ctn_per_plt: 1,
                ml_per_pcs: null, kg_per_pcs: null, is_active: 1
            }))];
        }
        if (/product_selling_prices/.test(s)) return [params[0].map((id) => ({ id_product: id, price: '1000.00' }))];
        if (/INSERT INTO sipuro_db\.po_headers/.test(s)) return [{ insertId: 77 }];
        if (/INSERT INTO sipuro_db\.po_details/.test(s)) return [{ insertId: 500 }];
        return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => { calls.push(['begin']); },
    commit: async () => { calls.push(['commit']); },
    rollback: async () => { calls.push(['rollback']); },
    release: () => {}
};
stubs['config/db'].sipuroDb = { getConnection: async () => connection, query: (...args) => connection.query(...args) };

const { createDraftPO } = require(path.join(root, 'controllers/productionSchedule/poRequirement/poRequirementManageController.js'));
const { createPO } = require(path.join(root, 'controllers/po/poCreateController.js'));

const makeRes = () => {
    const res = { code: 200 };
    res.status = (code) => { res.code = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};
const reset = (over = {}) => {
    calls.length = 0;
    notifications.length = 0;
    Object.assign(state, {
        customer: { company_name: 'ACME', customer_code: 'AC', delivery_address: 'Jl. Contoh 1', is_active: 1 },
        failOn: null
    }, over);
};
const has = (name) => calls.some((c) => c[0] === name);
const headerInsert = () => calls.find((c) => c[0] === 'sql' && /INSERT INTO sipuro_db\.po_headers/.test(c[1]));
const logArgs = () => calls.find((c) => c[0] === 'logHeader')[1];

const ppic = { id: 31, type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' };
const goodItems = [{ id_product: 1, required_po_qty: 40 }, { id_product: 2, required_po_qty: 10 }];

test('draft saran: pelaku dari token, created_by kosong, suggested_by = PPIC, log SUGGEST_CREATE', async () => {
    reset();
    const res = makeRes();
    // created_by / userId di body harus diabaikan sepenuhnya.
    await createDraftPO({ body: { customer_id: '5', items: goodItems, description: ' Saran minggu 43 ', created_by: 999, userId: 998 }, user: ppic }, res);

    assert.equal(res.code, 200);
    assert.equal(res.body.data.po_number, '002/PO/AC/2026');

    const params = headerInsert()[2];
    assert.equal(params[1], 5);                 // customer_id dari body
    assert.equal(params[5], 'Jl. Contoh 1');    // alamat dari master customer
    assert.equal(params[6], 'Saran minggu 43'); // deskripsi dirapikan
    assert.equal(params[7], 'Draft');
    assert.equal(params[8], null);              // created_by kosong
    assert.equal(params[9], null);              // updated_by kosong
    assert.equal(params[10], 31);               // suggested_by = PPIC dari token

    const log = logArgs();
    assert.equal(log.actionType, 'SUGGEST_CREATE');
    assert.equal(log.actionBy, 31);
    assert.equal(log.newStatus, 'Draft');

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientType, 'CUSTOMER');
    assert.equal(notifications[0].recipientId, 5);
    assert.equal(notifications[0].senderType, 'EMPLOYEE');
    assert.equal(notifications[0].senderId, 31);
    assert.ok(has('commit'));
});

test('draft saran: nomor PO dibuat setelah begin dan setelah kunci po_settings (layanan bersama)', async () => {
    reset();
    await createDraftPO({ body: { customer_id: 5, items: goodItems }, user: ppic }, makeRes());
    const iBegin = calls.findIndex((c) => c[0] === 'begin');
    const iLock = calls.findIndex((c) => c[0] === 'sql' && /po_settings.*FOR UPDATE/.test(c[1]));
    const iNumber = calls.findIndex((c) => c[0] === 'genNumber');
    const iInsert = calls.findIndex((c) => c[0] === 'sql' && /INSERT INTO sipuro_db\.po_headers/.test(c[1]));
    assert.ok(iBegin >= 0 && iBegin < iLock && iLock < iNumber && iNumber < iInsert, `urutan salah: ${[iBegin, iLock, iNumber, iInsert]}`);
});

test('draft saran: harga dihitung server (harga dari klien diabaikan) dengan aturan rupiah bulat', async () => {
    reset();
    await createDraftPO({
        body: { customer_id: 5, items: [{ id_product: 1, required_po_qty: 3, unit_price: 1, total_price: 1, base_price: 1 }] },
        user: ppic
    }, makeRes());
    const params = headerInsert()[2];
    assert.equal(params[2], 3000);  // subtotal = 3 x 1.000
    assert.equal(params[3], 11);    // PPN perusahaan saat ini
    assert.equal(params[4], 3330);  // total = subtotal + PPN
});

test('draft saran: customer tidak ada atau nonaktif -> 404 tanpa transaksi', async () => {
    for (const customer of [null, { company_name: 'X', customer_code: 'X', delivery_address: '', is_active: 0 }]) {
        reset({ customer });
        const res = makeRes();
        await createDraftPO({ body: { customer_id: 5, items: goodItems }, user: ppic }, res);
        assert.equal(res.code, 404);
        assert.equal(has('begin'), false);
        assert.equal(notifications.length, 0);
    }
});

test('draft saran: input tidak valid ditolak 400 sebelum transaksi dimulai', async () => {
    const cases = [
        { customer_id: undefined, items: goodItems },
        { customer_id: 'abc', items: goodItems },
        { customer_id: 5, items: [] },
        { customer_id: 5, items: 'x' },
        { customer_id: 5, items: goodItems, description: 123 },
        { customer_id: 5, items: [{ id_product: 1, required_po_qty: 0 }] },
        { customer_id: 5, items: [{ id_product: 1, required_po_qty: -3 }] },
        { customer_id: 5, items: [{ id_product: 1, required_po_qty: '5abc' }] },
        { customer_id: 5, items: [{ id_product: 'x', required_po_qty: 5 }] },
        { customer_id: 5, items: [{ id_product: 1, required_po_qty: 5 }, { id_product: 1, required_po_qty: 7 }] },
        { customer_id: 5, items: [null] }
    ];
    for (const body of cases) {
        reset();
        const res = makeRes();
        await createDraftPO({ body, user: ppic }, res);
        assert.equal(res.code, 400, JSON.stringify(body));
        assert.equal(has('begin'), false, JSON.stringify(body));
        assert.equal(notifications.length, 0);
    }
});

test('draft saran: error tak terduga -> 500 generik, dibatalkan, tanpa notifikasi', async () => {
    reset({ failOn: /INSERT INTO sipuro_db\.po_details/ });
    const res = makeRes();
    await createDraftPO({ body: { customer_id: 5, items: goodItems }, user: ppic }, res);
    assert.equal(res.code, 500);
    assert.equal(res.body.message, 'Failed to create Draft PO.');
    assert.ok(has('rollback'));
    assert.equal(has('commit'), false);
    assert.equal(notifications.length, 0);
});

test('createPO (customer): perilaku tetap — created_by = pengguna, suggested_by kosong, log CREATE', async () => {
    reset();
    const res = makeRes();
    await createPO({ body: { items: [{ id_product: 1, qty: 3 }], status: 'Draft' }, user: { customerId: 5, id: 9 } }, res);
    assert.equal(res.code, 200);
    const params = headerInsert()[2];
    assert.equal(params[7], 'Draft');
    assert.equal(params[8], 9);
    assert.equal(params[9], 9);
    assert.equal(params[10], null);
    const log = logArgs();
    assert.equal(log.actionType, 'CREATE');
    assert.equal(log.actionBy, 9);
});
