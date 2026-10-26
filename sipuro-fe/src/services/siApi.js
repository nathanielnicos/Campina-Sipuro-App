import axios from './apiClient';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/si`;

export const fetchSalesInvoiceMapping = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}/mapping`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching SI mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch SI mapping data.' };
    }
};

export const previewSalesInvoiceApi = async (formData) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/preview`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error previewing SI file:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to read the SI file.' };
    }
};

export const confirmSalesInvoiceApi = async (payload) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/commit`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error confirming SI:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to save SI data.' };
    }
};
