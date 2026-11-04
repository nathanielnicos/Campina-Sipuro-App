const { sipuroDb } = require('../../../config/db');
const { sendControllerError } = require('../../../helpers/businessError');
const { runInLockedTransaction } = require('../../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../../helpers/actorHelper');
const {
    parseProductId,
    parseFingerprint,
    parseReason,
    listRebalanceProducts,
    previewRebalance,
    commitRebalance
} = require('../../../services/production-lot/lotRebalanceService');

/**
 * Daftar produk yang punya lot, untuk pilihan produk di layar rebalance.
 */
exports.listAllocationRebalanceProducts = async (req, res) => {
    try {
        const data = await listRebalanceProducts(sipuroDb);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error listAllocationRebalanceProducts',
            fallbackMessage: 'Internal server error while loading products.'
        });
    }
};

/**
 * Pratinjau penyusunan ulang alokasi satu produk (keluarga kodenya ikut). Tidak menyimpan apa pun.
 */
exports.previewAllocationRebalance = async (req, res) => {
    try {
        const productId = parseProductId((req.body || {}).productId);
        const data = await previewRebalance(sipuroDb, { productId });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error previewAllocationRebalance',
            fallbackMessage: 'Internal server error while previewing the allocation rebalance.'
        });
    }
};

/**
 * Simpan penyusunan ulang alokasi: dihitung ulang di dalam transaksi, sidik jari harus sama dengan pratinjau.
 */
exports.commitAllocationRebalance = async (req, res) => {
    try {
        const body = req.body || {};
        const productId = parseProductId(body.productId);
        const fingerprint = parseFingerprint(body.fingerprint);
        const reason = parseReason(body.reason);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return commitRebalance(connection, { productId, fingerprint, reason, userId });
        });

        return res.status(200).json({
            success: true,
            message: `Allocation rebalanced: ${data.changedAllocationCount} allocation(s) updated.`,
            data
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error commitAllocationRebalance',
            fallbackMessage: 'Internal server error while rebalancing the allocation.'
        });
    }
};
