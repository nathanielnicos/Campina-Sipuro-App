import axios from 'axios';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/upload/master`;

export const previewProductsApi = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${BASE_URL}/products/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const commitProductsApi = async (items, createdBy) => {
    const response = await axios.post(`${BASE_URL}/products/commit`, { items, createdBy });
    return response.data;
};

export const previewPricesApi = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${BASE_URL}/prices/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const commitPricesApi = async (items) => {
    const response = await axios.post(`${BASE_URL}/prices/commit`, { items });
    return response.data;
};
