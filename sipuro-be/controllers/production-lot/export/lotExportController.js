const { sipuroDb } = require('../../../config/db');
const { getWibDate } = require('../../../helpers/dateHelper');
const { sendControllerError } = require('../../../helpers/businessError');
const { buildMappingFilters } = require('../../../services/production-lot/lotMappingFilters');
const { fetchExportData } = require('../../../services/production-lot/lotExportQuery');
const { buildExportWorkbookBuffer, buildExportFileName } = require('../../../services/production-lot/lotExportWorkbook');

/**
 * Ekspor mapping PO - Lot - Batch ke Excel dengan filter yang sama dengan daftar mapping.
 */
exports.exportLotMappingExcel = async (req, res) => {
    try {
        const filters = buildMappingFilters(req.query);
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
            label: 'Error exporting lot mapping',
            fallbackMessage: 'Failed to export Excel data.'
        });
    }
};
