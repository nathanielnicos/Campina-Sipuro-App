const BASE_URL = 'http://localhost:5000/api';

export const fetchPOListApi = async (customerId) => {
    const res = await fetch(`${BASE_URL}/po?customer_id=${customerId}`);
    return await res.json();
};

export const fetchProducts = async () => {
    const res = await fetch(`${BASE_URL}/products`);
    return await res.json();
};

export const fetchCustomerDetail = async (customerId) => {
    const res = await fetch(`${BASE_URL}/customers/${customerId}`);
    return await res.json();
};

export const fetchCompanyProfile = async () => {
    const res = await fetch(`${BASE_URL}/company-profile`);
    return await res.json();
};

export const fetchPODetail = async (poId) => {
    const res = await fetch(`${BASE_URL}/po/${poId}`);
    return await res.json();
};

export const savePO = async (poId, payload) => {
    const url = poId ? `${BASE_URL}/po/${poId}` : `${BASE_URL}/po`;
    const method = poId ? 'PUT' : 'POST';
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
};

export const cancelPOApi = async (poId) => {
    const res = await fetch(`${BASE_URL}/po/${poId}/cancel`, { method: 'PATCH' });
    return await res.json();
};

export const updatePOStatusApi = async (poId, status, notes, updatedBy) => {
    const res = await fetch(`${BASE_URL}/po/${poId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, updated_by: updatedBy })
    });
    return await res.json();
};
