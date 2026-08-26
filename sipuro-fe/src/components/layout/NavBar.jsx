import React from 'react';
import NotificationBell from './NotificationBell';

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

    return (
        <div style={styles.container}>
            {/* Navigasi Utama */}
            <div style={styles.flexCenterGap12}>
                <button
                    type="button"
                    onClick={() => setActiveTab('po-list')}
                    style={getButtonStyle('po-list')}
                >
                    Daftar PO
                </button>

                {user.role === 'PPIC' && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('ppic-batch')}
                        style={getButtonStyle('ppic-batch')}
                    >
                        Alokasi Batch
                    </button>
                )}
            </div>

            {/* Sisi Kanan: Lonceng Notifikasi, Profil User & Logout */}
            <div style={styles.flexCenterGap16}>
                {/* Lonceng Notifikasi dipindah ke sebelah kiri profil dan dikirimkan role user */}
                <NotificationBell
                    user={user}
                    onNewPoDetected={() => {
                        if (setShowPoBanner) setShowPoBanner(true);
                    }}
                />

                <div style={styles.userInfo}>
                    <strong>{user.name}</strong> ({user.role}) <br />
                    <span style={styles.userCode}>Code/ID: {user.code}</span>
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
