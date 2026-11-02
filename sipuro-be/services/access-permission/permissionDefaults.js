'use strict';

/**
 * Izin awal (seed migrasi): meniru akses yang benar-benar tersedia di aplikasi sebelum halaman izin ada
 * (menu di navbar dan pembatasan route). Kelompok lain dapat diberi izin lewat halaman Access Permission.
 * { MENU: { aksi: [kelompok yang diizinkan] } }
 */

const ALL_SUPERADMIN = ['SUPERADMIN'];

const DEFAULT_PERMISSIONS = {
    DASHBOARD: { read: ['PPIC'] },
    PO: {
        read: ['CUSTOMER', 'PPIC'],
        create: ['CUSTOMER'],
        update: ['CUSTOMER'],
        approve: ['PPIC'],
        export: ['CUSTOMER']
    },
    OUTSTANDING_PO: {
        read: ['CUSTOMER', 'PPIC'],
        create: ['CUSTOMER'],
        approve: ['PPIC']
    },
    PRODUCTION_LOT: {
        read: ['PPIC'], update: ['PPIC'], upload: ['PPIC'], export: ['PPIC']
    },
    PRODUCTION_SCHEDULE: {
        read: ['PPIC'], create: ['PPIC'], update: ['PPIC']
    },
    DO: { read: ['PPIC', 'LOGISTIC', 'FINANCE'], upload: ['LOGISTIC'] },
    SI: { read: ['FINANCE'], upload: ['FINANCE'] },
    EMPLOYEES: { read: ALL_SUPERADMIN, update: ALL_SUPERADMIN },
    CUSTOMERS: { read: ALL_SUPERADMIN, update: ALL_SUPERADMIN },
    PRODUCTS: { read: ALL_SUPERADMIN, upload: ALL_SUPERADMIN },
    PRODUCT_CODE_MAPPING: { read: ALL_SUPERADMIN, create: ALL_SUPERADMIN, update: ALL_SUPERADMIN },
    PRICES: { read: ALL_SUPERADMIN, upload: ALL_SUPERADMIN },
    SETTINGS: { read: ALL_SUPERADMIN, update: ALL_SUPERADMIN },
    ACCESS_PERMISSIONS: { read: ALL_SUPERADMIN, update: ALL_SUPERADMIN }
};

// Daftar datar [kelompok, menu, aksi] berurutan tetap (untuk seed dan perbandingan)
const defaultGrants = () => Object.entries(DEFAULT_PERMISSIONS).flatMap(([menu, actions]) =>
    Object.entries(actions).flatMap(([action, groups]) => groups.map((group) => [group, menu, action]))
);

module.exports = { DEFAULT_PERMISSIONS, defaultGrants };
