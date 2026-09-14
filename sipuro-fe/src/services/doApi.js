import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/delivery-orders`;

/**
 * Fetch Delivery Orders (Closed PO Batch Allocations) with dynamic filters, sort, and pagination
 */
export const getDeliveryOrders = async (params = {}) => {
    // Buat objek URLSearchParams untuk menyusun query string secara otomatis
    const searchParams = new URLSearchParams();

    Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            searchParams.append(key, params[key]);
        }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

    const res = await fetch(url);

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch delivery orders');
    }

    return await res.json();
};
