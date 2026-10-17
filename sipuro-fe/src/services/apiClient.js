import axios from 'axios';
import { API_BASE_URL } from './config';

const TOKEN_KEY = 'sipuro_token';
const USER_KEY = 'sipuro_user';

// Kode error 401 dari server yang berarti sesi memang tidak berlaku lagi.
// 401 tanpa kode ini (mis. dari layanan lain) TIDAK memicu logout otomatis.
const SESSION_ERROR_CODES = ['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_UNAVAILABLE'];

export const SESSION_EXPIRED_EVENT = 'sipuro:session-expired';

export const getToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
        return null;
    }
};

export const setToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
        // penyimpanan browser tidak tersedia: sesi hanya berlaku sampai halaman dimuat ulang
    }
};

export const clearSession = () => {
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch (e) {
        // abaikan
    }
};

const handleSessionError = (response) => {
    if (response && response.status === 401 && SESSION_ERROR_CODES.includes(response.data?.code)) {
        clearSession();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
};

const createClient = (extraConfig = {}) => {
    const client = axios.create({ baseURL: API_BASE_URL, ...extraConfig });

    client.interceptors.request.use((config) => {
        const token = getToken();
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => {
            handleSessionError(response);
            return response;
        },
        (error) => {
            handleSessionError(error.response);
            return Promise.reject(error);
        }
    );

    return client;
};

// Default: melempar error untuk status 4xx/5xx (perilaku axios biasa).
// Dipakai layanan yang sebelumnya sudah memakai axios.
const apiClient = createClient();

// "Lunak": tidak melempar untuk status HTTP apa pun, response.data tetap berisi body JSON server.
// Dipakai layanan yang sebelumnya memakai fetch dan membaca {success, message} langsung.
export const apiClientSoft = createClient({ validateStatus: () => true });

export default apiClient;
