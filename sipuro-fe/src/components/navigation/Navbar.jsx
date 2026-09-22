import NotificationBell from './NotificationBell';
import { getNavItemsByUser } from '../../config/navigationConfig';

const Navbar = ({ user, activeTab, setActiveTab, onLogout, setShowPoBanner }) => {
    const getButtonStyle = (tabName) => ({
        width: '160px',
        textAlign: 'center',
        padding: '8px',
        cursor: 'pointer',
        backgroundColor: activeTab === tabName ? '#3b82f6' : '#334155',
        color: activeTab === tabName ? '#ffffff' : '#94a3b8',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        transition: 'all 0.2s'
    });

    const userMenu = getNavItemsByUser(user);

    const displayName = user?.name || 'No Name';

    const displayCode = user?.code || 'No Code';

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
                    setShowPoBanner={setShowPoBanner}
                    onNewPoDetected={(latestMessage) => {
                        if (setShowPoBanner) {
                            setShowPoBanner(true, latestMessage);
                        }
                    }}
                />

                <div
                    style={{ ...styles.userInfo, cursor: 'pointer' }}
                    onClick={() => setActiveTab('profile')}
                    title="Click to view profile"
                >
                    <strong>{displayName}</strong><br />
                    <span style={styles.userCode}>{displayCode}</span>
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
