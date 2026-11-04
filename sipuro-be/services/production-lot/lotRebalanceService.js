'use strict';

/**
 * Penyusunan ulang alokasi lot (rebalance) satu produk: pratinjau dan commit.
 * Pratinjau tidak menyimpan apa pun. Commit menghitung ulang di dalam transaksi ber-lock dan hanya menyimpan
 * bila sidik jari hasilnya sama dengan yang dilihat pengguna (seperti upload): semua atau tidak sama sekali.
 */

const { BusinessError } = require('../../helpers/businessError');
const { parseIdParam } = require('../../helpers/queryParams');
const { loadRebalanceInput } = require('./lotRebalanceLoader');
const { calculateRebalance, computeRebalanceFingerprint } = require('./lotRebalanceCalculator');
const { persistAllocationItems } = require('./lotAllocationPersist');
const { allocationKey } = require('./lotAllocationRules');
const { parseReason } = require('./lotAllocationAdjustService');

const SYNC_REASON = 'Auto status sync after allocation rebalance';

const parseProductId = (raw) => parseIdParam(raw, 'Product ID');

const parseFingerprint = (raw) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!/^[0-9a-f]{64}$/.test(value)) {
        throw new BusinessError('Preview fingerprint is required. Please run the preview again.', 400);
    }
    return value;
};

// Produk yang punya lot (pilihan produk di layar rebalance); kode lama dan baru satu keluarga dipilih salah satunya.
const PRODUCT_LIST_LIMIT = 500;
const listRebalanceProducts = async (queryable) => {
    const [rows] = await queryable.query(
        `SELECT p.id_product, p.product_code, p.product_name
         FROM products p
         WHERE EXISTS (SELECT 1 FROM lots l WHERE l.id_product = p.id_product)
         ORDER BY p.product_code ASC
         LIMIT ?`,
        [PRODUCT_LIST_LIMIT]
    );
    return rows;
};

const previewRebalance = async (queryable, { productId }) => {
    const input = await loadRebalanceInput(queryable, productId);
    const calculation = calculateRebalance(input);
    return { ...calculation, fingerprint: computeRebalanceFingerprint(calculation) };
};

const commitRebalance = async (connection, { productId, fingerprint, reason, userId }) => {
    const input = await loadRebalanceInput(connection, productId, { forUpdate: true });
    const calculation = calculateRebalance(input);

    if (calculation.blockers.length > 0) {
        throw new BusinessError('The allocation cannot be rebalanced.', 422, { problems: calculation.blockers });
    }
    if (computeRebalanceFingerprint(calculation) !== fingerprint) {
        throw new BusinessError('The allocation data has changed since the preview. Please run the preview again.', 409);
    }
    if (calculation.changes.length === 0) {
        throw new BusinessError('There is nothing to rebalance.', 400);
    }

    const items = new Map();
    calculation.changes.forEach((c) => {
        items.set(allocationKey(c.poDetailId, c.lotId, c.batchId), {
            poDetailId: c.poDetailId,
            lotId: c.lotId,
            batchId: c.batchId,
            addedQty: c.finalQty - c.currentQty,
            rowStatus: c.rowStatus,
            transTypes: [...new Set(c.steps.map((s) => s.transType))],
            steps: c.steps
        });
    });

    const { allocationCount } = await persistAllocationItems(connection, {
        items,
        userId,
        reason,
        syncReason: SYNC_REASON,
        problemsMessage: 'The rebalanced allocation would exceed or go below the PO quantity limits. Please run the preview again.'
    });

    return {
        productId: calculation.productId,
        changedAllocationCount: allocationCount,
        reversedManualEditCount: calculation.reversals.length,
        poItemStatusChangeCount: calculation.poSummary.filter((p) => p.statusBefore !== p.statusAfter).length
    };
};

module.exports = { parseProductId, parseFingerprint, parseReason, listRebalanceProducts, previewRebalance, commitRebalance };
