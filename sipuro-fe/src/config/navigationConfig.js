// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO: { id: 'po', label: 'Purchase Order', path: '/po' },
    DO: { id: 'do', label: 'Delivery Order', path: '/do'},
    DASHBOARD: { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    OUTSTANDING_PO: { id: 'outstanding-po', label: 'Outstanding Purchase Order', path: '/outstanding-po' },
    PRODUCTION_BATCH: { id: 'production-batch', label: 'Production Batch', path: '/production-batch' },
    PRODUCTION_LOT: { id: 'production-lot', label: 'Production Lot', path: '/production-lot'},
    PRODUCTION_SCHEDULE: { id: 'production-schedule', label: 'Production Schedule', path: '/production-schedule' },
    DOCUMENT_FLOW: { id: 'document-flow', label: 'Document Flow', path: '/document-flow' },
    EMPLOYEES: { id: 'employees', label: 'Employee User', path: '/employees' },
    CUSTOMERS: { id: 'customers', label: 'Customer User', path: '/customers' },
    PRODUCTS: { id: 'products', label: 'Product', path: '/products' },
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
            NAV_ITEMS.DASHBOARD,
            NAV_ITEMS.PO,
            NAV_ITEMS.OUTSTANDING_PO,
            NAV_ITEMS.PRODUCTION_BATCH,
            NAV_ITEMS.PRODUCTION_LOT,
            NAV_ITEMS.PRODUCTION_SCHEDULE,
            NAV_ITEMS.DOCUMENT_FLOW,
            NAV_ITEMS.EMPLOYEES,
            NAV_ITEMS.CUSTOMERS,
            NAV_ITEMS.PRODUCTS,
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
            NAV_ITEMS.PRODUCTION_BATCH,
            NAV_ITEMS.PRODUCTION_LOT,
            NAV_ITEMS.PRODUCTION_SCHEDULE,
            NAV_ITEMS.PROFILE
        ];
    }

    if ((userDept === 'LOGISTICS' || userDept === 'LOGISTIC' || userDept === 'FINANCE') && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.PROFILE
        ];
    }

    return [NAV_ITEMS.PROFILE];
};
