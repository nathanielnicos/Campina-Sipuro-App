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

    const isSuperAdmin = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
    const isPPIC = user?.role === 'PPIC';
    const isCustomer = user?.role === 'CUSTOMER';

    return (
        <div style={styles.container}>
            <div style={styles.flexCenterGap12}>
                {/* MENU CUSTOMER */}
                {isCustomer && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('po-list')}
                        style={getButtonStyle('po-list')}
                    >
                        Daftar PO
                    </button>
                )}

                {/* MENU PPIC */}
                {isPPIC && (
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveTab('ppic-dashboard')}
                            style={getButtonStyle('ppic-dashboard')}
                        >
                            Dasbor
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('po-list')}
                            style={getButtonStyle('po-list')}
                        >
                            Daftar PO
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('ppic-batch')}
                            style={getButtonStyle('ppic-batch')}
                        >
                            Alokasi Batch
                        </button>
                    </>
                )}

                {/* MENU SUPERADMIN */}
                {isSuperAdmin && (
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveTab('sa-employees')}
                            style={getButtonStyle('sa-employees')}
                        >
                            Daftar Karyawan
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('sa-customers')}
                            style={getButtonStyle('sa-customers')}
                        >
                            Daftar Pelanggan
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('sa-products')}
                            style={getButtonStyle('sa-products')}
                        >
                            Daftar Produk
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('sa-prices')}
                            style={getButtonStyle('sa-prices')}
                        >
                            Daftar Harga Jual
                        </button>
                    </>
                )}
            </div>

            <div style={styles.flexCenterGap16}>
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
