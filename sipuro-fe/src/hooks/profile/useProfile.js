import { useState, useEffect } from 'react';
import { getProfile, updatePassword } from '../../services/profileApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useProfile = ({ currentUser }) => {
    const { showAlert } = useGlobalModal();

    const isCustomer = currentUser?.role === 'CUSTOMER';
    const userId = currentUser?.id;
    const userRole = currentUser?.role;

    const [loading, setLoading] = useState(true);
    const [savingPassword, setSavingPassword] = useState(false);

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
                    user_code: data.code,
                    full_name: data.full_name,
                    email: data.email,
                    gender: data.gender,
                    birth_date: data.birth_date ? data.birth_date.split('T')[0] : '',
                    department: data.department,
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

        // Validasi Field Kosong
        if (!passData.currentPassword || !passData.newPassword || !passData.confirmPassword) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'All password fields are required.'
            });
            return;
        }

        // Validasi Kesesuaian Password Baru
        if (passData.newPassword !== passData.confirmPassword) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'New password and confirm password do not match.'
            });
            return;
        }

        // Validasi Panjang Password Minimum
        if (passData.newPassword.length < 6) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'New password must be at least 6 characters long.'
            });
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
            showAlert({
                type: 'success',
                title: 'Success',
                message: 'Password changed successfully.'
            });
            setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } else {
            showAlert({
                type: 'danger',
                title: 'Error',
                message: res.message || 'Failed to change password.'
            });
        }
    };

    return {
        isCustomer,
        loading,
        savingPassword,
        formData,
        passData,
        setPassData,
        handlePasswordSubmit
    };
};
