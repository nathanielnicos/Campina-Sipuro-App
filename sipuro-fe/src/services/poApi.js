import { API_BASE_URL } from './config';

export const fetchPOListApi = async (customerId, page = 1, limit = 10, filters = {}) => {
    const {
        search = '',
        startDate = '',
        endDate = '',
        status = '',
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = filters;

    const params = new URLSearchParams({
        customer_id: customerId || '',
        page,
        limit,
        search,
        startDate,
        endDate,
        status,
        sortBy,
        sortOrder
    });

    const res = await fetch(`${API_BASE_URL}/po?${params.toString()}`);
    return await res.json();
};

export const fetchProducts = async () => {
    const res = await fetch(`${API_BASE_URL}/products`);
    return await res.json();
};

export const fetchCustomerDetail = async (customerId) => {
    const res = await fetch(`${API_BASE_URL}/customers/${customerId}`);
    return await res.json();
};

export const fetchCompanyProfile = async () => {
    const res = await fetch(`${API_BASE_URL}/company-profile`);
    return await res.json();
};

export const fetchPODetail = async (poId) => {
    const res = await fetch(`${API_BASE_URL}/po/${poId}`);
    return await res.json();
};

export const savePO = async (poId, payload) => {
    const url = poId ? `${API_BASE_URL}/po/${poId}` : `${API_BASE_URL}/po`;
    const method = poId ? 'PUT' : 'POST';
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
};

export const cancelPOApi = async (poId, canceledBy) => {
    const res = await fetch(`${API_BASE_URL}/po/${poId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canceled_by: canceledBy })
    });
    return await res.json();
};

export const updatePOStatusApi = async (poId, status, notes, updatedBy) => {
    const res = await fetch(`${API_BASE_URL}/po/${poId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, updated_by: updatedBy })
    });
    return await res.json();
};

export const exportPoExcelApi = async (customerId, filters = {}) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            status = ''
        } = filters;

        const params = new URLSearchParams({
            customer_id: customerId || '',
            search,
            startDate,
            endDate,
            status
        });

        const res = await fetch(`${API_BASE_URL}/po/export-excel?${params.toString()}`);
        if (!res.ok) throw new Error('Gagal mengunduh file Excel');

        // Ambil nama file langsung dari header Content-Disposition server
        let filename = 'PO_Recap.xlsx';
        const disposition = res.headers.get('Content-Disposition');

        if (disposition && disposition.includes('filename=')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { success: true };
    } catch (error) {
        console.error('Error downloading PO excel:', error);
        return { success: false, message: error.message };
    }
};

/**
 * API FITUR CLOSE PO DETAIL ITEMS
 */

// 1. Customer mengajukan penutupan detail item
export const requestClosePoDetailsApi = async (poHeaderId, poDetailIds, reason, requestedBy) => {
    const res = await fetch(`${API_BASE_URL}/po/details/request-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            po_header_id: poHeaderId,
            po_detail_ids: poDetailIds,
            reason,
            requested_by: requestedBy
        })
    });
    return await res.json();
};

// 2. PPIC menyetujui pengajuan penutupan detail item
export const approveClosePoDetailsApi = async (poHeaderId, poDetailIds, approvedBy) => {
    const res = await fetch(`${API_BASE_URL}/po/details/approve-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            po_header_id: poHeaderId,
            po_detail_ids: poDetailIds,
            approved_by: approvedBy
        })
    });
    return await res.json();
};

// 3. PPIC menolak pengajuan penutupan detail item
export const rejectClosePoDetailsApi = async (poHeaderId, poDetailIds, rejectReason, rejectedBy) => {
    const res = await fetch(`${API_BASE_URL}/po/details/reject-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            po_header_id: poHeaderId,
            po_detail_ids: poDetailIds,
            reject_reason: rejectReason,
            rejected_by: rejectedBy
        })
    });
    return await res.json();
};
