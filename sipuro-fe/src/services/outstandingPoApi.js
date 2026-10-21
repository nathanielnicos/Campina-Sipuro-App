import axios from './apiClient';
import { API_BASE_URL } from './config';

const isCanceled = (error) =>
    Boolean(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError' || error.name === 'AbortError');

const failure = (error, fallback) => ({
    success: false,
    message: (error && error.response && error.response.data && error.response.data.message) || fallback
});

export const fetchOutstandingPo = async (params, signal) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/outstanding-po`, { params, signal });
        return response.data;
    } catch (error) {
        if (isCanceled(error)) return { canceled: true };
        console.error('Error fetching outstanding PO:', error);
        return failure(error, 'Failed to fetch outstanding PO data.');
    }
};

const postClose = async (poDetailId, action, body, fallback) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/outstanding-po/items/${encodeURIComponent(poDetailId)}/${action}`,
            body || {}
        );
        return response.data;
    } catch (error) {
        console.error(`Error ${action}:`, error);
        return failure(error, fallback);
    }
};

export const requestCloseItem = (poDetailId, reason) =>
    postClose(poDetailId, 'request-close', { reason }, 'Failed to submit close request.');

export const approveCloseItem = (poDetailId) =>
    postClose(poDetailId, 'approve-close', {}, 'Failed to approve close request.');

export const rejectCloseItem = (poDetailId) =>
    postClose(poDetailId, 'reject-close', {}, 'Failed to reject close request.');
