import React from 'react';

const Navbar = ({ user, onLogout }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <div>
                <strong>{user.name}</strong> ({user.role}) - Code/ID: {user.code}
            </div>
            <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
                Logout
            </button>
        </div>
    );
};

export default Navbar;
