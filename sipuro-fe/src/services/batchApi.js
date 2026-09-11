import axios from 'axios';
import { API_BASE_URL } from './config';

// --- ENDPOINT REKAP & ALOKASI BATCH ---

export const fetchUnassignedSummary = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/unassigned-summary`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching unassigned summary:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat rekap SKU.' };
    }
};

export const fetchBatchesBySku = async (id_product) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/batches-by-sku/${id_product}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching batches by SKU:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat batch eksisting.' };
    }
};

export const assignBatchBulk = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/batch/assign-batch-bulk`, payload);
        return response.data;
    } catch (error) {
        console.error('Error assigning batch bulk:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengalokasikan batch.' };
    }
};

export const fetchBatchMapping = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/batch-mapping`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat mapping batch.' };
    }
};

// --- ENDPOINT UNALLOCATED STOCKS ---

export const fetchUnallocatedStocks = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/unallocated`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching unallocated stocks:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat data stok lebihan.' };
    }
};

export const fetchOpenAllocationsByProduct = async (productId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/open-allocations/${productId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching open allocations:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat target alokasi.' };
    }
};

export const reallocateStockApi = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/batch/reallocate`, payload);
        return response.data;
    } catch (error) {
        console.error('Error reallocating stock:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengalokasikan stok lebihan.' };
    }
};

// --- EXPORT EXCEL ---

export const exportBatchExcelApi = async (params) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/export-batch-excel`, {
            params,
            responseType: 'blob'
        });

        let filename = 'Export_Batch.xlsx';
        const disposition = response.headers['content-disposition'];

        if (disposition && disposition.includes('filename=')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        return { success: true };
    } catch (error) {
        console.error('Export Excel Error:', error);
        return { success: false, message: 'Gagal mengunduh berkas Excel.' };
    }
};

// Update Allocation Status
export const updateAllocationStatusApi = async (allocationId, payload) => {
    try {
        const response = await axios.patch(`${API_BASE_URL}/batch/allocation/${allocationId}/status`, payload);
        return response.data;
    } catch (error) {
        console.error('Error updating allocation status:', error);
        return {
            success: false,
            message: error.response?.data?.message || 'Gagal mengubah status alokasi.'
        };
    }
};
