import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import POPage from './components/po/page/POPage';
import BatchPage from './components/batch/page/BatchPage';
import OutstandingPoPage from './components/outstanding-po/page/OutstandingPoPage';
import ProductionLotPage from './components/production-lot/page/ProductionLotPage';
import ProductionSchedulePage from './components/productionSchedule/page/ProductionSchedulePage';
import Dashboard from './components/dashboard/Dashboard';

import EmployeeListPage from './components/master/EmployeeListPage';
import CustomerUserListPage from './components/master/CustomerUserListPage';
import ProductListPage from './components/master/ProductListPage';
import PriceListPage from './components/master/PriceListPage';
import SettingPage from './components/master/SettingPage';

import DocumentFlowPage from './components/documentFlow/page/DocumentFlowPage';
import ProfilePage from './components/profile/ProfilePage';

import Login from './components/auth/Login';
import Navbar from './components/navigation/Navbar';
import GlobalNotificationBanner from './components/navigation/GlobalNotificationBanner';
import { markAsRead } from './services/notificationApi';
import { getToken, clearSession, SESSION_EXPIRED_EVENT } from './services/apiClient';
import { getNavItemsByUser } from './config/navigationConfig';
import { parseLegacyQuery, getRoleFlags } from './utils/outstandingPoHelpers';

import { ModalProvider } from './context/ModalContext';

// Menu Batch kini khusus PPIC. Customer dan tautan notifikasi lama
// (/ppic-batch?po=...&product=...) dialihkan ke menu Outstanding PO.
function BatchRoute({ user }) {
  const location = useLocation();
  const legacy = parseLegacyQuery(location.search);
  const hasLegacyFilter = Boolean(legacy.po || legacy.product);
  const { isPpic } = getRoleFlags(user);

  if (hasLegacyFilter || !isPpic) {
    return <Navigate to={`/outstanding-po${location.search}`} replace />;
  }
  return <BatchPage currentUser={user} />;
}

function MainApp() {
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();

  const [showBanner, setShowBanner] = useState(false);
  const [bannerNotif, setBannerNotif] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('sipuro_user');
    // Sesi hanya dipulihkan jika token login masih tersimpan.
    // Sesi lama tanpa token (sebelum sistem token) dibersihkan dan pengguna diminta login ulang.
    if (savedUser && getToken()) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    } else if (savedUser) {
      clearSession();
    }
  }, []);

  // Dipicu apiClient saat server menyatakan sesi tidak berlaku (token kedaluwarsa / akun dinonaktifkan).
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [navigate]);

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
    clearSession();
    navigate('/login');
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
            customerId={user.role === 'CUSTOMER' ? user.customer_id : null}
            user={user}
            refreshSignal={refreshKey}
          />
        } />
        <Route path="/ppic-dashboard" element={<Dashboard />} />
        <Route path="/ppic-batch" element={<BatchRoute user={user} />} />
        <Route path="/outstanding-po" element={<OutstandingPoPage currentUser={user} />} />
        <Route path="/ppic-production-lot" element={<ProductionLotPage currentUser={user} />} />
        <Route path="/ppic-production-schedule" element={<ProductionSchedulePage />} />
        
        <Route path="/document-flow" element={<DocumentFlowPage currentUser={user} />} />

        <Route path="/sa-employees" element={<EmployeeListPage />} />
        <Route path="/sa-customers" element={<CustomerUserListPage />} />
        <Route path="/sa-products" element={<ProductListPage />} />
        <Route path="/sa-prices" element={<PriceListPage />} />
        <Route path="/sa-settings" element={<SettingPage />} />

        <Route path="/profile" element={
          <ProfilePage currentUser={user} onUserUpdated={handleUserUpdated} />
        } />

        <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
      </Routes>
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
