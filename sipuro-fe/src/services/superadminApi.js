import axios from 'axios';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/superadmin`;

export const getEmployees = async (page = 1, limit = 10, search = '') => {
    const response = await axios.get(`${BASE_URL}/employees`, {
        params: { page, limit, search }
    });
    return response.data;
};

export const toggleEmployeeStatus = async (id, isSuspended) => {
    const response = await axios.put(`${BASE_URL}/employees/${id}/toggle-status`, {
        is_suspended: isSuspended
    });
    return response.data;
};

export const getProducts = async (page = 1, limit = 10, search = '') => {
    const response = await axios.get(`${BASE_URL}/products`, {
        params: { page, limit, search }
    });
    return response.data;
};

export const getPrices = async (page = 1, limit = 10, search = '') => {
    const response = await axios.get(`${BASE_URL}/prices`, {
        params: { page, limit, search }
    });
    return response.data;
};

export const getCustomers = async (page = 1, limit = 10, search = '') => {
    const response = await axios.get(`${BASE_URL}/customers`, {
        params: { page, limit, search }
    });
    return response.data;
};

export const toggleCustomerStatus = async (id, isActive) => {
    const response = await axios.put(`${BASE_URL}/customers/${id}/toggle-status`, {
        is_active: isActive
    });
    return response.data;
};
