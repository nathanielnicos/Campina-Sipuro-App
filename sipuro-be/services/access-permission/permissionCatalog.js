'use strict';

/**
 * Katalog izin akses: kelompok pengguna, aksi, dan menu beserta aksi yang berlaku padanya.
 * Satu-satunya definisi yang dipakai middleware, halaman pengaturan, dan seed migrasi.
 * Tidak ada aksi hapus: data tidak dihapus lewat aplikasi (gunakan aktif/nonaktif atau koreksi).
 */

// Kelompok pengguna (lihat hasAccess di middleware/auth.js)
const GROUPS = ['CUSTOMER', 'SUPERADMIN', 'PPIC', 'LOGISTIC', 'FINANCE'];

const ACTIONS = ['read', 'create', 'update', 'upload', 'approve', 'export'];

const MENUS = {
    DASHBOARD:           { label: 'Dashboard',            actions: ['read'] },
    PO:                  { label: 'Purchase Order',       actions: ['read', 'create', 'update', 'approve', 'export'] },
    OUTSTANDING_PO:      { label: 'Outstanding PO',       actions: ['read', 'create', 'approve'] },
    PRODUCTION_LOT:      { label: 'Production Lot',       actions: ['read', 'update', 'upload', 'export'] },
    PRODUCTION_SCHEDULE: { label: 'Production Schedule',  actions: ['read', 'create', 'update'] },
    DO:                  { label: 'Delivery Order',       actions: ['read', 'upload'] },
    SI:                  { label: 'Sales Invoice',        actions: ['read', 'upload'] },
    EMPLOYEES:           { label: 'Employee User',        actions: ['read', 'update'] },
    CUSTOMERS:           { label: 'Customer User',        actions: ['read', 'update'] },
    PRODUCTS:            { label: 'Product',              actions: ['read', 'upload'] },
    PRODUCT_CODE_MAPPING:{ label: 'Product Code Mapping', actions: ['read', 'create', 'update'] },
    PRICES:              { label: 'Selling Price',        actions: ['read', 'upload'] },
    SETTINGS:            { label: 'Setting',              actions: ['read', 'update'] },
    ACCESS_PERMISSIONS:  { label: 'Access Permission',    actions: ['read', 'update'] }
};

// Menu pengaturan izin: SUPERADMIN selalu penuh dan tidak bisa dimatikan (agar tidak terkunci dari sistem)
const LOCKED_MENU = 'ACCESS_PERMISSIONS';
const LOCKED_GROUP = 'SUPERADMIN';

const isValidGroup = (group) => GROUPS.includes(group);
const isValidMenuAction = (menu, action) => Boolean(MENUS[menu] && MENUS[menu].actions.includes(action));
const isLockedCell = (group, menu) => group === LOCKED_GROUP && menu === LOCKED_MENU;

const cellKey = (group, menu, action) => `${group}|${menu}|${action}`;

module.exports = {
    GROUPS, ACTIONS, MENUS, LOCKED_MENU, LOCKED_GROUP,
    isValidGroup, isValidMenuAction, isLockedCell, cellKey
};
