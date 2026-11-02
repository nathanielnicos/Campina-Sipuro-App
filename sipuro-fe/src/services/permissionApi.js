import axios from './apiClient';
import { API_BASE_URL } from './config';

const MY_URL = `${API_BASE_URL}/permissions`;
const ADMIN_URL = `${API_BASE_URL}/superadmin/access-permissions`;

// Izin pengguna yang sedang login (menu dan aksi)
export const getMyPermissions = async () => {
    const response = await axios.get(`${MY_URL}/me`);
    return response.data;
};

// Matriks izin lengkap (SUPERADMIN)
export const getAccessPermissions = async () => {
    const response = await axios.get(ADMIN_URL);
    return response.data;
};

// changes: [{ group, menu, action, allowed }]
export const saveAccessPermissions = async (changes) => {
    const response = await axios.put(ADMIN_URL, { changes });
    return response.data;
};

export const getAccessPermissionLogs = async (page = 1, limit = 20) => {
    const response = await axios.get(`${ADMIN_URL}/logs`, { params: { page, limit } });
    return response.data;
};
