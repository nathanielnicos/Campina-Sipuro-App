// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO_LIST: { id: 'po-list', label: 'Purchase Order' },
    PPIC_DASHBOARD: { id: 'ppic-dashboard', label: 'Dashboard' },
    PPIC_BATCH: { id: 'ppic-batch', label: 'Batch' },
    SA_EMPLOYEES: { id: 'sa-employees', label: 'Employee User' },
    SA_CUSTOMERS: { id: 'sa-customers', label: 'Customer User' },
    SA_PRODUCTS: { id: 'sa-products', label: 'Product' },
    SA_PRICES: { id: 'sa-prices', label: 'Selling Price' },
    PROFILE: { id: 'profile', label: 'Profile' }
};

// Mapping Akses Menu Berdasarkan Role User
export const ROLE_PERMISSIONS = {
    CUSTOMER: [
        NAV_ITEMS.PO_LIST,
        NAV_ITEMS.PPIC_BATCH,
        NAV_ITEMS.PROFILE
    ],
    PPIC: [
        NAV_ITEMS.PPIC_DASHBOARD,
        NAV_ITEMS.PO_LIST,
        NAV_ITEMS.PPIC_BATCH,
        NAV_ITEMS.PROFILE
    ],
    SUPERADMIN: [
        NAV_ITEMS.SA_EMPLOYEES,
        NAV_ITEMS.SA_CUSTOMERS,
        NAV_ITEMS.SA_PRODUCTS,
        NAV_ITEMS.SA_PRICES,
        NAV_ITEMS.PROFILE
    ],
    ADMIN: [
        NAV_ITEMS.SA_EMPLOYEES,
        NAV_ITEMS.SA_CUSTOMERS,
        NAV_ITEMS.SA_PRODUCTS,
        NAV_ITEMS.SA_PRICES,
        NAV_ITEMS.PROFILE
    ]
};
