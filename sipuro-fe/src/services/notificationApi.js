import { apiClientSoft } from './apiClient';

const BASE_PATH = '/notifications';

// Penerima notifikasi kini ditentukan server dari token login.
// Parameter role/userId/department dipertahankan hanya agar pemanggil lama tidak berubah; nilainya diabaikan.
// eslint-disable-next-line no-unused-vars
export const getUnreadCount = async (role, userId, department) => {
    const res = await apiClientSoft.get(`${BASE_PATH}/unread-count`);
    return res.data;
};

// eslint-disable-next-line no-unused-vars
export const getNotifications = async (role, userId, department, page = 1, limit = 10) => {
    const res = await apiClientSoft.get(BASE_PATH, { params: { page, limit } });
    return res.data;
};

export const markAsRead = async (id) => {
    const res = await apiClientSoft.patch(`${BASE_PATH}/${id}/read`);
    return res.data;
};

// eslint-disable-next-line no-unused-vars
export const markAllAsRead = async (role, userId, department) => {
    const res = await apiClientSoft.put(`${BASE_PATH}/mark-all-read`);
    return res.data;
};
