import axios from 'axios';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/upload/production`;

export const previewProductionApi = async (formData) => {
    try {
        const response = await axios.post(`${BASE_URL}/preview`, formData, {
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
        const response = await axios.post(`${BASE_URL}/commit`, payload);
        return response.data;
    } catch (error) {
        console.error('Error confirming production:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal menyimpan data alokasi.' };
    }
};
