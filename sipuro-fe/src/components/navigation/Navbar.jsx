import NotificationBell from './NotificationBell';
import { getNavItemsByUser } from '../../config/navigationConfig';

const Navbar = ({ user, activeTab, setActiveTab, onLogout, setShowPoBanner }) => {
    const getButtonStyle = (tabName) => ({
        padding: '8px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: activeTab === tabName ? '#3b82f6' : '#334155',
        color: activeTab === tabName ? '#ffffff' : '#94a3b8',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'all 0.2s'
    });

    const userMenu = getNavItemsByUser(user);
    const displayName = user?.name || 'No Name';
    const displayCode = user?.code || 'No Code';

    return (
        <div style={styles.container}>
            {/* Tag style bawaan untuk menyembunyikan scrollbar di Firefox, IE/Edge, & Webkit (Chrome/Safari) */}
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

            {/* Wrapper utama menu dengan efek Gradient Fade Mask di sisi kanan */}
            <div style={styles.menuWrapperWithFade}>
                <div className="hide-scrollbar" style={styles.menuScrollContainer}>
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
            </div>

            {/* Area Profil, Notifikasi, & Logout (Fixed/Terpisah di Sisi Kanan) */}
            <div style={styles.rightActionArea}>
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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        gap: '16px',
        position: 'relative',
        overflow: 'visible' // Memastikan popover/balon tidak terpotong
    },
    menuWrapperWithFade: {
        flex: 1,
        minWidth: 0,
        position: 'relative',
        // Masking efek fade transparan di ujung kanan menu
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
        zIndex: 50 // Memastikan area kanan & balon notifikasi melayang di atas konten lain
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
