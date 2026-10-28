'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const statusCalls = [];
let syncedBatchIds = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    if (request === './lotStatusService') {
        return {
            refreshPOStatus: async (_c, id) => statusCalls.push(['po', id]),
            refreshBatchStatuses: async (_c, ids) => statusCalls.push(['batches', [...ids].sort((a, b) => a - b)]),
            recalculateFulfilledQty: async (_c, ids) => statusCalls.push(['recalc', ids]),
            syncAllocationStatuses: async (_c, args) => { statusCalls.push(['sync-status', args]); return syncedBatchIds; }
        };
    }
    return originalLoad.apply(this, arguments);
};
const svc = require(path.join('..', 'services/production-lot/lotAllocationAdjustService'));

/**
 * Koneksi tiruan. Alokasi yang diedit: id 9 (item PO 3, lot 5, batch 11, qty 30, Open).
 * Saudara: id 10 (lot 6, batch 12, qty 40, Open). Item PO: qty 100. Produksi bersih lot 5 / batch 11: 100,
 * alokasi PO lain pada pasangan itu: 20.
 */
const makeConn = (over = {}) => {
    const calls = [];
    const st = {
        found: { id: 9, po_detail_id: 3 },
        detail: { po_detail_id: 3, po_header_id: 30, id_product: 2, base_qty: 100, status: 'Active' },
        siblings: [
            { id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 30, status: 'Open' },
            { id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 40, status: 'Open' }
        ],
        header: { status: 'Approved' },
        net: 100,
        others: 20,
        ...over
    };
    return {
        calls,
        query: async (sql, params) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            calls.push({ sql: s, params });
            if (/^SELECT id, po_detail_id FROM po_lot_allocations WHERE id = \?$/.test(s)) return [[st.found]];
            if (/FROM po_details d WHERE d.po_detail_id = \?/.test(s)) return [[st.detail]];
            if (/FROM po_lot_allocations WHERE po_detail_id = \? ORDER BY id FOR UPDATE/.test(s)) return [st.siblings];
            if (/FROM po_headers WHERE po_header_id/.test(s)) return [[st.header]];
            if (/FROM lots l JOIN products p ON p.id_product = l.id_product CROSS JOIN batches b/.test(s)) return [[{ lot_number: 'L1', batch_number: 'B1', product_code: 'P1' }]];
            if (/FROM production_lot_upload_details/.test(s)) return [[{ net_qty: st.net }]];
            if (/WHERE lot_id = \? AND id_batch = \? AND id <> \?/.test(s)) return [[{ total: st.others }]];
            return [{}];
        }
    };
};
const find = (c, re) => c.calls.filter((x) => re.test(x.sql));
const ARGS = { allocationId: 9, newQty: 50, reason: 'Koreksi', userId: 4 };

test.beforeEach(() => { statusCalls.length = 0; syncedBatchIds = []; });

// ---------- parser input ----------

test('parseAllocationId', () => {
    assert.equal(svc.parseAllocationId('15'), 15);
    for (const bad of ['abc', '0', '-1', '1.5', '', undefined, null, '12abc', '9007199254740993']) {
        assert.throws(() => svc.parseAllocationId(bad), (e) => e.status === 400, String(bad));
    }
});

test('parseReason: wajib, dipangkas, maksimum 50 karakter', () => {
    assert.equal(svc.parseReason('  Koreksi  '), 'Koreksi');
    assert.equal(svc.parseReason('a'.repeat(50)).length, 50);
    for (const bad of [undefined, null, '', '   ', 5, {}, [], 'a'.repeat(51)]) {
        assert.throws(() => svc.parseReason(bad), (e) => e.status === 400, String(bad));
    }
});

test('parseNewQty: bilangan bulat >= 0 (angka atau teks digit)', () => {
    assert.equal(svc.parseNewQty(12), 12);
    assert.equal(svc.parseNewQty('12'), 12);
    assert.equal(svc.parseNewQty(' 7 '), 7);
    assert.equal(svc.parseNewQty(0), 0);
    assert.equal(svc.parseNewQty('2147483647'), 2147483647);
    for (const bad of [-1, 1.5, '1.5', '-1', '', '  ', 'abc', true, false, null, undefined, NaN, Infinity, 2147483648, '2147483648', '1e3', [], {}]) {
        assert.throws(() => svc.parseNewQty(bad), (e) => e.status === 400, String(bad));
    }
});

// ---------- ubah qty ----------

test('tambah qty: update, riwayat dengan alasan dan id_batch, sinkron saudara, hitung ulang, refresh', async () => {
    const c = makeConn();
    syncedBatchIds = [12];
    const out = await svc.adjustAllocationQty(c, ARGS);

    assert.deepEqual(out, { allocationId: 9, oldAllocatedQty: 30, newAllocatedQty: 50, status: 'Open' });
    assert.deepEqual(find(c, /^UPDATE po_lot_allocations SET allocated_qty/)[0].params, [50, 'Open', 4, 9]);

    const log = find(c, /po_lot_allocation_logs/)[0].params[0][0];
    assert.deepEqual([log[1], log[2], log[3], log[4], log[5], log[6], log[7], log[8], log[9], log[10], log[11]],
        [9, 3, 5, 11, 'UPDATE', 30, 50, 'Open', 'Open', 'Koreksi', 4]);

    const sync = statusCalls.find((x) => x[0] === 'sync-status')[1];
    assert.deepEqual([...sync.targetStatusByDetail.entries()], [[3, 'Open']]);
    assert.equal(sync.reason, 'Auto status sync after quantity edit');
    assert.deepEqual(statusCalls.find((x) => x[0] === 'recalc')[1], [3]);
    assert.deepEqual(statusCalls.find((x) => x[0] === 'batches')[1], [11, 12]);
    assert.deepEqual(statusCalls.find((x) => x[0] === 'po'), ['po', 30]);
});

test('urutan kunci: item PO dikunci dahulu, lalu alokasi (sama dengan commit upload)', async () => {
    const c = makeConn();
    await svc.adjustAllocationQty(c, ARGS);
    const idx = (re) => c.calls.findIndex((x) => re.test(x.sql));
    const detail = idx(/FROM po_details d WHERE/);
    const allocs = idx(/FROM po_lot_allocations WHERE po_detail_id = \? ORDER BY id FOR UPDATE/);
    assert.ok(detail >= 0 && allocs > detail);
    assert.match(c.calls[detail].sql, /d\.deleted_at IS NULL .*FOR UPDATE/);
});

test('mencapai qty PO: status target Closed dan dikirim ke sinkron saudara', async () => {
    const c = makeConn();
    const out = await svc.adjustAllocationQty(c, { ...ARGS, newQty: 60 }); // 40 saudara + 60 = 100
    assert.equal(out.status, 'Closed');
    assert.deepEqual(find(c, /^UPDATE po_lot_allocations SET allocated_qty/)[0].params, [60, 'Closed', 4, 9]);
    assert.deepEqual([...statusCalls.find((x) => x[0] === 'sync-status')[1].targetStatusByDetail.entries()], [[3, 'Closed']]);
});

test('kurangi qty dari alokasi Closed: kembali Open; qty nol diperbolehkan', async () => {
    const c = makeConn({ siblings: [
        { id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 60, status: 'Closed' },
        { id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 40, status: 'Closed' }
    ] });
    const out = await svc.adjustAllocationQty(c, { ...ARGS, newQty: 0 });
    assert.equal(out.status, 'Open');
    assert.deepEqual(find(c, /^UPDATE po_lot_allocations SET allocated_qty/)[0].params, [0, 'Open', 4, 9]);
});

test('alokasi Canceled tidak dihitung sebagai alokasi lain', async () => {
    const c = makeConn({ siblings: [
        { id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 30, status: 'Open' },
        { id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 90, status: 'Canceled' }
    ] });
    await assert.doesNotReject(svc.adjustAllocationQty(c, { ...ARGS, newQty: 80 })); // 80 <= capacity 80
});

test('melebihi qty PO ditolak 400 dengan batas maksimum; tidak ada tulis', async () => {
    const c = makeConn();
    await assert.rejects(svc.adjustAllocationQty(c, { ...ARGS, newQty: 61 }), (e) => e.status === 400 && /Maximum allowed for this allocation is 60/.test(e.message));
    assert.equal(find(c, /^UPDATE/).length, 0);
    assert.equal(find(c, /po_lot_allocation_logs/).length, 0);
    assert.equal(statusCalls.length, 0);
});

test('melebihi produksi bersih (lot, batch) ditolak 400 dengan batas maksimum', async () => {
    const c = makeConn({ net: 100, others: 60 }); // tersedia 40
    await assert.rejects(svc.adjustAllocationQty(c, { ...ARGS, newQty: 41 }), (e) => e.status === 400 && /produced quantity/.test(e.message) && /Maximum allowed for this allocation is 40/.test(e.message));
    assert.equal(find(c, /^UPDATE/).length, 0);
    await assert.doesNotReject(svc.adjustAllocationQty(makeConn({ net: 100, others: 60 }), { ...ARGS, newQty: 40 }));
});

test('qty sama dengan yang sekarang ditolak 400', async () => {
    const c = makeConn();
    await assert.rejects(svc.adjustAllocationQty(c, { ...ARGS, newQty: 30 }), (e) => e.status === 400 && /same as the current/.test(e.message));
});

test('keadaan yang tidak boleh diubah: 404 dan 409', async () => {
    const reject = (over, status, re) => assert.rejects(svc.adjustAllocationQty(makeConn(over), ARGS), (e) => e.status === status && re.test(e.message));
    const withStatus = (status) => ({ siblings: [{ id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 30, status }] });

    await reject({ found: undefined }, 404, /Allocation record not found/);
    await reject({ detail: undefined }, 404, /PO item not found/);
    await reject({ siblings: [{ id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 1, status: 'Open' }] }, 404, /Allocation record not found/);
    await reject(withStatus('Force Closed'), 409, /Force Closed and cannot be changed/);
    await reject(withStatus('Canceled'), 409, /Canceled and cannot be changed/);
    await reject({ detail: { po_detail_id: 3, po_header_id: 30, id_product: 2, base_qty: 100, status: 'Close Requested' } }, 409, /pending close request/);
    await reject({ detail: { po_detail_id: 3, po_header_id: 30, id_product: 2, base_qty: 100, status: 'Closed' } }, 409, /not active/);
    await reject({ header: { status: 'Draft' } }, 409, /not in a status/);
    await reject({ header: undefined }, 409, /not in a status/);
});

test('header Production Completed masih boleh diubah', async () => {
    await assert.doesNotReject(svc.adjustAllocationQty(makeConn({ header: { status: 'Production Completed' } }), ARGS));
});

// ---------- force close ----------

test('force close: status Force Closed, riwayat dengan alasan, refresh batch dan PO; qty tidak dihitung ulang', async () => {
    const c = makeConn();
    const out = await svc.forceCloseAllocation(c, { allocationId: 9, reason: 'Batch dibatalkan', userId: 4 });

    assert.deepEqual(out, { allocationId: 9, status: 'Force Closed' });
    assert.deepEqual(find(c, /^UPDATE po_lot_allocations SET status/)[0].params, ['Force Closed', 4, 9]);
    const log = find(c, /po_lot_allocation_logs/)[0].params[0][0];
    assert.deepEqual([log[1], log[4], log[6], log[7], log[8], log[9], log[10]], [9, 11, 30, 30, 'Open', 'Force Closed', 'Batch dibatalkan']);
    assert.deepEqual(statusCalls.find((x) => x[0] === 'batches')[1], [11]);
    assert.deepEqual(statusCalls.find((x) => x[0] === 'po'), ['po', 30]);
    assert.ok(!statusCalls.some((x) => x[0] === 'recalc' || x[0] === 'sync-status'));
});

test('force close ditolak bila item PO sudah terpenuhi penuh (>= qty PO)', async () => {
    const c = makeConn({ siblings: [
        { id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 60, status: 'Closed' },
        { id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 40, status: 'Closed' }
    ] });
    await assert.rejects(svc.forceCloseAllocation(c, { allocationId: 9, reason: 'x', userId: 4 }), (e) => e.status === 400 && /fully fulfilled/.test(e.message));
    assert.equal(find(c, /^UPDATE/).length, 0);
});

test('force close: alokasi Canceled tidak menghitung terpenuhi; keadaan lain sama seperti ubah qty', async () => {
    const c = makeConn({ siblings: [
        { id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 30, status: 'Open' },
        { id: 10, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 90, status: 'Canceled' }
    ] });
    await assert.doesNotReject(svc.forceCloseAllocation(c, { allocationId: 9, reason: 'x', userId: 4 }));

    const already = makeConn({ siblings: [{ id: 9, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 30, status: 'Force Closed' }] });
    await assert.rejects(svc.forceCloseAllocation(already, { allocationId: 9, reason: 'x', userId: 4 }), (e) => e.status === 409);
    await assert.rejects(svc.forceCloseAllocation(makeConn({ found: undefined }), { allocationId: 9, reason: 'x', userId: 4 }), (e) => e.status === 404);
    await assert.rejects(svc.forceCloseAllocation(makeConn({ detail: { po_detail_id: 3, po_header_id: 30, id_product: 2, base_qty: 100, status: 'Close Requested' } }), { allocationId: 9, reason: 'x', userId: 4 }), (e) => e.status === 409);
});

test('formatThousand: pemisah ribuan gaya Indonesia', () => {
    assert.equal(svc.formatThousand(1234567), '1.234.567');
    assert.equal(svc.formatThousand(0), '0');
});
