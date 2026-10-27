'use strict';

/**
 * Tes pemuatan modul Production Lot setelah dipindah ke struktur baru
 * (controllers/production-lot/*, services/production-lot/*).
 *
 * Tujuan: salah ketik jalur require atau file lama yang lupa dihapus langsung ketahuan.
 * Database, xlsx, dan helper PO diganti tiruan; tidak ada query yang dijalankan.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'xlsx') return { utils: {}, SSF: {} };
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    if (request.endsWith('/helpers/dateHelper')) return { getWibDate: () => new Date() };
    return originalLoad.apply(this, arguments);
};

const EXPECTED_EXPORTS = {
    'controllers/production-lot/allocation/lotMappingListController': ['getAllocatedLotMapping'],
    'controllers/production-lot/allocation/lotAllocationLogController': ['getAllocationHistory'],
    'controllers/production-lot/export/lotExportController': ['exportLotMappingExcel'],
    'controllers/production-lot/allocation/lotAllocationQtyController': ['updateAllocationQty'],
    'controllers/production-lot/allocation/lotAllocationStatusController': ['updateAllocationStatus'],
    'controllers/production-lot/import/lotUploadPreviewController': ['previewExcelUpload'],
    'controllers/production-lot/import/lotUploadCommitController': ['commitExcelAllocation'],
    'services/production-lot/lotUploadParser': ['parseProductionExcel', 'parseExcelDateTime'],
    'services/production-lot/lotAllocationCalculator': ['calculateLotFifoAllocation', 'computeAllocationFingerprint'],
    'services/production-lot/lotContextLoader': ['loadProductionLotContext'],
    'services/production-lot/lotCommitService': ['commitProductionAllocationTransaction'],
    'services/production-lot/lotStatusService': [
        'getPOTolerance',
        'refreshPOStatus',
        'resolveBatchStatus',
        'refreshBatchStatuses',
        'recalculateFulfilledQty',
        'syncAllocationStatuses',
        'syncBatchCompletedDates'
    ],
    'services/production-lot/lotAllocationRules': ['allocatedQtySql', 'allocationKey', 'lotBatchKey', 'lotKey'],
    'helpers/arrayUtils': ['chunk'],
    'helpers/excelDate': ['toExcelDate'],
    'services/production-lot/lotLockedTransaction': ['runInLockedTransaction'],
    'services/production-lot/lotActor': ['parseActorId', 'assertActorExists'],
    'services/production-lot/lotProductionTotals': ['getNetProducedQty', 'getLotBatchCapacity'],
    'services/production-lot/lotAllocationAdjustService': ['parseAllocationId', 'parseReason', 'parseNewQty', 'adjustAllocationQty', 'forceCloseAllocation'],
    'services/production-lot/lotExportQuery': ['fetchExportData'],
    'services/production-lot/lotExportWorkbook': ['buildAllocationRows', 'buildPoItemRows', 'buildExportWorkbookBuffer', 'buildExportFileName'],
    'helpers/queryParams': ['asText', 'parsePositiveInt', 'parsePageParams', 'parseDateParam', 'escapeLike'],
    'services/production-lot/lotMappingFilters': ['buildMappingFilters', 'parseMappingRequest'],
    'services/production-lot/lotMappingQuery': ['fetchMappingPage', 'shapeByPo', 'shapeByBatch', 'shapeByLot'],
    'services/production-lot/lotAllocationLog': ['logAllocationInsert', 'logAllocationUpdate', 'getAllocationLogs']
};

// File lama yang sudah dipindah/dihapus. Jika masih ada, berarti ada kode ganda.
const REMOVED_PATHS = [
    'controllers/production-lot/productionLotController.js',
    'controllers/production-lot/get',
    'controllers/production-lot/import/productionLotImportController.js',
    'controllers/production-lot/import/productionLotPreviewController.js',
    'controllers/production-lot/import/productionLotCommitController.js',
    'helpers/upload-production-lot',
    'helpers/lotBatchHelper.js',
    'helpers/poLotAllocationLogHelper.js'
];

for (const [modulePath, names] of Object.entries(EXPECTED_EXPORTS)) {
    test(`${modulePath} termuat dan mengekspor fungsi yang diharapkan`, () => {
        const loaded = require(path.join(ROOT, modulePath));
        for (const name of names) {
            assert.equal(typeof loaded[name], 'function', `${modulePath}: ${name} bukan fungsi`);
        }
    });
}

test('file lama modul lot sudah tidak ada (tidak ada kode ganda)', () => {
    const stillThere = REMOVED_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)));
    assert.deepEqual(stillThere, [], `Hapus/pindahkan file lama berikut: ${stillThere.join(', ')}`);
});
