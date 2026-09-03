import React, { useState, useEffect } from 'react';
import POList from './components/po/POList';
import POCreateModal from './components/po/create-modal/POCreateModal';
import PPICBatchAllocationPage from './components/ppic/PPICBatchAllocationPage';
import Dashboard from './components/dashboard/Dashboard';

import EmployeeListPage from './components/superadmin/EmployeeListPage';
import CustomerListPage from './components/superadmin/CustomerListPage';
import ProductListPage from './components/superadmin/ProductListPage';
import PriceListPage from './components/superadmin/PriceListPage';

import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';
import { ROLE_PERMISSIONS } from './config/navigationConfig';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('po-list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ambil tab pertama dari konfigurasi berdasarkan role user
  const getDefaultTab = (role) => {
    const userMenus = ROLE_PERMISSIONS[role] || [];
    return userMenus.length > 0 ? userMenus[0].id : 'po-list';
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('sipuro_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setActiveTab(getDefaultTab(parsedUser.role));
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sipuro_user', JSON.stringify(userData));
    setActiveTab(getDefaultTab(userData.role));
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

  const isSuperAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN';

  return (
    <div className="App" style={{ padding: '20px' }}>
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* RENDER SUPERADMIN */}
      {isSuperAdmin && activeTab === 'sa-employees' && <EmployeeListPage />}
      {isSuperAdmin && activeTab === 'sa-customers' && <CustomerListPage />}
      {isSuperAdmin && activeTab === 'sa-products' && <ProductListPage />}
      {isSuperAdmin && activeTab === 'sa-prices' && <PriceListPage />}

      {/* RENDER PPIC */}
      {activeTab === 'ppic-dashboard' && user.role === 'PPIC' && <Dashboard />}
      {activeTab === 'ppic-batch' && user.role === 'PPIC' && <PPICBatchAllocationPage currentUser={user} />}

      {/* RENDER PO */}
      {activeTab === 'po-list' && (
        <POList
          key={refreshKey}
          customerId={user.role === 'CUSTOMER' ? user.id : null}
          user={user}
          onCreateNewPO={handleOpenCreate}
          onSelectPODetail={handleSelectPODetail}
        />
      )}

      {showCreateModal && (
        <POCreateModal
          poId={selectedPoId}
          currentUser={user}
          onClose={handleCloseModal}
          onSuccess={handlePOSuccess}
        />
      )}
    </div>
  );
}

export default App;
