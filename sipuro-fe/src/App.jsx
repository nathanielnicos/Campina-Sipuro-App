import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import POPage from './components/po/page/POPage';
import OutstandingPoPage from './components/outstanding-po/page/OutstandingPoPage';
import ProductionLotPage from './components/production-lot/page/ProductionLotPage';
import ProductionSchedulePage from './components/productionSchedule/page/ProductionSchedulePage';
import Dashboard from './components/dashboard/Dashboard';

import EmployeeListPage from './components/master/EmployeeListPage';
import CustomerUserListPage from './components/master/CustomerUserListPage';
import ProductListPage from './components/master/ProductListPage';
import ProductCodeMappingPage from './components/master/product-code-mapping/ProductCodeMappingPage';
import PriceListPage from './components/master/PriceListPage';
import SettingPage from './components/master/SettingPage';
import AccessPermissionPage from './components/master/access-permission/AccessPermissionPage';

import DoPage from './components/do/page/DoPage';
import SiPage from './components/si/page/SalesInvoicePage';
import ProfilePage from './components/profile/ProfilePage';

import Login from './components/auth/Login';
import Navbar from './components/navigation/Navbar';
import GlobalNotificationBanner from './components/navigation/GlobalNotificationBanner';
import RequirePermission from './components/navigation/RequirePermission';
import { markAsRead } from './services/notificationApi';
import { getToken, clearSession, SESSION_EXPIRED_EVENT } from './services/apiClient';
import { getNavItemsByUser } from './config/navigationConfig';
import { useLoadPermissions } from './hooks/auth/useLoadPermissions';

import { ModalProvider } from './context/ModalContext';
import { PermissionProvider } from './context/PermissionContext';

function MainApp() {
  const [user, setUser] = useState(null);
  const { permissions, status: permissionStatus, reload: reloadPermissions } = useLoadPermissions(user);
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

  // Halaman awal = menu pertama yang boleh dilihat pengguna (Profile bila tidak ada izin lain)
  const getDefaultPath = (userData) => {
    if (!userData) return '/profile';
    const userMenus = getNavItemsByUser(userData, permissions);
    return userMenus.length > 0 ? userMenus[0].path : '/profile';
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sipuro_user', JSON.stringify(userData));
    // Izin dimuat setelah login; route '/' mengarahkan ke halaman awal begitu izin siap
    navigate('/');
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

  if (permissionStatus === 'idle' || permissionStatus === 'loading') {
    return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading permissions...</div>;
  }

  const defaultRedirect = getDefaultPath(user);
  const guard = (menu, element) => (
    <RequirePermission menu={menu} redirectTo={defaultRedirect}>{element}</RequirePermission>
  );

  return (
    <PermissionProvider permissions={permissions} refresh={reloadPermissions}>
    <div className="App" style={{ padding: '20px' }}>
      <Navbar
        user={user}
        onLogout={handleLogout}
        setShowBanner={(status, notif) => {
          setShowBanner(status);
          if (notif) setBannerNotif(notif);
        }}
      />

      {permissionStatus === 'error' && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Failed to load your permissions, so only the profile page is available.</span>
          <button type="button" onClick={reloadPermissions} style={{ padding: '4px 10px', cursor: 'pointer', border: '1px solid #721c24', borderRadius: '4px', backgroundColor: '#fff', color: '#721c24', fontWeight: 'bold', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      )}

      <GlobalNotificationBanner
        show={showBanner}
        message={bannerNotif?.message || 'There is new notification.'}
        onRefresh={handleBannerRefresh}
      />

      <Routes>
        <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
        <Route path="/po" element={guard('PO',
          <POPage
            customerId={user.role === 'CUSTOMER' ? user.customer_id : null}
            user={user}
            refreshSignal={refreshKey}
          />
        )} />
        <Route path="/dashboard" element={guard('DASHBOARD', <Dashboard />)} />
        <Route path="/outstanding-po" element={guard('OUTSTANDING_PO', <OutstandingPoPage currentUser={user} />)} />
        <Route path="/production-lot" element={guard('PRODUCTION_LOT', <ProductionLotPage currentUser={user} />)} />
        <Route path="/production-schedule" element={guard('PRODUCTION_SCHEDULE', <ProductionSchedulePage />)} />

        <Route path="/do" element={guard('DO', <DoPage currentUser={user} />)} />
        <Route path="/si" element={guard('SI', <SiPage currentUser={user} />)} />

        <Route path="/employees" element={guard('EMPLOYEES', <EmployeeListPage />)} />
        <Route path="/customers" element={guard('CUSTOMERS', <CustomerUserListPage />)} />
        <Route path="/products" element={guard('PRODUCTS', <ProductListPage />)} />
        <Route path="/product-code-mappings" element={guard('PRODUCT_CODE_MAPPING', <ProductCodeMappingPage />)} />
        <Route path="/prices" element={guard('PRICES', <PriceListPage />)} />
        <Route path="/settings" element={guard('SETTINGS', <SettingPage />)} />
        <Route path="/access-permissions" element={guard('ACCESS_PERMISSIONS', <AccessPermissionPage />)} />

        <Route path="/profile" element={
          <ProfilePage currentUser={user} onUserUpdated={handleUserUpdated} />
        } />

        <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
      </Routes>
    </div>
    </PermissionProvider>
  );
}

export default function App() {
  return (
    <ModalProvider>
      <MainApp />
    </ModalProvider>
  );
}
