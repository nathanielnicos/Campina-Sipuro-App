import { apiClientSoft } from './apiClient';

const BASE_PATH = '/document-flow';

const buildParams = (params = {}) => {
    const clean = {};
    Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            clean[key] = params[key];
        }
    });
    return clean;
};

// Perilaku sama seperti versi fetch: status non-2xx dilempar sebagai Error(message server atau pesan default).
const parseResponse = (res, fallbackMessage) => {
    if (res.status < 200 || res.status >= 300) {
        throw new Error(res.data?.message || fallbackMessage);
    }
    return res.data;
};

export const getDeliveryOrders = async (params = {}) => {
    const res = await apiClientSoft.get(`${BASE_PATH}/do`, { params: buildParams(params) });
    return parseResponse(res, 'Failed to fetch delivery orders');
};

export const getSalesInvoices = async (params = {}) => {
    const res = await apiClientSoft.get(`${BASE_PATH}/si`, { params: buildParams(params) });
    return parseResponse(res, 'Failed to fetch sales invoices');
};

// formData: { file }
export const previewDocumentFlow = async (formData) => {
    const res = await apiClientSoft.post(`${BASE_PATH}/preview`, formData);
    return parseResponse(res, 'Failed to preview import file');
};

// payload: FormData { file, userId, fingerprint }. Browser mengatur Content-Type multipart sendiri,
// sehingga header Content-Type tidak boleh diisi di sini.
export const commitDocumentFlow = async (payload) => {
    const res = await apiClientSoft.post(`${BASE_PATH}/commit`, payload);
    return parseResponse(res, 'Failed to commit document import');
};
