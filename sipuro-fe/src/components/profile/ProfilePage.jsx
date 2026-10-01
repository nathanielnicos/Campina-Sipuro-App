import { formatGender } from "../../utils/formatters";
import { formatDate } from "../../utils/dateHelper";
import { useProfile } from "../../hooks/profile/useProfile";

const ProfilePage = ({ currentUser }) => {
    const {
        isCustomer,
        loading,
        savingPassword,
        formData,
        passData,
        setPassData,
        handlePasswordSubmit
    } = useProfile({ currentUser });

    if (loading) {
        return <div style={{ padding: '20px' }}>Loading profile...</div>;
    }

    return (
        <div style={{ padding: '0 20px 20px 20px', fontFamily: 'sans-serif' }}>
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
                                <label style={styles.label}>Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email || ''}
                                    disabled
                                    style={styles.inputDisabled}
                                />
                            </div>

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
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>New Password</label>
                            <input
                                type="password"
                                value={passData.newPassword}
                                onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Confirm New Password</label>
                            <input
                                type="password"
                                value={passData.confirmPassword}
                                onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                                style={styles.input}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={savingPassword}
                            style={{
                                ...styles.saveBtn,
                                opacity: savingPassword ? 0.6 : 1,
                                cursor: savingPassword ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease-in-out'
                            }}
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

export default ProfilePage;
