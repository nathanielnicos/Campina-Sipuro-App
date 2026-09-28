import { useState } from 'react';
import { formatQty, formatDateTime } from '../../../utils/formatters';
import { getStatusStyle } from '../../../utils/statusHelper';
import PaginationControl from '../../common/PaginationControl';

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

    // Helper merender Start & Complete Datetime 2 baris
    const renderActualDates = (start, complete) => {
        const startFormatted = start ? formatDateTime(start) : null;
        const completeFormatted = complete ? formatDateTime(complete) : null;

        if (startFormatted && completeFormatted) {
            return (
                <div style={{ lineHeight: '1.3', fontSize: '11px' }}>
                    <div>{startFormatted} -</div>
                    <div>{completeFormatted}</div>
                </div>
            );
        }

        if (startFormatted) return <span style={{ fontSize: '11px' }}>{startFormatted}</span>;
        if (completeFormatted) return <span style={{ fontSize: '11px' }}>{completeFormatted}</span>;

        return '-';
    };

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', width: '100px', padding: '8px' }}>Batch Number</th>
                            <th style={{ textAlign: 'left', minWidth: '200px', padding: '8px' }}>Product</th>
                            <th style={{ textAlign: 'center', width: '140px', padding: '8px' }}>Actual Date</th>
                            <th style={{ textAlign: 'left', width: '140px', padding: '8px', whiteSpace: 'nowrap' }}>PO Number</th>
                            <th style={{ textAlign: 'right', width: '90px', padding: '8px' }}>PO Qty (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '100px', padding: '8px' }}>Fulfilled Qty (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '110px', padding: '8px' }}>Production Output (Pcs)</th>
                            <th style={{ textAlign: 'right', width: '75px', padding: '8px' }}>Percentage</th>
                            <th style={{ textAlign: 'center', width: '75px', padding: '8px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedResults.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    No valid allocated data available to save.
                                </td>
                            </tr>
                        ) : (
                            paginatedResults.map((item, localIdx) => {
                                const actualIndex = (mainCurrentPage - 1) * mainPageSize + localIdx;

                                const batchNo = item.batchNumber || '-';
                                const prodCode = item.productCode || '';
                                const prodName = item.productName || '';
                                const productTitle = prodCode ? `${prodCode}${prodName ? ' - ' + prodName : ''}` : '-';

                                const allocList = (item.allocations && item.allocations.length > 0) ? item.allocations : [];
                                const rowSpan = allocList.length || 1;

                                if (allocList.length === 0) {
                                    return (
                                        <tr key={`${actualIndex}_none`} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>{batchNo}</td>
                                            <td style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>{productTitle}</td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px' }}>
                                                {renderActualDates(item.actualStartDatetime, item.actualCompletedDatetime)}
                                            </td>
                                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>-</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>0</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>0</td>
                                            <td style={{ textAlign: 'right', padding: '8px' }}>{formatQty(item.totalQtyOutput || 0)}</td>
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
                                                    <td rowSpan={rowSpan} style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>
                                                        {batchNo}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>
                                                        {productTitle}
                                                    </td>
                                                    <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px' }}>
                                                        {renderActualDates(item.actualStartDatetime, item.actualCompletedDatetime)}
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ fontWeight: '500', padding: '8px', whiteSpace: 'nowrap' }}>
                                                {poNum}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>
                                                {formatQty(poQty)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#6c757d', padding: '8px' }}>
                                                {formatQty(previousFulfilled)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#198754', fontWeight: 'bold', padding: '8px' }}>
                                                {formatQty(productionOutput)}
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
