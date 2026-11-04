import axios from './apiClient';
import { API_BASE_URL } from './config';
import { saveBlobResponse, readBlobErrorMessage } from '../utils/downloadBlob';

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

// Perkiraan PO (FIFO per lot) untuk DO yang sedang tampil; hanya baca
export const fetchEstimatedPo = async (doIds = []) => {
    try {
        const response = await axios.get(`${BASE_URL}/estimated-po`, { params: { doIds: doIds.join(',') } });
        return response.data;
    } catch (error) {
        console.error('Error fetching estimated PO:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch estimated PO.' };
    }
};

// Ekspor DO ke Excel (pengiriman, retur, saldo lot) dengan filter yang sama dengan daftar (tanpa halaman dan mode tampilan)
export const exportDeliveryOrderExcelApi = async (filters = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}/export`, {
            params: filters,
            responseType: 'blob'
        });
        saveBlobResponse(response, 'Export_Delivery_Order.xlsx');
        return { success: true };
    } catch (error) {
        console.error('Error exporting DO:', error);
        return {
            success: false,
            message: await readBlobErrorMessage(error, 'Failed to download Excel file.')
        };
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

// payload berupa FormData: file Excel yang sama dengan saat preview dan fingerprint hasil preview.
// Server menghitung ulang dari file tersebut dan menolak jika hasilnya berbeda dari preview.
// Pelaku diambil server dari token login (bukan dari payload).
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
