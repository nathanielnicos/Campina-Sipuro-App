import apiClient from './apiClient';

// 1. Ambil data profil milik pengguna yang sedang login (identitas dibaca server dari token)
export const getProfile = async () => {
    try {
        const response = await apiClient.get('/profile');
        return response.data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal memuat profil.' };
    }
};

// 2. Ganti password milik pengguna yang sedang login
export const updatePassword = async (passwordData) => {
    try {
        const response = await apiClient.put('/change-password', passwordData);
        return response.data;
    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: error.response?.data?.message || 'Gagal mengganti kata sandi.' };
    }
};
