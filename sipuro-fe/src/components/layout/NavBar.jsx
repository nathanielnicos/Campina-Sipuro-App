import React from 'react';

const Navbar = ({ user, activeTab, setActiveTab, onLogout }) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '12px 20px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            {/* Pembungkus Kiri: Teks Profil & Tab Navigasi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ fontSize: '14px' }}>
                    <strong>{user.name}</strong> ({user.role}) - <span style={{ color: '#cbd5e1' }}>Code/ID: {user.code}</span>
                </div>

                {/* Tab Menu Navigasi */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('po-list')}
                        style={{
                            padding: '6px 14px',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'po-list' ? '#3b82f6' : '#334155',
                            color: activeTab === 'po-list' ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                        }}
                    >
                        Daftar PO
                    </button>

                    {user.role === 'PPIC' && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('ppic-batch')}
                            style={{
                                padding: '6px 14px',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'ppic-batch' ? '#3b82f6' : '#334155',
                                color: activeTab === 'ppic-batch' ? '#ffffff' : '#94a3b8',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                        >
                            Alokasi Batch PPIC
                        </button>
                    )}
                </div>
            </div>

            {/* Tombol Logout di Ujung Kanan */}
            <button
                onClick={onLogout}
                style={{
                    padding: '6px 14px',
                    cursor: 'pointer',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '13px'
                }}
            >
                Logout
            </button>
        </div>
    );
};

export default Navbar;
