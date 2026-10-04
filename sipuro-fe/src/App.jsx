import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import GlobalNotificationBanner from './components/navigation/GlobalNotificationBanner';
import { markAsRead } from './services/notificationApi';
import { getNavItemsByUser } from './config/navigationConfig';

import { ModalProvider, useGlobalModal } from './context/ModalContext';

function MainApp() {
  const [user, setUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();

  const { showAlert } = useGlobalModal();

  const [showBanner, setShowBanner] = useState(false);
  const [bannerNotif, setBannerNotif] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('sipuro_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
  }, []);

  const getDefaultPath = (userData) => {
    if (!userData) return '/po-list';
    const userMenus = getNavItemsByUser(userData);
    return userMenus && userMenus.length > 0 ? userMenus[0].path : '/po-list';
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sipuro_user', JSON.stringify(userData));
    navigate(getDefaultPath(userData));
  };

  const handleUserUpdated = (updatedUserData) => {
    const newUserState = { ...user, ...updatedUserData };
    setUser(newUserState);
    localStorage.setItem('sipuro_user', JSON.stringify(newUserState));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sipuro_user');
    navigate('/login');
  };

  const handleOpenCreate = () => {
    if (user && user.role !== 'CUSTOMER') {
      showAlert({
        type: 'warning',
        title: 'Access Restricted',
        message: 'Only Customers can create new Purchase Orders.'
      });
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
    setShowBanner(false);

    // Tandai hanya notifikasi banner ini yang dibaca jika ID-nya ada
    if (bannerNotif?.id) {
      try {
        await markAsRead(bannerNotif.id);
      } catch (err) {
        console.error('Failed to mark notification as read from banner:', err);
      }
    }

    // Navigasi dengan aman menggunakan Optional Chaining (?.)
    if (bannerNotif?.link) {
      // Mendukung link relatif/query string yang sama seperti di handleItemClick
      const urlParts = bannerNotif.link.split('?');
      const pathPart = urlParts[0].startsWith('/') ? urlParts[0] : `/${urlParts[0]}`;
      const queryString = urlParts[1] ? `?${urlParts[1]}` : '';

      navigate(`${pathPart}${queryString}`);
    }

    setRefreshKey((prev) => prev + 1);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const defaultRedirect = getDefaultPath(user);

  return (
    <div className="App" style={{ padding: '20px' }}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        setShowBanner={(status, notif) => {
          setShowBanner(status);
          if (notif) setBannerNotif(notif);
        }}
      />

      <GlobalNotificationBanner
        show={showBanner}
        message={bannerNotif?.message || 'There is new notification.'}
        onRefresh={handleBannerRefresh}
      />

      <Routes>
        <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
        <Route path="/po-list" element={
          <POPage
            key={refreshKey}
            customerId={user.role === 'CUSTOMER' ? user.customer_id : null}
            user={user}
            onCreateNewPO={handleOpenCreate}
            onSelectPODetail={handleSelectPODetail}
          />
        } />
        <Route path="/ppic-dashboard" element={<Dashboard />} />
        <Route path="/ppic-batch" element={<BatchPage currentUser={user} />} />
        <Route path="/ppic-production-schedule" element={<ProductionSchedulePage />} />
        <Route path="/delivery-order" element={<DOPage />} />

        <Route path="/sa-employees" element={<EmployeeListPage />} />
        <Route path="/sa-customers" element={<CustomerUserListPage />} />
        <Route path="/sa-products" element={<ProductListPage />} />
        <Route path="/sa-prices" element={<PriceListPage />} />

        <Route path="/profile" element={
          <ProfilePage currentUser={user} onUserUpdated={handleUserUpdated} />
        } />

        <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
      </Routes>

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

export default function App() {
  return (
    <ModalProvider>
      <MainApp />
    </ModalProvider>
  );
}
