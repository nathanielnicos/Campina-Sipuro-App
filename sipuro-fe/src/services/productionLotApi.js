import axios from './apiClient';
import { API_BASE_URL } from './config';
import { saveBlobResponse, readBlobErrorMessage } from '../utils/downloadBlob';

const BASE_URL = `${API_BASE_URL}/production-lot`;

export const fetchLotMapping = async (page = 1, limit = 10, filters = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}/mapping`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching lot mapping:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch lot mapping.' };
    }
};

export const previewProductionLotApi = async (formData) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/preview`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error previewing production file:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to read the production file.' };
    }
};

// payload berupa FormData: file Excel yang sama dengan saat preview, userId, dan fingerprint hasil preview.
// Server menghitung ulang alokasi dari file tersebut dan menolak jika hasilnya berbeda dari preview.
export const confirmProductionLotApi = async (payload) => {
    try {
        const response = await axios.post(`${BASE_URL}/upload/commit`, payload, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error confirming production:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to save allocation data.' };
    }
};

// Ekspor mapping ke Excel dengan filter yang sama dengan daftar mapping (tanpa halaman dan urutan).
export const exportLotExcelApi = async (filters = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}/export`, {
            params: filters,
            responseType: 'blob'
        });
        saveBlobResponse(response, 'Export_Production_Lot.xlsx');
        return { success: true };
    } catch (error) {
        console.error('Error exporting lot mapping:', error);
        return {
            success: false,
            message: await readBlobErrorMessage(error, 'Failed to download Excel file.')
        };
    }
};

// Ubah qty alokasi. payload: { newAllocatedQty, reason }. Pelaku dari token login di server.
export const updateLotAllocationQtyApi = async (allocationId, payload) => {
    try {
        const response = await axios.patch(`${BASE_URL}/allocations/${allocationId}/qty`, payload);
        return response.data;
    } catch (error) {
        console.error('Error updating allocation quantity:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to update allocated quantity.' };
    }
};

export const fetchLotAllocationLogsApi = async (allocationId, page = 1, limit = 10) => {
    try {
        const response = await axios.get(`${BASE_URL}/allocations/${allocationId}/logs`, {
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching allocation logs:', error);
        return { success: false, message: error.response?.data?.message || 'Failed to fetch allocation history.' };
    }
};
