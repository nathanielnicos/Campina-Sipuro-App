import axios from 'axios';
import { API_BASE_URL } from './config';

// 1. Ambil data profil dengan membawa query params user_id & role
export const getProfile = async (userId, role) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/profile`, {
            params: { user_id: userId, role: role }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat profil.' };
    }
};

// 2. Update data profil dengan menyisipkan user_id & role ke payload
export const updateProfile = async (profileData) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/profile`, profileData);
        return response.data;
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memperbarui profil.' };
    }
};

// 3. Update password dengan menyisipkan user_id & role ke payload
export const updatePassword = async (passwordData) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/change-password`, passwordData);
        return response.data;
    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengganti kata sandi.' };
    }
};
