/**
 * Pemeriksaan izin di sisi tampilan. Izin berasal dari server (GET /permissions/me):
 *   { MENU: ['read', 'upload', ...] }
 * Server tetap yang menentukan; ini hanya untuk menampilkan menu dan tombol yang relevan.
 */
export const canAccess = (permissions, menu, action) => (
    Boolean(permissions && Array.isArray(permissions[menu]) && permissions[menu].includes(action))
);
