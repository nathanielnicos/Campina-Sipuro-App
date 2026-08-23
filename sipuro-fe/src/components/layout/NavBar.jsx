import React from 'react';

const Navbar = ({ user, activeTab, setActiveTab, onLogout }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                    <strong>{user.name}</strong> ({user.role}) - Code/ID: {user.code}
                </div>

                {/* Tab Menu Navigasi */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('po-list')}
                        style={{
                            padding: '6px 12px',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'po-list' ? '#0d6efd' : '#e9ecef',
                            color: activeTab === 'po-list' ? '#fff' : '#333',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                        }}
                    >
                        Daftar PO
                    </button>

                    {user.role === 'PPIC' && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('ppic-batch')}
                            style={{
                                padding: '6px 12px',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'ppic-batch' ? '#0d6efd' : '#e9ecef',
                                color: activeTab === 'ppic-batch' ? '#fff' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                            }}
                        >
                            Alokasi Batch PPIC
                        </button>
                    )}
                </div>
            </div>

            <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
                Logout
            </button>
        </div>
    );
};

export default Navbar;
