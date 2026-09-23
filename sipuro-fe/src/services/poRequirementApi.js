import axios from 'axios';
import { API_BASE_URL } from './config';

export const fetchPORequirementSummary = async (params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/production-schedule/po-requirement/summary`, { params });
    return response.data;
};

export const fetchPORequirementDetail = async (idProduct, params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/production-schedule/po-requirement/detail/${idProduct}`, { params });
    return response.data;
};

export const fetchCustomersList = async () => {
    const response = await axios.get(`${API_BASE_URL}/production-schedule/po-requirement/customers`);
    return response.data;
};

export const createDraftPO = async (payload) => {
    const response = await axios.post(`${API_BASE_URL}/production-schedule/po-requirement/create-draft-po`, payload);
    return response.data;
};
