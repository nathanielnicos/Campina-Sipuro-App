import axios from './apiClient';
import { API_BASE_URL } from './config';

const BASE_URL = `${API_BASE_URL}/upload-formats`;

// Format file upload kedua scope (LOT dan DO): baris data pertama, sel process timestamp, dan kolom tiap field
export const getUploadFormats = async () => {
    const response = await axios.get(BASE_URL);
    return response.data;
};

// format: { startRow, timestampCell, columns: { KEY: 'J', ... } }; seluruh format satu scope dikirim sekaligus
export const updateUploadFormat = async (scope, format) => {
    const response = await axios.put(`${BASE_URL}/${scope}`, format);
    return response.data;
};
