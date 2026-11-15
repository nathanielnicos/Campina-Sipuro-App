const { sipuroDb } = require('../../../config/db');
const {
    parseEstimatedPoRequest, parseEstimatedReturnRequest, fetchEstimatedPo, fetchEstimatedReturnPo
} = require('../../../services/delivery-order/deliveryOrderEstimatedPo');
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

// Perkiraan PO yang dilepas beberapa nomor retur sekaligus (retur yang sedang tampil di halaman). Hanya baca.
exports.getEstimatedReturnPo = async (req, res) => {
    try {
        const { returnNumbers } = parseEstimatedReturnRequest(req.query);
        const data = await fetchEstimatedReturnPo(sipuroDb, returnNumbers);
        return res.json({ success: true, data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error fetching estimated PO for returns',
            fallbackMessage: 'Failed to fetch estimated PO for returns.'
        });
    }
};
