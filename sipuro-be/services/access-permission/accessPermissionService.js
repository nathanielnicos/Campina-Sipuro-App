'use strict';

/**
 * Pengelolaan matriks izin akses oleh Superadmin: tampilan matriks, simpan perubahan (dengan riwayat), dan riwayat.
 * Tidak ada penghapusan: sel hanya diizinkan atau tidak (is_allowed). Perubahan berjalan di transaksi ber-lock
 * (helpers/lockedTransaction); cache izin dibersihkan oleh pemanggil setelah commit.
 */

const { BusinessError } = require('../../helpers/businessError');
const {
    GROUPS, MENUS, isValidGroup, isValidMenuAction, isLockedCell, cellKey
} = require('./permissionCatalog');
const { loadAllowedSet, permissionsOfGroup } = require('./permissionStore');

const MAX_CHANGES = 200;

// ---------- Pembacaan input (murni) ----------

/** @returns {Array<{group, menu, action, allowed}>} perubahan yang sudah divalidasi */
const parseChanges = (body) => {
    const changes = body && body.changes;
    if (!Array.isArray(changes) || changes.length === 0) {
        throw new BusinessError('At least one permission change is required.', 400);
    }
    if (changes.length > MAX_CHANGES) {
        throw new BusinessError(`At most ${MAX_CHANGES} permission changes can be saved at once.`, 400);
    }

    const seen = new Set();
    return changes.map((raw, index) => {
        const item = raw || {};
        const label = `Change ${index + 1}`;
        if (!isValidGroup(item.group)) throw new BusinessError(`${label}: unknown user group.`, 400);
        if (!isValidMenuAction(item.menu, item.action)) throw new BusinessError(`${label}: unknown menu or action.`, 400);
        if (typeof item.allowed !== 'boolean') throw new BusinessError(`${label}: allowed must be true or false.`, 400);
        if (!item.allowed && isLockedCell(item.group, item.menu)) {
            throw new BusinessError('Superadmin access to Access Permission cannot be removed.', 400);
        }
        const key = cellKey(item.group, item.menu, item.action);
        if (seen.has(key)) throw new BusinessError(`${label}: the same permission appears more than once.`, 400);
        seen.add(key);
        return { group: item.group, menu: item.menu, action: item.action, allowed: item.allowed };
    });
};

// ---------- Tampilan matriks ----------

const loadMatrixView = async (queryable) => {
    const allowed = await loadAllowedSet(queryable);
    const matrix = {};
    GROUPS.forEach((group) => { matrix[group] = permissionsOfGroup(allowed, group); });

    return {
        groups: GROUPS,
        menus: Object.entries(MENUS).map(([code, def]) => ({ code, label: def.label, actions: def.actions })),
        matrix,
        locked: GROUPS.flatMap((group) => Object.keys(MENUS)
            .filter((menu) => isLockedCell(group, menu))
            .map((menu) => ({ group, menu })))
    };
};

// ---------- Simpan ----------

const applyChanges = async (connection, { changes, userId }) => {
    const [existing] = await connection.query(
        `SELECT group_code, menu_code, action, is_allowed FROM access_permissions
         WHERE (group_code, menu_code, action) IN (?) FOR UPDATE`,
        [changes.map((c) => [c.group, c.menu, c.action])]
    );
    const current = new Map(existing.map((r) => [cellKey(r.group_code, r.menu_code, r.action), Number(r.is_allowed) === 1]));

    const effective = changes.filter((c) => (current.get(cellKey(c.group, c.menu, c.action)) || false) !== c.allowed);
    if (effective.length === 0) return { changedCount: 0 };

    await connection.query(
        `INSERT INTO access_permissions (group_code, menu_code, action, is_allowed, updated_by) VALUES ?
         ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed), updated_by = VALUES(updated_by)`,
        [effective.map((c) => [c.group, c.menu, c.action, c.allowed ? 1 : 0, userId])]
    );
    await connection.query(
        'INSERT INTO access_permission_logs (group_code, menu_code, action, old_allowed, new_allowed, changed_by) VALUES ?',
        [effective.map((c) => [
            c.group, c.menu, c.action,
            current.get(cellKey(c.group, c.menu, c.action)) ? 1 : 0,
            c.allowed ? 1 : 0,
            userId
        ])]
    );
    return { changedCount: effective.length };
};

// ---------- Riwayat ----------

const listLogs = async (queryable, { page, limit, offset }) => {
    const [[countRow]] = await queryable.query('SELECT COUNT(*) AS total FROM access_permission_logs');
    const totalItems = Number(countRow && countRow.total) || 0;

    const [rows] = await queryable.query(
        `SELECT l.id, l.group_code, l.menu_code, l.action, l.old_allowed, l.new_allowed,
                DATE_FORMAT(l.changed_at, '%Y-%m-%d %H:%i:%s') AS changed_at, e.full_name AS changed_by_name
         FROM access_permission_logs l
         LEFT JOIN employees e ON e.id = l.changed_by
         ORDER BY l.id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    return {
        data: rows.map((r) => ({
            id: r.id,
            group: r.group_code,
            menu: r.menu_code,
            action: r.action,
            oldAllowed: Number(r.old_allowed) === 1,
            newAllowed: Number(r.new_allowed) === 1,
            changedAt: r.changed_at,
            changedBy: r.changed_by_name
        })),
        pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) }
    };
};

module.exports = { MAX_CHANGES, parseChanges, loadMatrixView, applyChanges, listLogs };
