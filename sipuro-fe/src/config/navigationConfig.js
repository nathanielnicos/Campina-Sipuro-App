// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO: { id: 'po', label: 'Purchase Order', path: '/po' },
    DASHBOARD: { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    OUTSTANDING_PO: { id: 'outstanding-po', label: 'Outstanding Purchase Order', path: '/outstanding-po' },
    PRODUCTION_LOT: { id: 'production-lot', label: 'Production Lot', path: '/production-lot'},
    PRODUCTION_SCHEDULE: { id: 'production-schedule', label: 'Production Schedule', path: '/production-schedule' },
    DO: { id: 'do', label: 'Delivery Order', path: '/do'},
    SI: { id: 'si', label: 'Sales Invoice', path: '/si' },
    EMPLOYEES: { id: 'employees', label: 'Employee User', path: '/employees' },
    CUSTOMERS: { id: 'customers', label: 'Customer User', path: '/customers' },
    PRODUCTS: { id: 'products', label: 'Product', path: '/products' },
    PRODUCT_CODE_MAPPING: { id: 'product-code-mappings', label: 'Product Code Mapping', path: '/product-code-mappings' },
    PRICES: { id: 'prices', label: 'Selling Price', path: '/prices' },
    SETTINGS: { id: 'settings', label: 'Setting', path: '/settings'},
    PROFILE: { id: 'profile', label: 'Profile', path: '/profile' }
};

export const getNavItemsByUser = (user) => {
    if (!user) return [];

    const userRole = (user.role || '').toUpperCase();
    const userDept = (user.department || '').toUpperCase();

    if (userRole === 'CUSTOMER') {
        return [
            NAV_ITEMS.PO,
            NAV_ITEMS.OUTSTANDING_PO,
            NAV_ITEMS.PROFILE
        ];
    }

    if (userRole === 'SUPERADMIN') {
        return [
            NAV_ITEMS.EMPLOYEES,
            NAV_ITEMS.CUSTOMERS,
            NAV_ITEMS.PRODUCTS,
            NAV_ITEMS.PRODUCT_CODE_MAPPING,
            NAV_ITEMS.PRICES,
            NAV_ITEMS.SETTINGS,
            NAV_ITEMS.PROFILE
        ];
    }

    if (userDept === 'PPIC' && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.DASHBOARD,
            NAV_ITEMS.PO,
            NAV_ITEMS.OUTSTANDING_PO,
            NAV_ITEMS.PRODUCTION_LOT,
            NAV_ITEMS.PRODUCTION_SCHEDULE,
            NAV_ITEMS.PROFILE
        ];
    }

    if ((userDept === 'LOGISTICS' || userDept === 'LOGISTIC') && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.DO,
            NAV_ITEMS.PROFILE
        ];
    }

    if ((userDept === 'FINANCE') && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.SI,
            NAV_ITEMS.PROFILE
        ];
    }

    return [NAV_ITEMS.PROFILE];
};
