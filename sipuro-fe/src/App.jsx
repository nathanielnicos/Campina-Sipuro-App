import { useState, useEffect } from 'react';
import POPage from './components/po/page/POPage';
import DetailModal from './components/po/detail-modal/DetailModal';
import BatchPage from './components/batch/page/BatchPage';
import Dashboard from './components/dashboard/Dashboard';

import EmployeeListPage from './components/superadmin/EmployeeListPage';
import CustomerUserListPage from './components/superadmin/CustomerUserListPage';
import ProductListPage from './components/superadmin/ProductListPage';
import PriceListPage from './components/superadmin/PriceListPage';

import ProfileView from './components/profile/ProfileView';

import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';
import PONewDataBanner from './components/notification/NotificationBanner';
import { markAllAsRead } from './services/notificationApi';
import { ROLE_PERMISSIONS } from './config/navigationConfig';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('po-list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Global banner states
  const [showPoBanner, setShowPoBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

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

  const handleUserUpdated = (updatedUserData) => {
    const newUserState = { ...user, ...updatedUserData };
    setUser(newUserState);
    localStorage.setItem('sipuro_user', JSON.stringify(newUserState));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sipuro_user');
  };

  const handleOpenCreate = () => {
    if (user && user.role !== 'CUSTOMER') {
      alert('Only Customers can create new Purchase Orders.');
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

  const handleBannerRefresh = async () => {
    setShowPoBanner(false);

    // Tandai semua notifikasi milik role/user sebagai dibaca saat menekan tombol banner
    if (user) {
      try {
        const userId = user?.customer_id || user?.id || user?.code;
        const userDepartment = user?.department || user?.role;
        await markAllAsRead(user.role, userId, userDepartment);
      } catch (err) {
        console.error('Failed to mark all as read from banner:', err);
      }
    }

    setActiveTab('po-list');
    setRefreshKey((prev) => prev + 1);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App" style={{ padding: '20px' }}>
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        setShowPoBanner={(status, message) => {
          setShowPoBanner(status);
          if (message) setBannerMessage(message);
        }}
      />

      {/* Global Notification Banner */}
      <PONewDataBanner
        show={showPoBanner}
        message={bannerMessage}
        onRefresh={handleBannerRefresh}
      />

      {activeTab === 'sa-employees' && <EmployeeListPage />}
      {activeTab === 'sa-customers' && <CustomerUserListPage />}
      {activeTab === 'sa-products' && <ProductListPage />}
      {activeTab === 'sa-prices' && <PriceListPage />}

      {activeTab === 'ppic-dashboard' && <Dashboard />}
      {activeTab === 'ppic-batch' && <BatchPage currentUser={user} />}

      {activeTab === 'po-list' && (
        <POPage
          key={refreshKey}
          customerId={user.role === 'CUSTOMER' ? user.customer_id : null}
          user={user}
          onCreateNewPO={handleOpenCreate}
          onSelectPODetail={handleSelectPODetail}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileView
          currentUser={user}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {showCreateModal && (
        <DetailModal
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
