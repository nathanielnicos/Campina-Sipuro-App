import {
    buildListParams, validateReason, getRoleFlags, getItemActions, parseLegacyQuery
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

describe('getItemActions', () => {
    const cust = getRoleFlags({ role: 'CUSTOMER' });
    const ppic = getRoleFlags({ role: 'STAFF', department: 'PPIC' });
    const sa = getRoleFlags({ role: 'SUPERADMIN' });
    it('customer hanya boleh mengajukan untuk item Active yang masih ada sisa', () => {
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, cust)).toEqual(['REQUEST_CLOSE']);
        expect(getItemActions({ status: 'Active', remaining_qty: 0 }, cust)).toEqual([]);
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, cust)).toEqual([]);
    });
    it('PPIC memutuskan hanya pada Close Requested', () => {
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, ppic)).toEqual(['APPROVE_CLOSE', 'REJECT_CLOSE']);
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, ppic)).toEqual([]);
    });
    it('superadmin hanya melihat', () => {
        expect(getItemActions({ status: 'Close Requested', remaining_qty: 5 }, sa)).toEqual([]);
        expect(getItemActions({ status: 'Active', remaining_qty: 5 }, sa)).toEqual([]);
    });
});

describe('parseLegacyQuery', () => {
    it('membaca po/search dan product', () => {
        expect(parseLegacyQuery('?po=PO-1&product=X')).toEqual({ product: 'X', po: 'PO-1' });
        expect(parseLegacyQuery('?search=PO-2')).toEqual({ product: '', po: 'PO-2' });
        expect(parseLegacyQuery('')).toEqual({ product: '', po: '' });
    });
});
