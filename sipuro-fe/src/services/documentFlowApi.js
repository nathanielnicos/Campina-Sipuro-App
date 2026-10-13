import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/document-flow`;

const buildQueryString = (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            searchParams.append(key, params[key]);
        }
    });
    return searchParams.toString();
};

const parseResponse = async (res, fallbackMessage) => {
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || fallbackMessage);
    }
    return await res.json();
};

export const getDeliveryOrders = async (params = {}) => {
    const queryString = buildQueryString(params);
    const res = await fetch(queryString ? `${BASE_URL}/do?${queryString}` : `${BASE_URL}/do`);
    return parseResponse(res, 'Failed to fetch delivery orders');
};

export const getSalesInvoices = async (params = {}) => {
    const queryString = buildQueryString(params);
    const res = await fetch(queryString ? `${BASE_URL}/si?${queryString}` : `${BASE_URL}/si`);
    return parseResponse(res, 'Failed to fetch sales invoices');
};

// formData: { file }
export const previewDocumentFlow = async (formData) => {
    const res = await fetch(`${BASE_URL}/preview`, {
        method: 'POST',
        body: formData
    });
    return parseResponse(res, 'Failed to preview import file');
};

// payload: FormData { file, userId, fingerprint }. The browser sets the multipart Content-Type itself,
// so no Content-Type header must be set here (the previous version sent FormData as JSON).
export const commitDocumentFlow = async (payload) => {
    const res = await fetch(`${BASE_URL}/commit`, {
        method: 'POST',
        body: payload
    });
    return parseResponse(res, 'Failed to commit document import');
};
