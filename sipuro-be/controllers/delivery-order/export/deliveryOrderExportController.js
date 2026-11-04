const { sipuroDb } = require('../../../config/db');
const { getWibDate } = require('../../../helpers/dateHelper');
const { sendControllerError } = require('../../../helpers/businessError');
const { parseDeliveryOrderExportRequest } = require('../../../services/delivery-order/deliveryOrderFilters');
const { fetchExportData } = require('../../../services/delivery-order/deliveryOrderExportQuery');
const { buildExportWorkbookBuffer, buildExportFileName } = require('../../../services/delivery-order/deliveryOrderExportWorkbook');

/**
 * Ekspor Delivery Order (pengiriman, retur, saldo lot) ke Excel dengan filter yang sama dengan daftar DO.
 */
exports.exportDeliveryOrderExcel = async (req, res) => {
    try {
        const filters = parseDeliveryOrderExportRequest(req.query);
        const data = await fetchExportData(sipuroDb, filters);
        const buffer = buildExportWorkbookBuffer(data);
        const filename = buildExportFileName(getWibDate());

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Content-Length', buffer.length);

        return res.status(200).end(buffer);
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error exporting delivery orders',
            fallbackMessage: 'Failed to export Excel data.'
        });
    }
};
