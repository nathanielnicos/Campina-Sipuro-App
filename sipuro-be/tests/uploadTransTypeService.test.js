'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('../services/upload-trans-type/uploadTransTypeService');

const makeConn = ({ rows = [], used = { LOT: [], DO: [] }, dup = false, taken = [] } = {}) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            calls.push({ sql: s, params });
            if (/^SELECT id, scope, trans_type, direction, match_by, is_active FROM upload_trans_types ORDER BY/.test(s)) return [rows];
            if (/^SELECT DISTINCT trans_type FROM production_lot_upload_details/.test(s)) return [used.LOT.map((t) => ({ trans_type: t }))];
            if (/^SELECT DISTINCT trans_type FROM delivery_order_upload_details/.test(s)) return [used.DO.map((t) => ({ trans_type: t }))];
            if (/^SELECT id FROM upload_trans_types WHERE scope/.test(s)) return [taken.includes(params[1]) ? [{ id: 99 }] : []];
            if (/^SELECT id, scope, trans_type, direction, match_by, is_active FROM upload_trans_types WHERE id = \? FOR UPDATE/.test(s)) return [rows.filter((r) => r.id === params[0])];
            if (/^SELECT 1 FROM (production_lot|delivery_order)_upload_details WHERE trans_type COLLATE/.test(s)) {
                const scope = /production_lot/.test(s) ? 'LOT' : 'DO';
                return [used[scope].some((t) => t.toLowerCase() === String(params[0]).toLowerCase()) ? [{ 1: 1 }] : []];
            }
            if (/^INSERT INTO upload_trans_types/.test(s)) {
                if (dup) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
                return [{ insertId: 50 }];
            }
            if (/^UPDATE upload_trans_types/.test(s)) {
                if (dup) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
                return [{}];
            }
            return [[]];
        }
    };
};
const row = (id, scope, trans_type, direction, match_by = 'BATCH_LOT', is_active = 1) => ({ id, scope, trans_type, direction, match_by, is_active });

test('parseTypeId: ID bilangan bulat positif', () => {
    assert.equal(svc.parseTypeId('3'), 3);
    for (const bad of ['0', '-1', 'x', '', undefined, '1.5']) assert.throws(() => svc.parseTypeId(bad), (e) => e.status === 400);
});

test('parseCreateBody: scope selalu LOT, nama dirapikan, validasi arah dan cara cocok', () => {
    assert.deepEqual(svc.parseCreateBody({ transType: '  Good   Issue Lab ', direction: 'OUT', matchBy: 'LOT' }),
        { scope: 'LOT', transType: 'Good Issue Lab', direction: 'OUT', matchBy: 'LOT' });
    // jenis baru selalu non-produksi: matchBy dari klien diabaikan, scope dari klien diabaikan
    assert.equal(svc.parseCreateBody({ transType: 'X', direction: 'OUT', matchBy: 'BATCH_LOT', scope: 'DO' }).matchBy, 'LOT');
    assert.equal(svc.parseCreateBody({ transType: 'X', direction: 'OUT', scope: 'DO' }).scope, 'LOT');
    for (const bad of [{}, { transType: '', direction: 'OUT', matchBy: 'LOT' }, { transType: 'X', direction: 'IN', matchBy: 'LOT' },
        { transType: 'X', direction: 'IN', matchBy: 'BATCH_LOT' }, { transType: 'X', direction: 'IN' },
        { transType: 'X', direction: 'UP', matchBy: 'LOT' }, { transType: 'a'.repeat(51), direction: 'OUT', matchBy: 'LOT' }]) {
        assert.throws(() => svc.parseCreateBody(bad), (e) => e.status === 400, JSON.stringify(bad));
    }
});

test('parseUpdateBody: isActive harus boolean sungguhan, minimal satu isian', () => {
    assert.deepEqual(svc.parseUpdateBody({ isActive: false }), { isActive: false });
    assert.deepEqual(svc.parseUpdateBody({ transType: ' A  B ', direction: 'OUT', matchBy: 'LOT' }), { transType: 'A B', direction: 'OUT', matchBy: 'LOT' });
    for (const bad of [{}, undefined, { isActive: 'true' }, { isActive: 1 }]) assert.throws(() => svc.parseUpdateBody(bad), (e) => e.status === 400);
});

test('daftar: penanda sudah dipakai per scope, tidak peka huruf besar/kecil', async () => {
    const c = makeConn({
        rows: [row(1, 'LOT', 'WIP Issue', 'OUT', 'LOT'), row(2, 'LOT', 'WIP Completion', 'IN'), row(6, 'DO', 'Sales Order Issue', 'OUT')],
        used: { LOT: ['wip issue'], DO: ['Sales order issue'] }
    });
    const out = await svc.listTransTypes(c);
    assert.deepEqual(out.map((r) => [r.id, r.in_use, r.is_active]), [[1, true, true], [2, false, true], [6, true, true]]);
});

test('tambah: nama bebas, dicatat pelaku, scope LOT; duplikat (abaikan huruf) ditolak 409', async () => {
    const c = makeConn();
    const out = await svc.createTransType(c, { transType: 'Good Issue Lab', direction: 'OUT', matchBy: 'LOT', userId: 4 });
    assert.deepEqual(out, { id: 50, scope: 'LOT', trans_type: 'Good Issue Lab', direction: 'OUT', match_by: 'LOT', is_active: true, in_use: false });
    const ins = c.calls.find((x) => /^INSERT/.test(x.sql));
    assert.deepEqual(ins.params, ['LOT', 'Good Issue Lab', 'good issue lab', 'OUT', 'LOT', 4, 4]);

    await assert.rejects(svc.createTransType(makeConn({ taken: ['good issue lab'] }), { transType: 'GOOD ISSUE LAB', direction: 'OUT', matchBy: 'LOT', userId: 4 }), (e) => e.status === 409);
    await assert.rejects(svc.createTransType(makeConn({ dup: true }), { transType: 'Z', direction: 'OUT', matchBy: 'LOT', userId: 4 }), (e) => e.status === 409);
});

test('ubah: aktif/nonaktif boleh untuk semua scope, termasuk yang sudah dipakai', async () => {
    const c = makeConn({ rows: [row(6, 'DO', 'Sales Order Issue', 'OUT')], used: { LOT: [], DO: ['Sales order issue'] } });
    const out = await svc.updateTransType(c, { id: 6, patch: { isActive: false }, userId: 4 });
    assert.equal(out.is_active, false);
    assert.equal(out.in_use, true);
    const upd = c.calls.find((x) => /^UPDATE/.test(x.sql));
    assert.deepEqual(upd.params, ['Sales Order Issue', 'sales order issue', 'OUT', 'BATCH_LOT', 0, 4, 6]);
});

test('ubah definisi: boleh bila belum dipakai; ditolak bila sudah dipakai atau scope DO', async () => {
    const free = makeConn({ rows: [row(7, 'LOT', 'Old Name', 'OUT', 'LOT')] });
    const out = await svc.updateTransType(free, { id: 7, patch: { transType: 'New Name', direction: 'OUT' }, userId: 4 });
    assert.equal(out.trans_type, 'New Name');
    assert.equal(out.match_by, 'LOT');

    const used = makeConn({ rows: [row(1, 'LOT', 'WIP Issue', 'OUT', 'LOT')], used: { LOT: ['WIP Issue'], DO: [] } });
    await assert.rejects(svc.updateTransType(used, { id: 1, patch: { direction: 'IN' }, userId: 4 }), (e) => e.status === 409 && /already been used/.test(e.message));
    assert.equal(used.calls.some((x) => /^UPDATE/.test(x.sql)), false);

    const doRow = makeConn({ rows: [row(6, 'DO', 'Sales Order Issue', 'OUT')] });
    await assert.rejects(svc.updateTransType(doRow, { id: 6, patch: { transType: 'Other' }, userId: 4 }), (e) => e.status === 409 && /Delivery Order/.test(e.message));
});

test('ubah: validasi (lot-item hanya OUT), nama bentrok, tidak ditemukan, tidak ada perubahan', async () => {
    const r = row(7, 'LOT', 'Old Name', 'OUT', 'BATCH_LOT');
    const lotRow = row(7, 'LOT', 'Old Name', 'OUT', 'LOT');
    await assert.rejects(svc.updateTransType(makeConn({ rows: [lotRow] }), { id: 7, patch: { direction: 'IN' }, userId: 4 }), (e) => e.status === 400);
    await assert.rejects(svc.updateTransType(makeConn({ rows: [r], taken: ['other'] }), { id: 7, patch: { transType: 'Other' }, userId: 4 }), (e) => e.status === 409);
    await assert.rejects(svc.updateTransType(makeConn({ rows: [r] }), { id: 8, patch: { isActive: false }, userId: 4 }), (e) => e.status === 404);
    await assert.rejects(svc.updateTransType(makeConn({ rows: [r] }), { id: 7, patch: { isActive: true }, userId: 4 }), (e) => e.status === 400);
});

test('ubah: cara cocok tidak bisa diganti (produksi dan non-produksi tetap terpisah); nilai yang sama diterima', async () => {
    const prod = makeConn({ rows: [row(2, 'LOT', 'WIP Completion', 'IN', 'BATCH_LOT')] });
    await assert.rejects(svc.updateTransType(prod, { id: 2, patch: { matchBy: 'LOT', direction: 'OUT' }, userId: 4 }), (e) => e.status === 409 && /cannot be changed/.test(e.message));
    assert.equal(prod.calls.some((x) => /^UPDATE/.test(x.sql)), false);

    const lot = makeConn({ rows: [row(7, 'LOT', 'Old Name', 'OUT', 'LOT')] });
    await assert.rejects(svc.updateTransType(lot, { id: 7, patch: { matchBy: 'BATCH_LOT' }, userId: 4 }), (e) => e.status === 409);
    const same = makeConn({ rows: [row(7, 'LOT', 'Old Name', 'OUT', 'LOT')] });
    const out = await svc.updateTransType(same, { id: 7, patch: { matchBy: 'LOT', transType: 'New Name' }, userId: 4 });
    assert.equal(out.match_by, 'LOT');
});
