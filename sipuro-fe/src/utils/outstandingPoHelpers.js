// Fungsi murni untuk layar Outstanding PO (tanpa React, mudah dites).

export const MAX_REASON_LENGTH = 50;
export const PAGE_LIMIT = 10;

export const STATUS_OPTIONS = ['Active', 'Close Requested', 'Closed', 'Partially Closed'];

export const EMPTY_FILTERS = {
    product: '',
    po: '',
    status: '',
    fromDate: '',
    toDate: ''
};

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/** Susun parameter query untuk GET /outstanding-po; nilai kosong tidak dikirim. */
export const buildListParams = ({ page = 1, limit = PAGE_LIMIT, sortKey = '', sortOrder = 'asc', filters = {} }) => {
    const params = { page, limit };
    if (sortKey) {
        params.sortKey = sortKey;
        params.sortOrder = String(sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc';
    }
    const searchProduct = clean(filters.product);
    const searchPo = clean(filters.po);
    if (searchProduct) params.searchProduct = searchProduct;
    if (searchPo) params.searchPo = searchPo;
    if (clean(filters.status)) params.status = clean(filters.status);
    if (clean(filters.fromDate)) params.fromCreatedDate = clean(filters.fromDate);
    if (clean(filters.toDate)) params.toCreatedDate = clean(filters.toDate);
    return params;
};

/** Alasan close: wajib, maksimum 50 karakter (sama dengan server). */
export const validateReason = (text) => {
    const value = clean(text);
    if (!value) return { ok: false, value, message: 'Reason is required (maximum 50 characters).' };
    if (value.length > MAX_REASON_LENGTH) {
        return { ok: false, value, message: `Reason must be at most ${MAX_REASON_LENGTH} characters.` };
    }
    return { ok: true, value, message: '' };
};

/** Peran tampilan saja. Hak akses sebenarnya tetap dipaksa oleh server. */
export const getRoleFlags = (user) => {
    const role = String((user && user.role) || '').toUpperCase();
    const dept = String((user && user.department) || '').toUpperCase();
    return {
        isCustomer: role === 'CUSTOMER',
        isSuperadmin: role === 'SUPERADMIN',
        isPpic: dept === 'PPIC' && (role === 'STAFF' || role === 'MANAGER')
    };
};

/** Aksi yang boleh muncul pada satu item PO. */
export const getItemActions = (item, flags) => {
    if (!item || !flags) return [];
    if (flags.isCustomer && item.status === 'Active' && Number(item.remaining_qty) > 0) {
        return ['REQUEST_CLOSE'];
    }
    if (flags.isPpic && item.status === 'Close Requested') {
        return ['APPROVE_CLOSE', 'REJECT_CLOSE'];
    }
    return [];
};

/** Tautan notifikasi lama memakai ?po= atau ?search= dan ?product=. */
export const parseLegacyQuery = (search) => {
    const params = new URLSearchParams(search || '');
    return {
        product: clean(params.get('product') || ''),
        po: clean(params.get('po') || params.get('search') || '')
    };
};

export const getErrorMessage = (error, fallback) =>
    (error && error.response && error.response.data && error.response.data.message) || fallback;
