'use strict';

/**
 * Satu-satunya titik sambung modul Outstanding PO ke perhitungan status header PO.
 *
 * Saat ini menunjuk ke refreshPOStatus (helpers/batchHelper.js), yang membaca po_batch_allocations.
 * Ketika upload produksi dirombak ke po_lot_allocations, cukup fungsi ini yang diganti;
 * controller Outstanding PO tidak perlu diubah.
 */

const { refreshPOStatus } = require('../batchHelper');

const syncHeaderStatus = (connection, poHeaderId) => refreshPOStatus(connection, poHeaderId);

module.exports = { syncHeaderStatus };
