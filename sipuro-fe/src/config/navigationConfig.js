// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO_LIST: { id: 'po-list', label: 'Purchase Order' },
    PPIC_DASHBOARD: { id: 'ppic-dashboard', label: 'Dashboard' },
    PPIC_BATCH: { id: 'ppic-batch', label: 'Batch' },
    DELIVERY_ORDER: { id: 'delivery-order', label: 'Delivery Order' },
    SA_EMPLOYEES: { id: 'sa-employees', label: 'Employee User' },
    SA_CUSTOMERS: { id: 'sa-customers', label: 'Customer User' },
    SA_PRODUCTS: { id: 'sa-products', label: 'Product' },
    SA_PRICES: { id: 'sa-prices', label: 'Selling Price' },
    PROFILE: { id: 'profile', label: 'Profile' }
};

/**
 * Helper untuk mendapatkan daftar menu berdasarkan Role dan Department.
 * 
 * Aturan Akses:
 * 1. CUSTOMER   : role === 'CUSTOMER' (department = null)
 * 2. SUPERADMIN : role === 'SUPERADMIN' (department bebas)
 * 3. PPIC       : department === 'PPIC' dan role === 'STAFF' atau 'MANAGER'
 * 4. LOGISTICS  : department === 'LOGISTICS' (atau LOGISTIC) dan role === 'STAFF' atau 'MANAGER'
 * 5. FINANCE    : department === 'FINANCE' dan role === 'STAFF' atau 'MANAGER'
 */
export const getNavItemsByUser = (user) => {
    if (!user) return [];

    const userRole = (user.role || '').toUpperCase();
    const userDept = (user.department || '').toUpperCase();

    // 1. Akses untuk Customer User
    if (userRole === 'CUSTOMER') {
        return [
            NAV_ITEMS.PO_LIST,
            NAV_ITEMS.PPIC_BATCH,
            NAV_ITEMS.PROFILE
        ];
    }

    // 2. Akses untuk Superadmin (Wajib role SUPERADMIN, department bebas)
    if (userRole === 'SUPERADMIN') {
        return [
            NAV_ITEMS.SA_EMPLOYEES,
            NAV_ITEMS.SA_CUSTOMERS,
            NAV_ITEMS.SA_PRODUCTS,
            NAV_ITEMS.SA_PRICES,
            NAV_ITEMS.PROFILE
        ];
    }

    // 3. Akses untuk PPIC (Department PPIC, Role STAFF atau MANAGER)
    if (userDept === 'PPIC' && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.PPIC_DASHBOARD,
            NAV_ITEMS.PO_LIST,
            NAV_ITEMS.PPIC_BATCH,
            NAV_ITEMS.PROFILE
        ];
    }

    // 4. Akses untuk LOGISTICS & FINANCE (Department LOGISTICS/LOGISTIC/FINANCE, Role STAFF atau MANAGER)
    if ((userDept === 'LOGISTICS' || userDept === 'LOGISTIC' || userDept === 'FINANCE') && (userRole === 'STAFF' || userRole === 'MANAGER')) {
        return [
            NAV_ITEMS.DELIVERY_ORDER,
            NAV_ITEMS.PROFILE
        ];
    }

    // Default jika tidak cocok dengan kriteria di atas
    return [NAV_ITEMS.PROFILE];
};
