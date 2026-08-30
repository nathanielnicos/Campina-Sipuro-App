import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/upload/production';

export const previewProductionApi = async (formData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/preview`, formData, {
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
        const response = await axios.post(`${API_BASE_URL}/commit`, payload);
        return response.data;
    } catch (error) {
        console.error('Error confirming production:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal menyimpan data alokasi.' };
    }
};
