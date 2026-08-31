const BASE_URL = 'http://localhost:5000/api';

export const loginApi = async (username, password, roleType) => {
    const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            password,
            role_type: roleType
        })
    });
    return await res.json();
};

export const registerApi = async (payload) => {
    const res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
};
