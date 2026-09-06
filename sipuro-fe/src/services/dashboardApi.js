import axios from 'axios';
import { API_BASE_URL } from './config';

// --- ENDPOINT DASHBOARD ---

export const getDashboardStats = async (
    mode = 'YTD',
    startDate = null,
    endDate = null,
    selectedYear = null,
    selectedMonth = null
) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/dashboard-stats`, {
            params: { mode, startDate, endDate, selectedYear, selectedMonth }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat statistik dasbor.' };
    }
};