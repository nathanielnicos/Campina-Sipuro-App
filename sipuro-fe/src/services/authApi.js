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
