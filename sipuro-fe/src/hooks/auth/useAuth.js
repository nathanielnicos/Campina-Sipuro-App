import { useState } from 'react';
import { loginApi, registerApi } from '../../services/authApi';

export const useAuth = (onLoginSuccess) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async ({ username, password, roleType }) => {
        setErrorMsg('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const result = await loginApi(username, password, roleType);
            if (result.success) {
                onLoginSuccess(result.data);
            } else {
                setErrorMsg(result.message || 'Login failed.');
            }
        } catch (err) {
            console.error('Error logging in:', err);
            setErrorMsg('Failed to connect to the backend server.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (payload) => {
        setErrorMsg('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const result = await registerApi(payload);
            if (result.success) {
                setSuccessMsg(result.message);
                setIsRegistering(false);
            } else {
                setErrorMsg(result.message || 'Registration failed.');
            }
        } catch (err) {
            console.error('Error registering:', err);
            setErrorMsg('Failed to connect to the backend server.');
        } finally {
            setLoading(false);
        }
    };

    const switchToRegister = () => {
        setIsRegistering(true);
        setErrorMsg('');
        setSuccessMsg('');
    };

    const switchToLogin = () => {
        setIsRegistering(false);
        setErrorMsg('');
        setSuccessMsg('');
    };

    return {
        isRegistering,
        errorMsg,
        successMsg,
        loading,
        setErrorMsg,
        handleLogin,
        handleRegister,
        switchToRegister,
        switchToLogin
    };
};
