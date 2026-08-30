import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/superadmin';

export const getEmployees = async () => {
    const response = await axios.get(`${API_BASE_URL}/employees`);
    return response.data;
};

export const getProducts = async () => {
    const response = await axios.get(`${API_BASE_URL}/products`);
    return response.data;
};

export const getPrices = async () => {
    const response = await axios.get(`${API_BASE_URL}/prices`);
    return response.data;
};
