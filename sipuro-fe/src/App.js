import React, { useState, useEffect } from 'react';
import POList from './components/po/POList';
import POCreateModal from './components/po/POCreateModal';
import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';

function App() {
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App" style={{ padding: '20px' }}>
      <Navbar user={user} onLogout={handleLogout} />

      <POList
        key={refreshKey}
        customerId={user.role === 'CUSTOMER' ? user.id : null}
        userRole={user.role}
        onCreateNewPO={handleOpenCreate}
        onSelectPODetail={handleSelectPODetail}
      />

      {showCreateModal && (
        <POCreateModal
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
