// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO_LIST: { id: 'po-list', label: 'Purchase Order' },
    PPIC_DASHBOARD: { id: 'ppic-dashboard', label: 'Dashboard' },
    PPIC_BATCH: { id: 'ppic-batch', label: 'Production Batch' },
    SA_EMPLOYEES: { id: 'sa-employees', label: 'Karyawan' },
    SA_CUSTOMERS: { id: 'sa-customers', label: 'Pelanggan' },
    SA_PRODUCTS: { id: 'sa-products', label: 'Produk' },
    SA_PRICES: { id: 'sa-prices', label: 'Harga Jual' },
};

// Mapping Akses Menu Berdasarkan Role User
export const ROLE_PERMISSIONS = {
    CUSTOMER: [
        NAV_ITEMS.PO_LIST
    ],
    PPIC: [
        NAV_ITEMS.PPIC_DASHBOARD,
        NAV_ITEMS.PO_LIST,
        NAV_ITEMS.PPIC_BATCH
    ],
    SUPERADMIN: [
        NAV_ITEMS.SA_EMPLOYEES,
        NAV_ITEMS.SA_CUSTOMERS,
        NAV_ITEMS.SA_PRODUCTS,
        NAV_ITEMS.SA_PRICES
    ],
    ADMIN: [
        NAV_ITEMS.SA_EMPLOYEES,
        NAV_ITEMS.SA_CUSTOMERS,
        NAV_ITEMS.SA_PRODUCTS,
        NAV_ITEMS.SA_PRICES
    ]
};
