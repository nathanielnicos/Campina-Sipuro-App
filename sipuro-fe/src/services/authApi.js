import { apiClientSoft } from './apiClient';

export const loginApi = async (username, password, roleType) => {
    const res = await apiClientSoft.post('/login', {
        username,
        password,
        role_type: roleType
    });
    return res.data;
};

export const registerApi = async (payload) => {
    const res = await apiClientSoft.post('/register', payload);
    return res.data;
};
