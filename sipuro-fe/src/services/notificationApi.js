import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/notifications`;

export const getUnreadCount = async (role, userId, department) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (userId) params.append('userId', userId);
    if (department) params.append('department', department);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/unread-count${query}`);
    return await res.json();
};

export const getNotifications = async (role, userId, department) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (userId) params.append('userId', userId);
    if (department) params.append('department', department);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}${query}`);
    return await res.json();
};

export const markAsRead = async (id) => {
    const res = await fetch(`${BASE_URL}/${id}/read`, { method: 'PATCH' });
    return await res.json();
};
