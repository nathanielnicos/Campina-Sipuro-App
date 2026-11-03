import axios from './apiClient';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/upload-trans-types`;

export const getUploadTransTypes = async () => {
    const response = await axios.get(BASE_URL);
    return response.data;
};

export const createUploadTransType = async ({ transType, direction, matchBy }) => {
    const response = await axios.post(BASE_URL, { transType, direction, matchBy });
    return response.data;
};

// patch: { isActive } dan/atau { transType, direction, matchBy } (definisi hanya bisa diubah selama belum pernah dipakai)
export const updateUploadTransType = async (id, patch) => {
    const response = await axios.patch(`${BASE_URL}/${id}`, patch);
    return response.data;
};
