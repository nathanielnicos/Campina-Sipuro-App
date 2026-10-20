'use strict';

/**
 * Aturan murni untuk alur "Close PO Item" (tanpa akses database, mudah dites).
 * Semua pelanggaran dilempar sebagai BusinessError agar pesannya aman ditampilkan ke pengguna.
 */

const { BusinessError } = require('../businessError');

const MAX_REASON_LENGTH = 50;
const CONFLICT_MESSAGE = 'This item was just updated by someone else. Please refresh and try again.';

const notFound = () => new BusinessError('PO item not found.', 404);

/** po_detail_id dari URL: harus bilangan bulat positif. */
const parsePoDetailId = (value) => {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!/^\d{1,10}$/.test(text) || Number(text) <= 0) {
        throw new BusinessError('A valid PO item ID is required.', 400);
    }
    return Number(text);
};

/** Alasan close: wajib teks, tidak kosong, maksimum 50 karakter (sesuai kolom dan layar). */
const parseReason = (value) => {
    const reason = typeof value === 'string' ? value.trim() : '';
    if (!reason) {
        throw new BusinessError('Reason for close request is required (maximum 50 characters).', 400);
    }
    if (reason.length > MAX_REASON_LENGTH) {
        throw new BusinessError(`Reason must be at most ${MAX_REASON_LENGTH} characters.`, 400);
    }
    return reason;
};

/** Customer hanya boleh memproses item milik perusahaannya. Selain itu dijawab "tidak ditemukan". */
const assertOwnedByCustomer = (header, user) => {
    if (!user || user.type !== 'CUSTOMER' || !user.customerId
        || Number(header.customer_id) !== Number(user.customerId)) {
        throw notFound();
    }
};

/** Pengajuan close hanya untuk PO berstatus Approved. */
const assertHeaderApproved = (header) => {
    if (header.status !== 'Approved') {
        throw new BusinessError('Close requests can only be submitted for Approved POs.', 400);
    }
};

/**
 * Keputusan PPIC (approve/reject) diterima untuk Approved dan Production Completed,
 * agar data lama yang tidak konsisten tidak membuat pengajuan tersangkut.
 */
const assertHeaderOpenForDecision = (header) => {
    if (!['Approved', 'Production Completed'].includes(header.status)) {
        throw new BusinessError('This PO is not in a status that allows close decisions.', 400);
    }
};

/** Item harus Active dan masih punya sisa yang bisa ditutup. */
const assertCanRequestClose = (detail) => {
    if (detail.status === 'Close Requested') {
        throw new BusinessError('A close request for this item is already pending.', 409);
    }
    if (detail.status === 'Closed' || detail.status === 'Partially Closed') {
        throw new BusinessError('This item has already been closed.', 409);
    }
    if (detail.status !== 'Active') {
        throw new BusinessError('This item cannot be closed.', 400);
    }
    if ((Number(detail.fulfilled_qty) || 0) >= (Number(detail.base_qty) || 0)) {
        throw new BusinessError('This item has already been fully produced, so there is nothing left to close.', 400);
    }
};

/** Approve/reject hanya untuk item yang benar-benar sedang diajukan. */
const assertPendingClose = (detail) => {
    if (detail.status !== 'Close Requested') {
        throw new BusinessError('There is no pending close request for this item.', 409);
    }
};

/** Belum ada hasil produksi -> Closed; sudah ada sebagian -> Partially Closed. */
const targetStatusOnApprove = (detail) => ((Number(detail.fulfilled_qty) || 0) > 0 ? 'Partially Closed' : 'Closed');

module.exports = {
    MAX_REASON_LENGTH,
    CONFLICT_MESSAGE,
    parsePoDetailId,
    parseReason,
    assertOwnedByCustomer,
    assertHeaderApproved,
    assertHeaderOpenForDecision,
    assertCanRequestClose,
    assertPendingClose,
    targetStatusOnApprove
};
