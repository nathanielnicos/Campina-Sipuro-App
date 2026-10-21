import { apiClientSoft } from './apiClient';

// Semua fungsi mengembalikan body JSON server apa adanya (termasuk saat status 4xx),
// sama seperti perilaku versi fetch sebelumnya.
// Identitas pengguna (created_by, updated_by, dst.) kini dibaca server dari token login.

// signal (opsional): AbortSignal untuk membatalkan permintaan yang sudah tidak relevan.
export const fetchPOListApi = async (customerId, page = 1, limit = 10, filters = {}, signal) => {
    const {
        search = '',
        startDate = '',
        endDate = '',
        status = '',
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = filters;

    const res = await apiClientSoft.get('/po', {
        params: {
            customer_id: customerId || '',
            page,
            limit,
            search,
            startDate,
            endDate,
            status,
            sortBy,
            sortOrder
        },
        signal
    });
    return res.data;
};

export const fetchProducts = async () => {
    const res = await apiClientSoft.get('/products');
    return res.data;
};

export const fetchCustomerDetail = async (customerId) => {
    const res = await apiClientSoft.get(`/customers/${customerId}`);
    return res.data;
};

export const fetchCompanyProfile = async () => {
    const res = await apiClientSoft.get('/company-profile');
    return res.data;
};

export const fetchPODetail = async (poId) => {
    const res = await apiClientSoft.get(`/po/${poId}`);
    return res.data;
};

export const savePO = async (poId, payload) => {
    const res = poId
        ? await apiClientSoft.put(`/po/${poId}`, payload)
        : await apiClientSoft.post('/po', payload);
    return res.data;
};

// eslint-disable-next-line no-unused-vars
export const cancelPOApi = async (poId, canceledBy) => {
    const res = await apiClientSoft.patch(`/po/${poId}/cancel`, {});
    return res.data;
};

// eslint-disable-next-line no-unused-vars
export const updatePOStatusApi = async (poId, status, notes, updatedBy) => {
    const res = await apiClientSoft.put(`/po/${poId}/status`, { status, notes });
    return res.data;
};

export const exportPoExcelApi = async (customerId, filters = {}) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            status = ''
        } = filters;

        const res = await apiClientSoft.get('/po/export-excel', {
            params: {
                customer_id: customerId || '',
                search,
                startDate,
                endDate,
                status
            },
            responseType: 'blob'
        });
        if (res.status < 200 || res.status >= 300) throw new Error('Gagal mengunduh file Excel');

        // Ambil nama file langsung dari header Content-Disposition server
        let filename = 'PO_Recap.xlsx';
        const disposition = res.headers['content-disposition'];

        if (disposition && disposition.includes('filename=')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blob = new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
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
