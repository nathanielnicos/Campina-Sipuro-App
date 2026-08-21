import React, { useState, useEffect } from 'react';
import POList from './components/POList';
import POCreate from './components/POCreate';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ambil session user dari localStorage saat pertama kali dimuat
  useEffect(() => {
    const savedUser = localStorage.getItem('sipuro_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sipuro_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sipuro_user');
  };

  const handleOpenCreate = () => {
    if (user && user.role !== 'CUSTOMER') {
      alert('Hanya Customer yang dapat membuat PO baru.');
      return;
    }
    setSelectedPoId(null);
    setShowCreateModal(true);
  };

  const handleSelectPODetail = (poHeaderId) => {
    setSelectedPoId(poHeaderId);
    setShowCreateModal(true);
  };

  const handlePOSuccess = () => {
    setShowCreateModal(false);
    setSelectedPoId(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedPoId(null);
  };

  // Jika belum login, tampilkan layar Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App" style={{ padding: '20px' }}>
      {/* Header Bar User Info & Logout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
        <div>
          <strong>{user.name}</strong> ({user.role}) - Code/ID: {user.code}
        </div>
        <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Logout
        </button>
      </div>

      <POList
        key={refreshKey}
        customerId={user.role === 'CUSTOMER' ? user.id : null}
        userRole={user.role}
        onCreateNewPO={handleOpenCreate}
        onSelectPODetail={handleSelectPODetail}
      />

      {showCreateModal && (
        <POCreate
          poId={selectedPoId}
          customerId={user.id}
          userRole={user.role}
          onClose={handleCloseModal}
          onSuccess={handlePOSuccess}
        />
      )}
    </div>
  );
}

export default App;
