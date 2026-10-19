'use strict';

/**
 * Tes aturan controller PO (paket 2B): status yang diizinkan, penguncian baris,
 * PPN terkunci, dan urutan pembuatan nomor PO.
 * Memakai database tiruan (tidak menyentuh database sungguhan) dan menggantikan
 * modul konfigurasi/notifikasi/log selama tes.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const root = path.join(__dirname, '..');

const calls = [];
const notifications = [];

// Modul yang diganti selama tes (dicocokkan dari akhir nama modul yang diminta).
const stubs = {
    'config/db': { sipuroDb: null },
    'helpers/notificationHelper': { createNotification: async (n) => { notifications.push(n); } },
    'helpers/poLogHelper': {
        logPOHeader: async (connection, args) => { calls.push(['logHeader', args]); return 1; },
        logPODetails: async () => {}
    },
    'helpers/dateHelper': { getWibDateTimeString: () => '2026-10-18 10:00:00', getWibYear: () => 2026 },
    'helpers/safeError': { safeError: (e) => String(e) },
    'helpers/poHelper': {
        calculateBaseQty: (qty) => qty,
        generateNextPoNumber: async () => { calls.push(['genNumber']); return { poNumber: '001/PO/AC/2026' }; }
    }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    for (const key of Object.keys(stubs)) {
        if (request === key || request.endsWith('/' + key)) return stubs[key];
    }
    return originalLoad.apply(this, arguments);
};

// Keadaan PO tiruan yang dibaca oleh query.
const state = { status: 'Waiting for Confirmation', ppn: '11.00', owner: 5, exists: true };

const connection = {
    async query(sql, params) {
        const s = sql.replace(/\s+/g, ' ');
        calls.push(['sql', s, params]);
        if (/po_settings/.test(s)) return [[{ setting_id: 1 }]];
        if (/FROM sipuro_db\.po_headers/.test(s)) {
            return [state.exists
                ? [{ po_number: 'X', status: state.status, customer_id: state.owner, ppn_percent: state.ppn }]
                : []];
        }
        if (/FROM sipuro_db\.customers WHERE customer_id/.test(s)) return [[{ company_name: 'ACME', customer_code: 'AC' }]];
        if (/company_profile/.test(s)) return [[{ ppn_percent: '12.00' }]];
        if (/FROM sipuro_db\.products/.test(s)) {
            return [[{
                id_product: 1, product_name: 'P1', base_uom: 'PCS', pcs_per_ctn: 1, ctn_per_plt: 1,
                ml_per_pcs: null, kg_per_pcs: null, is_active: 1
            }]];
        }
        if (/product_selling_prices/.test(s)) return [[{ id_product: 1, price: '1000.00' }]];
        if (/INSERT INTO sipuro_db\.po_headers/.test(s)) return [{ insertId: 77 }];
        if (/INSERT INTO sipuro_db\.po_details/.test(s)) return [{ insertId: 500 }];
        if (/FROM sipuro_db\.po_details/.test(s)) {
            return [[{
                po_detail_id: 10, id_product: 1, qty: 5, base_qty: 5, base_price: '1000.00',
                total_price: '5000.00', status: 'Active'
            }]];
        }
        return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => { calls.push(['begin']); },
    commit: async () => { calls.push(['commit']); },
    rollback: async () => { calls.push(['rollback']); },
    release: () => {}
};
stubs['config/db'].sipuroDb = { getConnection: async () => connection, query: (...args) => connection.query(...args) };

const create = require(path.join(root, 'controllers/po/poCreateController.js'));
const update = require(path.join(root, 'controllers/po/poUpdateController.js'));
const statusController = require(path.join(root, 'controllers/po/poStatusController.js'));

const makeRes = () => {
    const res = { code: 200 };
    res.status = (code) => { res.code = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};
const reset = (over = {}) => {
    calls.length = 0;
    notifications.length = 0;
    Object.assign(state, { status: 'Waiting for Confirmation', ppn: '11.00', owner: 5, exists: true }, over);
};
const has = (name) => calls.some((c) => c[0] === name);
const indexOf = (predicate) => calls.findIndex(predicate);
const headerUpdate = () => calls.find((c) => c[0] === 'sql' && /UPDATE sipuro_db\.po_headers SET subtotal/.test(c[1]));
const customer = { customerId: 5, id: 9 };
const items = [{ id_product: 1, qty: 3 }];

test('createPO: status di luar Draft/Waiting ditolak sebelum transaksi dimulai', async () => {
    for (const status of ['Approved', 'Rejected', 'Canceled', 'Production Completed', 'xxx', 5]) {
        reset();
        const res = makeRes();
        await create.createPO({ body: { items, status }, user: customer }, res);
        assert.equal(res.code, 400, String(status));
        assert.equal(res.body.message, 'Invalid PO status.');
        assert.equal(has('begin'), false);
    }
});

test('createPO: default Waiting, Draft diterima, nomor dibuat setelah begin dan setelah kunci po_settings', async () => {
    reset();
    let res = makeRes();
    await create.createPO({ body: { items }, user: customer }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.data.po_number, '001/PO/AC/2026');

    const header = calls.find((c) => c[0] === 'sql' && /INSERT INTO sipuro_db\.po_headers/.test(c[1]));
    assert.equal(header[2][7], 'Waiting for Confirmation');

    const iBegin = indexOf((c) => c[0] === 'begin');
    const iLock = indexOf((c) => c[0] === 'sql' && /po_settings.*FOR UPDATE/.test(c[1]));
    const iNumber = indexOf((c) => c[0] === 'genNumber');
    const iInsert = indexOf((c) => c[0] === 'sql' && /INSERT INTO sipuro_db\.po_headers/.test(c[1]));
    assert.ok(iBegin >= 0 && iBegin < iLock && iLock < iNumber && iNumber < iInsert,
        `urutan salah: ${[iBegin, iLock, iNumber, iInsert]}`);
    assert.equal(notifications.length, 1);

    reset();
    res = makeRes();
    await create.createPO({ body: { items, status: 'Draft' }, user: customer }, res);
    assert.equal(res.code, 200);
    assert.equal(notifications.length, 0);
});

test('createPO: nomor PO tidak dibuat jika validasi item gagal', async () => {
    reset();
    const res = makeRes();
    await create.createPO({ body: { items: [{ id_product: 1, qty: 1.5 }] }, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(has('genNumber'), false);
    assert.equal(has('begin'), false);
});

test('updatePO: status tidak sah ditolak sebelum transaksi', async () => {
    reset();
    const res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items, status: 'Approved' }, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.message, 'Invalid PO status.');
    assert.equal(has('begin'), false);
});

test('updatePO: PO yang sudah dikirim tidak boleh kembali ke Draft', async () => {
    reset({ status: 'Waiting for Confirmation' });
    const res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items, status: 'Draft' }, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.message, 'A submitted PO cannot be changed back to Draft.');
    assert.equal(has('rollback'), true);
    assert.equal(has('commit'), false);
    assert.equal(headerUpdate(), undefined);
});

test('updatePO: baris PO dikunci (FOR UPDATE) di dalam satu transaksi', async () => {
    reset({ status: 'Draft' });
    const res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items, status: 'Draft' }, user: customer }, res);
    assert.equal(res.code, 200);
    const iBegin = indexOf((c) => c[0] === 'begin');
    const iLock = indexOf((c) => c[0] === 'sql' && /po_headers.*FOR UPDATE/.test(c[1]));
    assert.ok(iBegin >= 0 && iBegin < iLock);
    assert.equal(calls.filter((c) => c[0] === 'begin').length, 1);
    assert.equal(has('commit'), true);
});

test('updatePO: PPN PO Waiting memakai PPN tersimpan, PO Draft memakai PPN perusahaan saat ini', async () => {
    reset({ status: 'Waiting for Confirmation', ppn: '11.00' });
    let res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items: [{ id_product: 1, qty: 3, po_detail_id: 10 }] }, user: customer }, res);
    assert.equal(res.code, 200);
    let header = headerUpdate();
    assert.equal(header[2][1], 11);     // ppn_percent
    assert.equal(header[2][0], 3000);   // subtotal
    assert.equal(header[2][2], 3330);   // total

    reset({ status: 'Draft', ppn: '11.00' });
    res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items, status: 'Waiting for Confirmation' }, user: customer }, res);
    header = headerUpdate();
    assert.equal(header[2][1], 12);
    assert.equal(header[2][2], 3360);
    assert.equal(calls.find((c) => c[0] === 'logHeader')[1].actionType, 'SUBMIT');
});

test('updatePO: status lain, PO milik pelanggan lain, atau PO tidak ada -> rollback', async () => {
    reset({ status: 'Approved' });
    let res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items }, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(has('rollback'), true);

    reset({ owner: 99 });
    res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items }, user: customer }, res);
    assert.equal(res.code, 404);
    assert.equal(has('rollback'), true);

    reset({ exists: false });
    res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items }, user: customer }, res);
    assert.equal(res.code, 404);
    assert.equal(has('rollback'), true);
});

test('updatePO: kesalahan validasi item -> 400 dan rollback', async () => {
    reset();
    const res = makeRes();
    await update.updatePO({ params: { id: 1 }, body: { items: [{ id_product: 1, qty: 0 }] }, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(has('rollback'), true);
    assert.equal(has('commit'), false);
});

test('cancelPO: Waiting dibatalkan, status lain ditolak, baris dikunci', async () => {
    reset();
    let res = makeRes();
    await update.cancelPO({ params: { id: 1 }, body: { reason: 'x' }, user: customer }, res);
    assert.equal(res.code, 200);
    assert.equal(has('commit'), true);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].message, /ACME/);
    assert.ok(calls.some((c) => c[0] === 'sql' && /po_headers.*FOR UPDATE/.test(c[1])));

    reset({ status: 'Approved' });
    res = makeRes();
    await update.cancelPO({ params: { id: 1 }, body: {}, user: customer }, res);
    assert.equal(res.code, 400);
    assert.equal(has('rollback'), true);
    assert.equal(has('commit'), false);

    reset({ owner: 99 });
    res = makeRes();
    await update.cancelPO({ params: { id: 1 }, body: {}, user: customer }, res);
    assert.equal(res.code, 404);
});

test('updatePOStatus (PPIC): hanya Approved/Rejected, hanya dari status Waiting', async () => {
    const ppic = { id: 3 };

    for (const status of ['Production Completed', 'Canceled', 'Draft', 'Waiting for Confirmation', 'x']) {
        reset();
        const res = makeRes();
        await statusController.updatePOStatus({ params: { id: 1 }, body: { status }, user: ppic }, res);
        assert.equal(res.code, 400, status);
        assert.equal(res.body.message, 'Status must be Approved or Rejected.');
        assert.equal(has('begin'), false);
    }

    reset({ status: 'Canceled' });
    let res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Approved' }, user: ppic }, res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /Waiting for Confirmation/);
    assert.equal(has('rollback'), true);
    assert.equal(has('commit'), false);

    reset({ status: 'Approved' });
    res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Rejected', notes: 'no' }, user: ppic }, res);
    assert.equal(res.code, 400);

    reset({ exists: false });
    res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Approved' }, user: ppic }, res);
    assert.equal(res.code, 404);
    assert.equal(has('rollback'), true);

    // Penolakan wajib disertai alasan.
    reset();
    res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Rejected' }, user: ppic }, res);
    assert.equal(res.code, 400);
    assert.equal(has('begin'), false);

    reset();
    res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Approved', notes: 'ok' }, user: ppic }, res);
    assert.equal(res.code, 200);
    assert.equal(has('commit'), true);
    assert.equal(calls.find((c) => c[0] === 'logHeader')[1].actionType, 'APPROVE');
    assert.ok(calls.some((c) => c[0] === 'sql' && /po_headers.*FOR UPDATE/.test(c[1])));

    reset();
    res = makeRes();
    await statusController.updatePOStatus({ params: { id: 1 }, body: { status: 'Rejected', notes: 'harga' }, user: ppic }, res);
    assert.equal(res.code, 200);
    assert.equal(calls.find((c) => c[0] === 'logHeader')[1].actionType, 'REJECT');
    assert.match(notifications[0].message, /rejected/);
});
