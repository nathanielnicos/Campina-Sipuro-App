import React, { useState } from 'react';
import { formatQty, formatDate } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

const ValidDataTab = ({ previewResults = [], unallocatedStocks = [] }) => {
    // Pagination Tabel Utama
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);

    // Pagination Tabel Kelebihan Stok
    const [unallocCurrentPage, setUnallocCurrentPage] = useState(1);
    const [unallocPageSize, setUnallocPageSize] = useState(10);

    const mainTotalItems = previewResults.length;
    const mainTotalPages = Math.ceil(mainTotalItems / mainPageSize) || 1;
    const paginatedResults = previewResults.slice(
        (mainCurrentPage - 1) * mainPageSize,
        mainCurrentPage * mainPageSize
    );

    const unallocTotalItems = unallocatedStocks.length;
    const unallocTotalPages = Math.ceil(unallocTotalItems / unallocPageSize) || 1;
    const paginatedUnallocated = unallocatedStocks.slice(
        (unallocCurrentPage - 1) * unallocPageSize,
        unallocCurrentPage * unallocPageSize
    );

    const renderAllocationStatusBadge = (status) => {
        const isClosed = String(status).toLowerCase() === 'closed';
        return (
            <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                backgroundColor: isClosed ? '#d1e7dd' : '#fff3cd',
                color: isClosed ? '#0f5132' : '#664d03',
                border: `1px solid ${isClosed ? '#badbcc' : '#ffecb5'}`
            }}>
                {status || 'Open'}
            </span>
        );
    };

    return (
        <>
            <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '20px' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f3f5' }}>
                                <th style={{ textAlign: 'left', width: '110px' }}>Batch Number</th>
                                <th style={{ textAlign: 'left' }}>Product</th>
                                <th style={{ textAlign: 'center', width: '90px' }}>Planned Date</th>
                                <th style={{ textAlign: 'center', width: '90px' }}>Actual Date</th>
                                <th style={{ textAlign: 'left', width: '140px' }}>PO Number</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Allocated Qty (Pcs)</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Fulfilled Qty (Pcs)</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Production Output (Pcs)</th>
                                <th style={{ textAlign: 'right', width: '70px' }}>Percentage</th>
                                <th style={{ textAlign: 'center', width: '80px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedResults.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                        No valid allocated data available to save.
                                    </td>
                                </tr>
                            ) : (
                                paginatedResults.map((item, localIdx) => {
                                    const actualIndex = (mainCurrentPage - 1) * mainPageSize + localIdx;

                                    const matchedAlloc = item.allocations && item.allocations[0];
                                    const planDate = matchedAlloc?.plan_production_date
                                        ? matchedAlloc.plan_production_date.split('T')[0]
                                        : (item.planDate ? item.planDate.split('T')[0] : '-');
                                    const actDate = item.actDate ? item.actDate.split('T')[0] : '-';
                                    const isDateDifferent = planDate !== '-' && actDate !== '-' && planDate !== actDate;

                                    const productTitle = item.productName
                                        ? `${item.productCode} - ${item.productName}`
                                        : item.productCode || '-';

                                    const allocList = item.allocations || [];
                                    const rowSpan = allocList.length > 0 ? allocList.length : 1;

                                    return allocList.map((alloc, aIdx) => {
                                        const targetQty = Number(alloc.planQty ?? alloc.plan_qty ?? alloc.allocated_qty ?? 0);
                                        const previousFulfilled = Number(alloc.previousFulfilledQty ?? alloc.fulfilled_qty ?? 0);

                                        const addedAllocatedQty = Number(
                                            alloc.addedAllocatedQty !== undefined
                                                ? alloc.addedAllocatedQty
                                                : (alloc.addedQty !== undefined ? alloc.addedQty : (alloc.added_qty ?? 0))
                                        );

                                        const accumulatedFulfilled = previousFulfilled + addedAllocatedQty;
                                        const percentage = targetQty > 0 ? ((accumulatedFulfilled / targetQty) * 100).toFixed(1) : '0.0';

                                        return (
                                            <tr key={`${actualIndex}_${aIdx}`} style={{ backgroundColor: '#ffffff' }}>
                                                {aIdx === 0 && (
                                                    <>
                                                        <td rowSpan={rowSpan} style={{ fontWeight: 'bold', verticalAlign: 'top' }}>
                                                            {item.batchNumber}
                                                        </td>
                                                        <td rowSpan={rowSpan} style={{ verticalAlign: 'top' }}>
                                                            {productTitle}
                                                        </td>
                                                        <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                                            {formatDate(planDate)}
                                                        </td>
                                                        <td rowSpan={rowSpan} style={{
                                                            textAlign: 'center',
                                                            verticalAlign: 'top',
                                                            fontWeight: isDateDifferent ? 'bold' : 'normal',
                                                            color: isDateDifferent ? '#dc3545' : 'inherit'
                                                        }}>
                                                            {formatDate(actDate)}
                                                        </td>
                                                    </>
                                                )}
                                                <td style={{ fontWeight: '500' }}>{alloc.poNumber || alloc.po_number || '-'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {formatQty(targetQty)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#6c757d' }}>
                                                    {formatQty(previousFulfilled)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#198754', fontWeight: 'bold' }}>
                                                    {formatQty(addedAllocatedQty)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {percentage}%
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {renderAllocationStatusBadge(alloc.status)}
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

            {/* Tabel Overproduction / Kelebihan Stok */}
            {unallocatedStocks.length > 0 && (
                <div>
                    <h4 style={{ marginBottom: '8px', color: '#856404' }}>Overproduction</h4>
                    <div style={{ border: '1px solid #ffeeba', borderRadius: '4px', backgroundColor: '#fff3cd' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Product</th>
                                        <th style={{ textAlign: 'right' }}>Remaining Qty (Pcs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUnallocated.map((stk, sIdx) => {
                                        const code = stk.productCode || stk.itemCode || '';
                                        const name = stk.productName || '';
                                        const productDisplay = code && name ? `${code} - ${name}` : (code || name || '-');

                                        return (
                                            <tr key={sIdx}>
                                                <td style={{ fontWeight: 'bold' }}>{stk.batchNumber || stk.batch_number}</td>
                                                <td>{productDisplay}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {formatQty(stk.qtyAvailable ?? stk.qty_available ?? stk.unallocatedQty ?? 0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <PaginationControl
                            pagination={{
                                currentPage: unallocCurrentPage,
                                totalPages: unallocTotalPages,
                                totalItems: unallocTotalItems,
                                limit: unallocPageSize
                            }}
                            onPageChange={(p) => setUnallocCurrentPage(p)}
                            onLimitChange={(l) => { setUnallocPageSize(l); setUnallocCurrentPage(1); }}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default ValidDataTab;
