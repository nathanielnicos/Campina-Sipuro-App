const { sipuroDb } = require('../../../config/db');
const { parseDeliveryOrderRequest } = require('../../../services/delivery-order/deliveryOrderFilters');
const { fetchDeliveryOrderPage } = require('../../../services/delivery-order/deliveryOrderQuery');
const { sendControllerError } = require('../../../helpers/businessError');

exports.getDeliveryOrderMapping = async (req, res) => {
    try {
        const request = parseDeliveryOrderRequest(req.query);
        const { data, totalItems } = await fetchDeliveryOrderPage(sipuroDb, request);

        return res.json({
            success: true,
            displayMode: request.displayMode,
            data,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / request.limit),
                currentPage: request.page,
                limit: request.limit
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error fetching delivery order list',
            fallbackMessage: 'Failed to fetch delivery order list.'
        });
    }
};
