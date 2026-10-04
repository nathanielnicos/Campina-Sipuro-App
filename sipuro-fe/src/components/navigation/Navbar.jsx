import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { getNavItemsByUser } from '../../config/navigationConfig';

const Navbar = ({ user, onLogout, setShowBanner }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const userMenu = getNavItemsByUser(user);
    const displayName = user?.name || 'No Name';
    const displayCode = user?.code || 'No Code';

    const getButtonStyle = (path) => {
        const isActive = location.pathname === path;
        return {
            padding: '8px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isActive ? '#3b82f6' : '#334155',
            color: isActive ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.2s'
        };
    };

    return (
        <div style={styles.container}>
            <style>
                {`
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}
            </style>

            <div style={styles.menuWrapperWithFade}>
                <div className="hide-scrollbar" style={styles.menuScrollContainer}>
                    {userMenu.map((menu) => (
                        <button
                            key={menu.id}
                            type="button"
                            onClick={() => navigate(menu.path)}
                            style={getButtonStyle(menu.path)}
                        >
                            {menu.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={styles.rightActionArea}>
                <NotificationBell
                    user={user}
                    setShowBanner={setShowBanner}
                    onNewPoDetected={(notif) => {
                        if (setShowBanner) {
                            setShowBanner(true, notif);
                        }
                    }}
                />

                <div
                    style={{ ...styles.userInfo, cursor: 'pointer' }}
                    onClick={() => navigate('/profile')}
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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        gap: '16px',
        position: 'relative',
        overflow: 'visible'
    },
    menuWrapperWithFade: {
        flex: 1,
        minWidth: 0,
        position: 'relative',
        WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)',
        maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)'
    },
    menuScrollContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        paddingRight: '20px'
    },
    rightActionArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 50
    },
    userInfo: { fontSize: '13px', textAlign: 'right' },
    userCode: { color: '#94a3b8', fontSize: '12px' },
    logoutBtn: {
        padding: '8px 14px',
        cursor: 'pointer',
        backgroundColor: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '13px',
        whiteSpace: 'nowrap'
    }
};

export default Navbar;
