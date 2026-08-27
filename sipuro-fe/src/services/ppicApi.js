import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// --- ENDPOINT DASHBOARD PPIC ---

export const getPPICDashboardStats = async (mode = 'YTD', startDate = null, endDate = null) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/ppic/dashboard-stats`, {
            params: { mode, startDate, endDate }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching PPIC dashboard stats:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat statistik dasbor.' };
    }
};

// --- ENDPOINT REKAP & ALOKASI BATCH ---

export const fetchUnassignedSummary = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/ppic/unassigned-summary`, {
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
        const response = await axios.get(`${API_BASE_URL}/ppic/batches-by-sku/${id_product}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching batches by SKU:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat batch eksisting.' };
    }
};

export const assignBatchBulk = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/ppic/assign-batch-bulk`, payload);
        return response.data;
    } catch (error) {
        console.error('Error assigning batch bulk:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengalokasikan batch.' };
    }
};

export const fetchBatchMapping = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/ppic/batch-mapping`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat mapping batch.' };
    }
};

// --- ENDPOINT UNALLOCATED STOCKS ---

export const fetchUnallocatedStocks = async (page = 1, limit = 10, searchStock = '', prodDate = '') => {
    try {
        let params = { page, limit };

        // Fleksibel: Menerima argumen berupa Objek filters maupun String individual
        if (typeof searchStock === 'object' && searchStock !== null) {
            const filters = searchStock;
            params.searchStock = filters.searchStock || filters.search || '';
            params.prodDate = filters.prodDate || '';
        } else {
            if (searchStock) params.searchStock = searchStock;
            if (prodDate) params.prodDate = prodDate;
        }

        const response = await axios.get(`${API_BASE_URL}/batches/unallocated`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching unallocated stocks:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat data stok lebihan.' };
    }
};

export const fetchOpenAllocationsByProduct = async (productId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/batches/open-allocations/${productId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching open allocations:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat target alokasi.' };
    }
};

export const reallocateStockApi = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/batches/reallocate`, payload);
        return response.data;
    } catch (error) {
        console.error('Error reallocating stock:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengalokasikan stok lebihan.' };
    }
};

// --- ENDPOINT TERHUBUNG KE UPLOAD CONTROLLER ---

export const previewProductionApi = async (formData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/upload/preview`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error previewing production file:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal membaca file produksi.' };
    }
};

export const confirmProductionApi = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/upload/commit`, payload);
        return response.data;
    } catch (error) {
        console.error('Error confirming production:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal menyimpan data alokasi.' };
    }
};
