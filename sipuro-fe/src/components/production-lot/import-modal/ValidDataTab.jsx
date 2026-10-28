import { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { getStatusStyle } from '../../../utils/statusHelper';
import PaginationControl from '../../common/PaginationControl';
import CrossCodeTag from '../allocated-lot/CrossCodeTag';

// Qty bernilai minus (adjustment) ditampilkan merah dengan tanda minus
const formatSignedQty = (value) => {
    const n = Number(value) || 0;
    return n < 0 ? `-${formatQty(Math.abs(n))}` : formatQty(n);
};

const ValidDataTab = ({ previewResults = [] }) => {
    // Pagination
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);

    const mainTotalItems = previewResults.length;
    const mainTotalPages = Math.ceil(mainTotalItems / mainPageSize) || 1;
    const paginatedResults = previewResults.slice(
        (mainCurrentPage - 1) * mainPageSize,
        mainCurrentPage * mainPageSize
    );

    const renderAllocationStatusBadge = (status) => {
        const currentStatus = status || 'Open';
        return (
            <span style={getStatusStyle(currentStatus)}>
                {currentStatus}
            </span>
        );
    };

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #dee2e6' }}>
                            <th style={{ textAlign: 'center', width: '40px', padding: '8px' }}>No</th>
                            <th style={{ textAlign: 'left', width: '90px', padding: '8px' }}>Batch Number</th>
                            <th style={{ textAlign: 'left', width: '90px', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'left', minWidth: '180px', padding: '8px' }}>Product</th>
                            <th style={{ textAlign: 'center', width: '160px', padding: '8px' }}>Actual Date</th>
                            <th style={{ textAlign: 'left', width: '130px', padding: '8px', whiteSpace: 'nowrap' }}>PO Number</th>
                            <th style={{ textAlign: 'right', width: '85px', padding: '8px' }}>PO Qty (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '95px', padding: '8px' }}>Fulfilled Qty (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '105px', padding: '8px' }}>Production Output (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '70px', padding: '8px' }}>Percentage</th>
                            <th style={{ textAlign: 'center', width: '70px', padding: '8px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedResults.length === 0 ? (
                            <tr>
                                <td colSpan="11" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    No valid allocated data available to save.
                                </td>
                            </tr>
                        ) : (
                            paginatedResults.map((item, localIdx) => {
                                const actualIndex = (mainCurrentPage - 1) * mainPageSize + localIdx;

                                const rowNo = actualIndex + 1;
                                const batchNo = item.batchNumber || '-';
                                const lotNo = item.lotNumber || '-';
                                const prodCode = item.productCode || '';
                                const prodName = item.productName || '';
                                const productTitle = prodCode ? `${prodCode}${prodName ? ' - ' + prodName : ''}` : '-';

                                const allocList = (item.allocations && item.allocations.length > 0) ? item.allocations : [];
                                const rowSpan = allocList.length || 1;

                                // Mengambil format gabungan Completed & Expired dari backend
                                const formattedActualDate = item.formattedActualDate || '-';

                                if (allocList.length === 0) {
                                    return (
                                        <tr key={`${actualIndex}_none`} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', color: '#6c757d' }}>{rowNo}</td>
                                            <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>{batchNo}</td>
                                            <td style={{ verticalAlign: 'top', padding: '8px' }}>{lotNo}</td>
                                            <td style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>{productTitle}</td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px', whiteSpace: 'pre-line' }}>
                                                {formattedActualDate}
                                            </td>
                                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>-</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>0</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>0</td>
                                            <td style={{ textAlign: 'right', padding: '8px', color: Number(item.totalQtyOutput) < 0 ? '#dc3545' : 'inherit' }}>{formatSignedQty(item.totalQtyOutput || 0)}</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>0.0%</td>
                                            <td style={{ textAlign: 'center', padding: '8px' }}>{renderAllocationStatusBadge('Open')}</td>
                                        </tr>
                                    );
                                }

                                return allocList.map((alloc, aIdx) => {
                                    const poQty = Number(alloc.poQty || 0);
                                    const previousFulfilled = Number(alloc.previousFulfilledQty || 0);
                                    const productionOutput = Number(alloc.addedQty || 0);
                                    const percentage = alloc.fulfillmentPercentage !== undefined ? alloc.fulfillmentPercentage : '0.0';
                                    const poNum = alloc.poNumber || '-';
                                    const allocStatus = alloc.status || 'Open';

                                    return (
                                        <tr key={`${actualIndex}_${aIdx}`} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                                            {aIdx === 0 && (
                                                <>
                                                    <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', color: '#6c757d' }}>
                                                        {rowNo}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>
                                                        {batchNo}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'top', padding: '8px' }}>
                                                        {lotNo}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>
                                                        {productTitle}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px' }}>
                                                        {formattedActualDate}
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ fontWeight: '500', padding: '8px', whiteSpace: 'nowrap' }}>
                                                {poNum}
                                                <CrossCodeTag show={alloc.viaMapping} caption="PO product" productCode={alloc.poProductCode} />
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>
                                                {formatQty(poQty)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#6c757d', padding: '8px' }}>
                                                {formatQty(previousFulfilled)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: productionOutput < 0 ? '#dc3545' : '#198754', fontWeight: 'bold', padding: '8px' }}>
                                                {formatSignedQty(productionOutput)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>
                                                {percentage}%
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '8px' }}>
                                                {renderAllocationStatusBadge(allocStatus)}
                                            </td>
                                        </tr>
                                    );
                                });
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationControl
                pagination={{
                    currentPage: mainCurrentPage,
                    totalPages: mainTotalPages,
                    totalItems: mainTotalItems,
                    limit: mainPageSize
                }}
                onPageChange={(p) => setMainCurrentPage(p)}
                onLimitChange={(l) => { setMainPageSize(l); setMainCurrentPage(1); }}
            />
        </div>
    );
};

export default ValidDataTab;
