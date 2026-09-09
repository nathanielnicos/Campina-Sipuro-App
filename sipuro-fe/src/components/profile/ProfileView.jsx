import { useState, useEffect } from 'react';
import { formatDate, formatGender } from "../../utils/formatters";
import { getProfile, updatePassword } from '../../services/profileApi';

const ProfileView = ({ currentUser, onUserUpdated }) => {
    const isCustomer = currentUser?.role === 'CUSTOMER';
    // Ambil ID user baik dari customer (user_id) maupun employee (id)
    const userId = currentUser?.user_id || currentUser?.id;
    const userRole = currentUser?.role;

    const [loading, setLoading] = useState(true);
    // const [savingProfile, setSavingProfile] = useState(false);
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

    // const handleProfileSubmit = async (e) => {
    //     e.preventDefault();
    //     setSavingProfile(true);
    //     setMessage({ type: '', text: '' });

    //     const payload = isCustomer
    //         ? {
    //             user_id: userId,
    //             role: userRole,
    //             full_name: formData.full_name,
    //             email: formData.email
    //         }
    //         : {
    //             user_id: userId,
    //             role: userRole,
    //             full_name: formData.full_name,
    //             gender: formData.gender,
    //             birth_date: formData.birth_date
    //         };

    //     const res = await updateProfile(payload);
    //     setSavingProfile(false);

    //     if (res.success) {
    //         setMessage({ type: 'success', text: 'Profil berhasil diperbarui.' });
    //         if (onUserUpdated) onUserUpdated({ ...currentUser, ...res.data });
    //     } else {
    //         setMessage({ type: 'error', text: res.message || 'Gagal memperbarui profil.' });
    //     }
    // };

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

    if (loading) {
        return <div style={{ padding: '20px' }}>Loading profile...</div>;
    }

    return (
        <div style={{ padding: '0 20px 20px 20px', fontFamily: 'sans-serif' }}>
            {message.text && (
                <div style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: message.type === 'success' ? '#065f46' : '#991b1b',
                    fontSize: '14px'
                }}>
                    {message.text}
                </div>
            )}

            <div style={styles.gridTwo}>
                {/* Section 1: Data Diri (Read-Only) */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Personal Information</h3>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Username</label>
                        <input
                            type="text"
                            value={formData.user_code}
                            disabled
                            style={styles.inputDisabled}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Full Name</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            disabled
                            style={styles.inputDisabled}
                        />
                    </div>

                    {isCustomer ? (
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Email Address</label>
                            <input
                                type="email"
                                value={formData.email}
                                disabled
                                style={styles.inputDisabled}
                            />
                        </div>
                    ) : (
                        <>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Gender</label>
                                <input
                                    type="text"
                                    value={formatGender(formData.gender)}
                                    disabled
                                    style={styles.inputDisabled}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Birth Date</label>
                                <input
                                    type="text"
                                    value={formatDate(formData.birth_date)}
                                    disabled
                                    style={styles.inputDisabled}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Department</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    disabled
                                    style={styles.inputDisabled}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Join Date</label>
                                <input
                                    type="text"
                                    value={formatDate(formData.join_date)}
                                    disabled
                                    style={styles.inputDisabled}
                                />
                            </div>
                        </>
                    )}

                    <p style={styles.infoNote}>
                        *To update your personal information or email, please contact your System Administrator.
                    </p>
                </div>

                {/* Section 2: Change Password */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Change Password</h3>
                    <form onSubmit={handlePasswordSubmit}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Current Password</label>
                            <input
                                type="password"
                                value={passData.currentPassword}
                                onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                                required
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>New Password</label>
                            <input
                                type="password"
                                value={passData.newPassword}
                                onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                                required
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Confirm New Password</label>
                            <input
                                type="password"
                                value={passData.confirmPassword}
                                onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                                required
                                style={styles.input}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={savingPassword}
                            style={styles.saveBtn}
                        >
                            {savingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const styles = {
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px',
        alignItems: 'start'
    },
    card: {
        backgroundColor: '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
    },
    cardTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#334155',
        marginBottom: '16px',
        borderBottom: '1px solid #f1f5f9',
        paddingBottom: '8px'
    },
    formGroup: {
        marginBottom: '14px'
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: '600',
        color: '#475569',
        marginBottom: '6px'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '13px',
        boxSizing: 'border-box',
        outline: 'none'
    },
    inputDisabled: {
        width: '100%',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        fontSize: '13px',
        boxSizing: 'border-box'
    },
    saveBtn: {
        marginTop: '10px',
        width: '100%',
        padding: '10px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        cursor: 'pointer'
    },
    infoNote: {
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: '16px',
        lineHeight: '1.4'
    }
};

export default ProfileView;
