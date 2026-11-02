'use strict';

/**
 * Matriks izin dari database (tabel access_permissions) dengan cache singkat.
 * Cache dibersihkan saat Superadmin menyimpan; instance serverless lain menyesuaikan setelah CACHE_TTL_MS.
 * Sel yang tidak ada di tabel dianggap tidak diizinkan.
 */

const { hasAccess } = require('../../middleware/auth');
const { GROUPS, MENUS, cellKey, isLockedCell } = require('./permissionCatalog');

const CACHE_TTL_MS = 15000;

let cache = null; // { allowed: Set<cellKey>, loadedAt }

const invalidatePermissionCache = () => { cache = null; };

const loadAllowedSet = async (queryable) => {
    const [rows] = await queryable.query(
        'SELECT group_code, menu_code, action FROM access_permissions WHERE is_allowed = 1'
    );
    return new Set(rows.map((r) => cellKey(r.group_code, r.menu_code, r.action)));
};

const getAllowedSet = async (queryable, now = Date.now()) => {
    if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.allowed;
    const allowed = await loadAllowedSet(queryable);
    cache = { allowed, loadedAt: now };
    return allowed;
};

/** Kelompok pengguna (satu pengguna = satu kelompok); null bila tidak termasuk kelompok mana pun. */
const groupOf = (user) => GROUPS.find((group) => hasAccess(user, group)) || null;

const isAllowedIn = (allowed, group, menu, action) => {
    if (!group) return false;
    if (isLockedCell(group, menu)) return true;
    return allowed.has(cellKey(group, menu, action));
};

const isAllowed = async (queryable, user, menu, action) => {
    const allowed = await getAllowedSet(queryable);
    return isAllowedIn(allowed, groupOf(user), menu, action);
};

/** { MENU: [aksi, ...] } untuk satu kelompok (menu tanpa aksi tidak dimuat). */
const permissionsOfGroup = (allowed, group) => {
    const result = {};
    Object.entries(MENUS).forEach(([menu, def]) => {
        const actions = def.actions.filter((action) => isAllowedIn(allowed, group, menu, action));
        if (actions.length > 0) result[menu] = actions;
    });
    return result;
};

/** Izin pengguna ini; dipakai FE untuk menu dan tombol. */
const permissionsOf = async (queryable, user) => {
    const allowed = await getAllowedSet(queryable);
    return permissionsOfGroup(allowed, groupOf(user));
};

module.exports = { groupOf, isAllowed, permissionsOf, permissionsOfGroup, invalidatePermissionCache, loadAllowedSet, CACHE_TTL_MS };
