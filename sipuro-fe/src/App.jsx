import { useState, useEffect, useCallback } from 'react';
import POPage from './components/po/page/POPage';
import DetailModal from './components/po/detail-modal/DetailModal';
import BatchPage from './components/batch/page/BatchPage';
import ProductionSchedulePage from './components/productionSchedule/page/ProductionSchedulePage';
import Dashboard from './components/dashboard/Dashboard';

import EmployeeListPage from './components/master/EmployeeListPage';
import CustomerUserListPage from './components/master/CustomerUserListPage';
import ProductListPage from './components/master/ProductListPage';
import PriceListPage from './components/master/PriceListPage';

import DOPage from './components/do/DOPage';
import ProfilePage from './components/profile/ProfilePage';

import Login from './components/auth/Login';
import Navbar from './components/navigation/Navbar';
import NotificationBanner from './components/navigation/NotificationBanner';
import { markAllAsRead } from './services/notificationApi';
import { getNavItemsByUser } from './config/navigationConfig';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('po-list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Global banner states
  const [showPoBanner, setShowPoBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  // Membungkus getDefaultTab dalam useCallback agar aman dijadikan dependency
  const getDefaultTab = useCallback((userData) => {
    if (!userData) return 'po-list';
    const userMenus = getNavItemsByUser(userData);
    return userMenus && userMenus.length > 0 ? userMenus[0].id : 'po-list';
  }, []);

  // Membaca path dari URL browser (misal: /po-list)
  const getInitialTab = useCallback((userData) => {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, ''); // Menghapus tanda '/'

    // Jika path di URL cocok dengan tab yang valid
    if (path === 'po-list') return 'po-list';
    if (path === 'delivery-order') return 'delivery-order';
    if (path === 'ppic-dashboard') return 'ppic-dashboard';
    if (path === 'ppic-batch') return 'ppic-batch';
    if (path === 'ppic-production-schedule') return 'ppic-production-schedule';
    if (path === 'profile') return 'profile';

    // Jika tidak ada di URL, gunakan tab pertama sesuai role user
    return getDefaultTab(userData);
  }, [getDefaultTab]);

  useEffect(() => {
    const savedUser = localStorage.getItem('sipuro_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        // Ganti getDefaultTab dengan getInitialTab
        setActiveTab(getInitialTab(parsedUser));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
  }, [getInitialTab]);

  // Mengupdate URL di address bar browser saat activeTab berubah
  useEffect(() => {
    if (user && activeTab) {
      window.history.pushState(null, '', `/${activeTab}`);
    }
  }, [activeTab, user]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sipuro_user', JSON.stringify(userData));
    setActiveTab(getDefaultTab(userData));
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
        const userId = user?.id;
        const userDepartment = user?.department;
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
      <NotificationBanner
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
      {activeTab === 'ppic-production-schedule' && <ProductionSchedulePage />}
      {activeTab === 'delivery-order' && <DOPage />}

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
        <ProfilePage
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
