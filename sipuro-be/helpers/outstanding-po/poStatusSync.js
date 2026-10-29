'use strict';

/**
 * Satu-satunya titik sambung modul Outstanding PO ke perhitungan status header PO.
 *
 * Menunjuk ke refreshPOStatus modul Production Lot (services/production-lot/lotStatusService.js),
 * yang membaca po_lot_allocations. Bila perhitungan status berubah lagi, cukup fungsi ini yang diganti;
 * controller Outstanding PO tidak perlu diubah.
 */

const { refreshPOStatus } = require('../../services/production-lot/lotStatusService');

const syncHeaderStatus = (connection, poHeaderId) => refreshPOStatus(connection, poHeaderId);

module.exports = { syncHeaderStatus };
