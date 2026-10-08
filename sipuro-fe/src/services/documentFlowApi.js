import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/document-flow`;

export const getDeliveryOrders = async (params = {}) => {
    const searchParams = new URLSearchParams();

    Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            searchParams.append(key, params[key]);
        }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}/do?${queryString}` : `${BASE_URL}/do`;

    const res = await fetch(url);
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch delivery orders');
    }
    return await res.json();
};

export const getSalesInvoices = async (params = {}) => {
    const searchParams = new URLSearchParams();

    Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            searchParams.append(key, params[key]);
        }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}/si?${queryString}` : `${BASE_URL}/si`;

    const res = await fetch(url);
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch sales invoices');
    }
    return await res.json();
};

export const importDocumentFlow = async (formData) => {
    const res = await fetch(`${BASE_URL}/preview`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to preview import file');
    }
    return await res.json();
};

export const commitDocumentFlow = async (payload) => {
    const res = await fetch(`${BASE_URL}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to commit document import');
    }
    return await res.json();
};
