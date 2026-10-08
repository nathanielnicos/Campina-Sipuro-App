import axios from 'axios';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/batch/production`;

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

// payload berupa FormData: file Excel yang sama dengan saat preview, userId, dan fingerprint hasil preview.
// Server menghitung ulang alokasi dari file tersebut dan menolak jika hasilnya berbeda dari preview.
export const confirmProductionApi = async (payload) => {
    try {
        const response = await axios.post(`${BASE_URL}/commit`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error confirming production:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal menyimpan data alokasi.' };
    }
};
