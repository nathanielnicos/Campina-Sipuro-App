import { canAccess } from '../utils/permissionHelper';

// Master Registry seluruh Tab/Menu di Aplikasi.
// `menu` = kode menu di matriks izin (backend: permissionCatalog); menu tanpa `menu` selalu tampil.
export const NAV_ITEMS = {
    PO: { id: 'po', label: 'Purchase Order', path: '/po', menu: 'PO' },
    DASHBOARD: { id: 'dashboard', label: 'Dashboard', path: '/dashboard', menu: 'DASHBOARD' },
    OUTSTANDING_PO: { id: 'outstanding-po', label: 'Outstanding Purchase Order', path: '/outstanding-po', menu: 'OUTSTANDING_PO' },
    PRODUCTION_LOT: { id: 'production-lot', label: 'Production Lot', path: '/production-lot', menu: 'PRODUCTION_LOT' },
    PRODUCTION_SCHEDULE: { id: 'production-schedule', label: 'Production Schedule', path: '/production-schedule', menu: 'PRODUCTION_SCHEDULE' },
    DO: { id: 'do', label: 'Delivery Order', path: '/do', menu: 'DO' },
    SI: { id: 'si', label: 'Sales Invoice', path: '/si', menu: 'SI' },
    EMPLOYEES: { id: 'employees', label: 'Employee User', path: '/employees', menu: 'EMPLOYEES' },
    CUSTOMERS: { id: 'customers', label: 'Customer User', path: '/customers', menu: 'CUSTOMERS' },
    PRODUCTS: { id: 'products', label: 'Product', path: '/products', menu: 'PRODUCTS' },
    PRODUCT_CODE_MAPPING: { id: 'product-code-mappings', label: 'Product Code Mapping', path: '/product-code-mappings', menu: 'PRODUCT_CODE_MAPPING' },
    PRICES: { id: 'prices', label: 'Selling Price', path: '/prices', menu: 'PRICES' },
    SETTINGS: { id: 'settings', label: 'Setting', path: '/settings', menu: 'SETTINGS' },
    ACCESS_PERMISSIONS: { id: 'access-permissions', label: 'Access Permission', path: '/access-permissions', menu: 'ACCESS_PERMISSIONS' },
    PROFILE: { id: 'profile', label: 'Profile', path: '/profile' }
};

// Urutan tampil di navbar
const NAV_ORDER = [
    NAV_ITEMS.DASHBOARD,
    NAV_ITEMS.PO,
    NAV_ITEMS.OUTSTANDING_PO,
    NAV_ITEMS.PRODUCTION_LOT,
    NAV_ITEMS.DO,
    NAV_ITEMS.PRODUCTION_SCHEDULE,
    NAV_ITEMS.SI,
    NAV_ITEMS.EMPLOYEES,
    NAV_ITEMS.CUSTOMERS,
    NAV_ITEMS.PRODUCTS,
    NAV_ITEMS.PRODUCT_CODE_MAPPING,
    NAV_ITEMS.PRICES,
    NAV_ITEMS.SETTINGS,
    NAV_ITEMS.ACCESS_PERMISSIONS,
    NAV_ITEMS.PROFILE
];

// Menu yang boleh dilihat pengguna: yang punya izin "read" pada menunya (Profile selalu ada).
export const getNavItemsByUser = (user, permissions) => {
    if (!user) return [];
    return NAV_ORDER.filter((item) => !item.menu || canAccess(permissions, item.menu, 'read'));
};
