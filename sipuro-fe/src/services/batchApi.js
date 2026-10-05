import axios from 'axios';
import { API_BASE_URL } from './config';

// --- SUMMARY & BATCH ALLOCATION ENDPOINTS ---

export const fetchOutstandingSummary = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/outstanding-summary`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching outstanding summary:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch SKU summary.' };
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
        return { success: false, message: error.response?.data?.message || 'Failed to fetch batch mapping.' };
    }
};

// --- UNALLOCATED STOCKS ENDPOINTS ---

export const fetchUnallocatedStocks = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/unallocated`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching unallocated stocks:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch unallocated stock data.' };
    }
};

export const fetchOpenAllocationsByProduct = async (productId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/open-allocations/${productId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching open allocations:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch target allocation.' };
    }
};

export const reallocateStockApi = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/batch/reallocate`, payload);
        return response.data;
    } catch (error) {
        console.error('Error reallocating stock:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to reallocate stock.' };
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
        return { success: false, message: 'Failed to download Excel file.' };
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
            message: error.response?.data?.message || 'Failed to update allocation status.'
        };
    }
};

// Update Allocation Quantity
export const updateAllocationQtyApi = async (allocationId, payload) => {
    try {
        const response = await axios.patch(`${API_BASE_URL}/batch/allocation/${allocationId}/qty`, payload);
        return response.data;
    } catch (error) {
        console.error('Error updating allocation quantity:', error);
        return {
            success: false,
            message: error.response?.data?.message || 'Failed to update allocation quantity.'
        };
    }
};

// Fetch Allocation Log History
export const fetchAllocationLogsApi = async (allocationId, page = 1, limit = 10) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batch/allocation-logs/${allocationId}`, {
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching allocation logs:', error);
        return {
            success: false,
            message: error.response?.data?.message || 'Failed to fetch allocation log history.'
        };
    }
};
