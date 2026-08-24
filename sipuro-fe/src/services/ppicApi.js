import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const fetchUnassignedSummary = async (page = 1, limit = 10) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/ppic/unassigned-summary`, {
            params: { page, limit }
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

export const fetchBatchMapping = async (page = 1, limit = 10) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/ppic/batch-mapping`, {
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat mapping batch.' };
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
