// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO_LIST: { id: 'po-list', label: 'Purchase Order', path: '/po-list' },
    PPIC_DASHBOARD: { id: 'ppic-dashboard', label: 'Dashboard', path: '/ppic-dashboard' },
    PPIC_BATCH: { id: 'ppic-batch', label: 'Batch', path: '/ppic-batch' },
    PPIC_PRODUCTION_SCHEDULE: { id: 'ppic-production-schedule', label: 'Production Schedule', path: '/ppic-production-schedule' },
    DELIVERY_ORDER: { id: 'delivery-order', label: 'Delivery Order', path: '/delivery-order' },
    SA_EMPLOYEES: { id: 'sa-employees', label: 'Employee User', path: '/sa-employees' },
    SA_CUSTOMERS: { id: 'sa-customers', label: 'Customer User', path: '/sa-customers' },
    SA_PRODUCTS: { id: 'sa-products', label: 'Product', path: '/sa-products' },
    SA_PRICES: { id: 'sa-prices', label: 'Selling Price', path: '/sa-prices' },
    PROFILE: { id: 'profile', label: 'Profile', path: '/profile' }
};

export const getNavItemsByUser = (user) => {
    if (!user) return [];

    const userRole = (user.role || '').toUpperCase();
    const userDept = (user.department || '').toUpperCase();

    if (userRole === 'CUSTOMER') {
        return [
            NAV_ITEMS.PO_LIST,
            NAV_ITEMS.PPIC_BATCH,
            NAV_ITEMS.PROFILE
        ];
    }

    if (userRole === 'SUPERADMIN') {
        return [
            NAV_ITEMS.PPIC_DASHBOARD,
            NAV_ITEMS.PO_LIST,
            NAV_ITEMS.PPIC_BATCH,
            NAV_ITEMS.PPIC_PRODUCTION_SCHEDULE,
            NAV_ITEMS.DELIVERY_ORDER,
            NAV_ITEMS.SA_EMPLOYEES,
            NAV_ITEMS.SA_CUSTOMERS,
            NAV_ITEMS.SA_PRODUCTS,
            NAV_ITEMS.SA_PRICES,
            NAV_ITEMS.PROFILE
        ];
    }

    if (userDept === 'PPIC' && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.PPIC_DASHBOARD,
            NAV_ITEMS.PO_LIST,
            NAV_ITEMS.PPIC_BATCH,
            NAV_ITEMS.PPIC_PRODUCTION_SCHEDULE,
            NAV_ITEMS.PROFILE
        ];
    }

    if ((userDept === 'LOGISTICS' || userDept === 'LOGISTIC' || userDept === 'FINANCE') && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.DELIVERY_ORDER,
            NAV_ITEMS.PROFILE
        ];
    }

    return [NAV_ITEMS.PROFILE];
};
