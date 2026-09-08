import NotificationBell from './NotificationBell';
import { ROLE_PERMISSIONS } from '../../config/navigationConfig';

const Navbar = ({ user, activeTab, setActiveTab, onLogout, setShowPoBanner }) => {
    const getButtonStyle = (tabName) => ({
        padding: '6px 14px',
        cursor: 'pointer',
        backgroundColor: activeTab === tabName ? '#3b82f6' : '#334155',
        color: activeTab === tabName ? '#ffffff' : '#94a3b8',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        transition: 'all 0.2s'
    });

    // Ambil daftar menu sesuai role user (fallback array kosong jika role tidak ditemukan)
    const userMenu = ROLE_PERMISSIONS[user?.role] || [];

    // Formatting tampilan nama & kode berdasarkan role
    const displayName = user?.role === 'CUSTOMER'
        ? `${user?.full_name || user?.name || ''} (${user?.company_name || ''})`
        : user?.name || user?.full_name || '';

    const displayCode = user?.role === 'CUSTOMER'
        ? user?.user_code || user?.code || ''
        : user?.code || '';

    return (
        <div style={styles.container}>
            <div style={styles.flexCenterGap12}>
                {userMenu.map((menu) => (
                    <button
                        key={menu.id}
                        type="button"
                        onClick={() => setActiveTab(menu.id)}
                        style={getButtonStyle(menu.id)}
                    >
                        {menu.label}
                    </button>
                ))}
            </div>

            <div style={styles.flexCenterGap16}>
                <NotificationBell
                    user={user}
                    setActiveTab={setActiveTab}
                    onNewPoDetected={() => {
                        if (setShowPoBanner) setShowPoBanner(true);
                    }}
                />

                <div style={styles.userInfo}>
                    <strong>{displayName}</strong><br />
                    <span style={styles.userCode}>Code: {displayCode}</span>
                </div>

                <button type="button" onClick={onLogout} style={styles.logoutBtn}>
                    Logout
                </button>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '12px 20px',
        backgroundColor: '#1e293b',
        color: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    flexCenterGap12: { display: 'flex', alignItems: 'center', gap: '12px' },
    flexCenterGap16: { display: 'flex', alignItems: 'center', gap: '16px' },
    userInfo: { fontSize: '13px', textAlign: 'right' },
    userCode: { color: '#94a3b8', fontSize: '12px' },
    logoutBtn: {
        padding: '6px 14px',
        cursor: 'pointer',
        backgroundColor: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px'
    }
};

export default Navbar;
