import axios from 'axios';
import { API_BASE_URL } from './config';

export const fetchProductionPlansSummary = async (params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/production-schedule/production-plan`, {
        params
    });
    return response.data;
};

export const fetchProductionPlanDetail = async (idProduct, params = {}) => {
    const response = await axios.get(`${API_BASE_URL}/production-schedule/production-plan/${idProduct}`, {
        params
    });
    return response.data;
};

export const saveProductionPlan = async (payload) => {
    const response = await axios.post(`${API_BASE_URL}/production-schedule/production-plan/save`, payload);
    return response.data;
};
