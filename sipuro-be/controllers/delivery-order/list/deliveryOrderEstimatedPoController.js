const { sipuroDb } = require('../../../config/db');
const { parseEstimatedPoRequest, fetchEstimatedPo } = require('../../../services/delivery-order/deliveryOrderEstimatedPo');
const { sendControllerError } = require('../../../helpers/businessError');

// Perkiraan PO untuk beberapa DO sekaligus (DO yang sedang tampil di halaman). Hanya baca.
exports.getEstimatedPo = async (req, res) => {
    try {
        const { doIds } = parseEstimatedPoRequest(req.query);
        const data = await fetchEstimatedPo(sipuroDb, doIds);
        return res.json({ success: true, data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error fetching estimated PO',
            fallbackMessage: 'Failed to fetch estimated PO.'
        });
    }
};
