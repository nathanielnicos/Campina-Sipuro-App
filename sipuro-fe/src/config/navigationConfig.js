// Master Registry seluruh Tab/Menu di Aplikasi
export const NAV_ITEMS = {
    PO_LIST: { id: 'po-list', label: 'Daftar PO' },
    PPIC_DASHBOARD: { id: 'ppic-dashboard', label: 'Dasbor' },
    PPIC_BATCH: { id: 'ppic-batch', label: 'Alokasi Batch' },
    SA_EMPLOYEES: { id: 'sa-employees', label: 'Daftar Karyawan' },
    SA_CUSTOMERS: { id: 'sa-customers', label: 'Daftar Pelanggan' },
    SA_PRODUCTS: { id: 'sa-products', label: 'Daftar Produk' },
    SA_PRICES: { id: 'sa-prices', label: 'Daftar Harga Jual' },
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
