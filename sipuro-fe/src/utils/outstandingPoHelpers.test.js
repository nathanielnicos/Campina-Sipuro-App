import {
    buildListParams, validateReason, getActionFlags, getItemActions, parseLegacyQuery
} from './outstandingPoHelpers';

describe('buildListParams', () => {
    it('hanya mengirim filter yang terisi', () => {
        const p = buildListParams({ page: 2, filters: { product: ' abc ', po: '', status: 'Active', fromDate: '', toDate: '2026-01-02' } });
        expect(p).toEqual({ page: 2, limit: 10, searchProduct: 'abc', status: 'Active', toCreatedDate: '2026-01-02' });
    });
    it('menyertakan urutan hanya jika sortKey ada', () => {
        expect(buildListParams({ sortKey: 'total_po_count', sortOrder: 'DESC' }).sortOrder).toBe('desc');
        expect(buildListParams({}).sortKey).toBeUndefined();
    });
});

describe('validateReason', () => {
    it('menolak kosong dan terlalu panjang', () => {
        expect(validateReason('   ').ok).toBe(false);
        expect(validateReason('x'.repeat(51)).ok).toBe(false);
    });
    it('menerima 50 karakter dan memangkas spasi', () => {
        expect(validateReason('  ok  ')).toMatchObject({ ok: true, value: 'ok' });
        expect(validateReason('x'.repeat(50)).ok).toBe(true);
    });
});

describe('getActionFlags', () => {
    it('membaca izin create dan approve menu OUTSTANDING_PO', () => {
        const can = (menu, action) => menu === 'OUTSTANDING_PO' && action === 'create';
        expect(getActionFlags(can)).toEqual({ canRequestClose: true, canDecideClose: false });
        expect(getActionFlags(() => false)).toEqual({ canRequestClose: false, canDecideClose: false });
    });
});

describe('getItemActions', () => {
    const grants = (list) => getActionFlags((menu, action) => menu === 'OUTSTANDING_PO' && list.includes(action));
    const cust = grants(['create']);
    const ppic = grants(['approve']);
    const sa = grants([]);
    it('pemilik izin create hanya boleh mengajukan untuk item Active yang masih ada sisa', () => {
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, cust)).toEqual(['REQUEST_CLOSE']);
        expect(getItemActions({ status: 'Active', remaining_qty: 0 }, cust)).toEqual([]);
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, cust)).toEqual([]);
    });
    it('pemilik izin approve memutuskan hanya pada Close Requested', () => {
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, ppic)).toEqual(['APPROVE_CLOSE', 'REJECT_CLOSE']);
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, ppic)).toEqual([]);
    });
    it('tanpa izin hanya melihat', () => {
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, sa)).toEqual([]);
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, sa)).toEqual([]);
    });
});

describe('getItemActions dengan dua izin', () => {
    it('kelompok yang punya create dan approve mendapat aksi sesuai status item', () => {
        const both = getActionFlags((menu) => menu === 'OUTSTANDING_PO');
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, both)).toEqual(['REQUEST_CLOSE']);
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, both)).toEqual(['APPROVE_CLOSE', 'REJECT_CLOSE']);
    });
});

describe('parseLegacyQuery', () => {
    it('membaca po/search dan product', () => {
        expect(parseLegacyQuery('?po=PO-1&product=X')).toEqual({ product: 'X', po: 'PO-1' });
        expect(parseLegacyQuery('?search=PO-2')).toEqual({ product: '', po: 'PO-2' });
        expect(parseLegacyQuery('')).toEqual({ product: '', po: '' });
    });
});
