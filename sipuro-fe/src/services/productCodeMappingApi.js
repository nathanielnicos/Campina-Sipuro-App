import axios from './apiClient';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/superadmin/product-code-mappings`;

export const getProductCodeMappings = async (page = 1, limit = 10, search = '') => {
    const response = await axios.get(BASE_URL, {
        params: { page, limit, search }
    });
    return response.data;
};

export const createProductCodeMapping = async (idProductOld, idProductNew) => {
    const response = await axios.post(BASE_URL, { idProductOld, idProductNew });
    return response.data;
};

export const setProductCodeMappingStatus = async (mappingId, isActive) => {
    const response = await axios.patch(`${BASE_URL}/${mappingId}/status`, { isActive });
    return response.data;
};
