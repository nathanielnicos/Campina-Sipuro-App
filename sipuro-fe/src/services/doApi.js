import axios from './apiClient';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/do`;

export const fetchDeliveryOrderMapping = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}/mapping`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching DO mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch DO mapping data.' };
    }
};

export const previewDeliveryOrderApi = async (formData) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/preview`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error previewing DO file:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to read the DO file.' };
    }
};

// payload berupa FormData: file Excel yang sama dengan saat preview, userId, dan fingerprint hasil preview.
// Server menghitung ulang alokasi dari file tersebut dan menolak jika hasilnya berbeda dari preview.
export const confirmDeliveryOrderApi = async (payload) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/commit`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error confirming DO:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to save allocation data.' };
    }
};
