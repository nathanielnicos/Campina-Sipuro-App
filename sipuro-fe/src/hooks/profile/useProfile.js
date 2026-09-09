import { useState, useEffect } from 'react';
import { getProfile, updatePassword } from '../../services/profileApi';

export const useProfile = ({ currentUser }) => {
    const isCustomer = currentUser?.role === 'CUSTOMER';
    const userId = currentUser?.user_id || currentUser?.id;
    const userRole = currentUser?.role;

    const [loading, setLoading] = useState(true);
    const [savingPassword, setSavingPassword] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Profile Form State
    const [formData, setFormData] = useState({
        user_code: '',
        full_name: '',
        email: '',
        gender: 'M',
        birth_date: '',
        department: '',
        join_date: ''
    });

    // Password Form State
    const [passData, setPassData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        const loadProfileData = async () => {
            setLoading(true);
            const res = await getProfile(userId, userRole);
            if (res.success && res.data) {
                const data = res.data;
                setFormData({
                    user_code: data.employee_code || data.customer_user_code || '',
                    full_name: data.full_name || '',
                    email: data.email || '',
                    gender: data.gender || 'M',
                    birth_date: data.birth_date ? data.birth_date.split('T')[0] : '',
                    department: data.department || '',
                    join_date: data.join_date ? data.join_date.split('T')[0] : ''
                });
            }
            setLoading(false);
        };

        if (userId && userRole) {
            loadProfileData();
        }
    }, [userId, userRole]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (passData.newPassword !== passData.confirmPassword) {
            setMessage({ type: 'error', text: 'Konfirmasi kata sandi baru tidak cocok.' });
            return;
        }

        setSavingPassword(true);
        const res = await updatePassword({
            user_id: userId,
            role: userRole,
            currentPassword: passData.currentPassword,
            newPassword: passData.newPassword
        });
        setSavingPassword(false);

        if (res.success) {
            setMessage({ type: 'success', text: 'Kata sandi berhasil diubah.' });
            setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } else {
            setMessage({ type: 'error', text: res.message || 'Gagal mengubah kata sandi.' });
        }
    };

    return {
        isCustomer,
        loading,
        savingPassword,
        message,
        formData,
        passData,
        setPassData,
        handlePasswordSubmit
    };
};
