const { sipuroDb } = require('../../../config/db');
const { getPOTolerance } = require('../../../services/production-lot/lotStatusService');
const { parseMappingRequest } = require('../../../services/production-lot/lotMappingFilters');
const { fetchMappingPage } = require('../../../services/production-lot/lotMappingQuery');
const { sendControllerError } = require('../../../helpers/businessError');

/**
 * Toleransi PO hanya dikirim ke frontend untuk pewarnaan persentase.
 * Jika belum diatur atau gagal dibaca, daftar tetap tampil dan nilainya null.
 */
const loadTolerancePercent = async () => {
    try {
        const ratio = await getPOTolerance(sipuroDb);
        return Number((ratio * 100).toFixed(4));
    } catch (error) {
        console.error('Cannot read PO tolerance for lot mapping:', error.message);
        return null;
    }
};

exports.getAllocatedLotMapping = async (req, res) => {
    try {
        const request = parseMappingRequest(req.query);
        const { data, totalItems } = await fetchMappingPage(sipuroDb, request);

        const body = {
            success: true,
            displayMode: request.displayMode,
            data,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / request.limit),
                currentPage: request.page,
                limit: request.limit
            }
        };
        if (request.displayMode === 'BY_PO') body.poTolerance = await loadTolerancePercent();

        return res.json(body);
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error fetching lot mapping list',
            fallbackMessage: 'Failed to fetch lot mapping list.'
        });
    }
};
