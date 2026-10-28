import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import AllocationActions from './AllocationActions';
import CrossCodeTag from './CrossCodeTag';

export const PoLotViewRows = ({ mappingList, poTolerance, actions }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO lot mapping data available.
                </td>
            </tr>
        );
    }

    const toleranceVal = Number(poTolerance ?? 100);

    // Style seragam untuk semua cell
    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];

        // 1. Hitung total baris (rowspan) untuk seluruh PO Header
        const poRowSpan = products.reduce((accProd, prod) => {
            const batches = Array.isArray(prod.batches) && prod.batches.length > 0 ? prod.batches : [];
            const lotsInProd = batches.reduce((accB, b) => {
                const lotCount = Array.isArray(b.lots) && b.lots.length > 0 ? b.lots.length : 1;
                return accB + lotCount;
            }, 0);
            return accProd + (lotsInProd > 0 ? lotsInProd : 1);
        }, 0);

        let isFirstProductInPo = true;

        return products.map((prodRow) => {
            const batches = Array.isArray(prodRow.batches) && prodRow.batches.length > 0
                ? prodRow.batches
                : [{ batch_id: null, batch_number: '-', lots: [{ allocation_id: null, lot_number: '-', allocated_qty: 0, status: 'Open' }] }];

            // 2. Hitung total baris (rowspan) untuk Produk
            const prodRowSpan = batches.reduce((accB, b) => {
                const count = Array.isArray(b.lots) && b.lots.length > 0 ? b.lots.length : 1;
                return accB + count;
            }, 0);

            const percent = Number(prodRow.fulfillment_percentage ?? 0).toFixed(1);
            let isFirstBatchInProd = true;

            return batches.map((batchRow) => {
                const lots = Array.isArray(batchRow.lots) && batchRow.lots.length > 0
                    ? batchRow.lots
                    : [{ allocation_id: null, lot_number: '-', allocated_qty: 0, status: 'Open' }];

                // 3. Hitung total baris (rowspan) untuk Batch
                const batchRowSpan = lots.length;

                return lots.map((lot, lotIdx) => {
                    const renderPoHeaderCells = isFirstProductInPo && isFirstBatchInProd && lotIdx === 0;
                    const renderProductCells = isFirstBatchInProd && lotIdx === 0;
                    const renderBatchCells = lotIdx === 0;

                    if (renderPoHeaderCells) isFirstProductInPo = false;
                    if (renderProductCells) isFirstBatchInProd = false;

                    // Data baris alokasi untuk aksi. Produk PO = produk item PO; produk lot = produk yang diproduksi.
                    const allocation = {
                        allocation_id: lot.allocation_id,
                        status: lot.status,
                        allocated_qty: lot.allocated_qty,
                        po_number: poRow.po_number,
                        po_product_code: prodRow.product_code,
                        lot_number: lot.lot_number,
                        batch_number: batchRow.batch_number,
                        product_code: lot.lot_product_code || prodRow.product_code,
                        product_name: lot.lot_product_name || prodRow.product_name
                    };

                    return (
                        <tr
                            key={`${poRow.po_header_id}-${prodRow.po_detail_id}-${batchRow.batch_id || 'nb'}-${lot.allocation_id || lotIdx}`}
                            style={{ borderBottom: '1px solid #dee2e6' }}
                        >
                            {/* LEVEL 1: PO HEADER */}
                            {renderPoHeaderCells && (
                                <>
                                    <td rowSpan={poRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                        {poRow.po_number}
                                    </td>
                                    <td rowSpan={poRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                        {formatDate(poRow.po_created_date)}
                                    </td>
                                </>
                            )}

                            {/* LEVEL 2: PRODUCT (Format Stacked: Kode di atas, Nama di bawah) */}
                            {renderProductCells && (
                                <>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, minWidth: '220px', backgroundColor: '#fff' }}>
                                        <div style={{ fontWeight: 'bold', color: '#212529' }}>{prodRow.product_code}</div>
                                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{prodRow.product_name}</div>
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: '#495057', backgroundColor: '#fff', width: '90px' }}>
                                        {prodRow.po_base_qty > 0 ? formatQty(prodRow.po_base_qty) : '-'}
                                    </td>
                                </>
                            )}

                            {/* LEVEL 3: BATCH */}
                            {renderBatchCells && (
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap', backgroundColor: '#fcfcfc' }}>
                                    {batchRow.batch_number}
                                </td>
                            )}

                            {/* LEVEL 4: LOT DETAILS */}
                            <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: '600' }}>
                                {lot.lot_number}
                                <CrossCodeTag show={lot.is_cross_code} caption="Lot product" productCode={lot.lot_product_code} />
                            </td>
                            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px', color: '#6c757d' }}>
                                {formatDate(lot.expired_date)}
                            </td>
                            <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', width: '100px', fontWeight: '500' }}>
                                {formatQty(lot.allocated_qty)}
                            </td>

                            {/* STATUS & PERSENTASE PEMENUHAN PRODUK */}
                            {renderProductCells && (
                                <>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', backgroundColor: '#fff', width: '100px' }}>
                                        {formatQty(prodRow.po_fulfilled_qty)}
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: prodRow.remaining_qty > 0 ? '#dc3545' : '#198754', backgroundColor: '#fff', width: '100px' }}>
                                        {formatQty(prodRow.remaining_qty)}
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                        <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                            {percent}%
                                        </span>
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff' }}>
                                        <span style={getStatusStyle(prodRow.status || (prodRow.remaining_qty === 0 ? 'Closed' : 'Open'))}>
                                            {prodRow.status || (prodRow.remaining_qty === 0 ? 'Closed' : 'Open')}
                                        </span>
                                    </td>
                                </>
                            )}

                            {/* AKSI per baris alokasi */}
                            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <AllocationActions allocation={allocation} {...actions} />
                            </td>
                        </tr>
                    );
                });
            });
        });
    });
};

export default PoLotViewRows;
