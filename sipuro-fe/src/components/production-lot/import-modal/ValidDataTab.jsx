import { useState, useMemo } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import { getStatusStyle } from '../../../utils/statusHelper';
import PaginationControl from '../../common/PaginationControl';
import CrossCodeTag from '../allocated-lot/CrossCodeTag';

// Qty bernilai minus (adjustment) ditampilkan merah dengan tanda minus
const formatSignedQty = (value) => {
    const n = Number(value) || 0;
    return n < 0 ? `-${formatQty(Math.abs(n))}` : formatQty(n);
};

const ValidDataTab = ({ previewResults = [] }) => {
    // Sub-tab view: 'summary' (default) atau 'detail'
    const [subTab, setSubTab] = useState('summary');

    // ----------------------------------------------------
    // 1. DATA SUMMARY (Agregasi Batch + PO Reference + Progress Qty)
    // ----------------------------------------------------
    const summaryRows = useMemo(() => {
        const map = new Map();

        previewResults.forEach((item) => {
            const batchNo = item.batchNumber || '-';
            const allocList = item.allocations && item.allocations.length > 0 ? item.allocations : [];

            if (allocList.length === 0) {
                const key = `${batchNo}_no_po`;
                if (!map.has(key)) {
                    map.set(key, {
                        batchNumber: batchNo,
                        maxCompletedDate: item.actualCompletedDatetime || null,
                        productCode: item.productCode || '',
                        productName: item.productName || '',
                        poNumber: '-',
                        poQty: 0,
                        previousFulfilledQty: 0,
                        productionOutput: Number(item.totalQtyOutput) || 0,
                        finalQty: Number(item.totalQtyOutput) || 0,
                        status: 'Open'
                    });
                } else {
                    const entry = map.get(key);
                    entry.productionOutput += Number(item.totalQtyOutput) || 0;
                    entry.finalQty += Number(item.totalQtyOutput) || 0;
                    if (item.actualCompletedDatetime && (!entry.maxCompletedDate || item.actualCompletedDatetime > entry.maxCompletedDate)) {
                        entry.maxCompletedDate = item.actualCompletedDatetime;
                    }
                }
            } else {
                allocList.forEach((alloc) => {
                    const poNum = alloc.poNumber || '-';
                    // Satu PO bisa punya beberapa item (produk), jadi dikelompokkan per item PO, bukan per nomor PO
                    const key = `${batchNo}_${alloc.poDetailId !== undefined ? alloc.poDetailId : poNum}`;

                    if (!map.has(key)) {
                        map.set(key, {
                            batchNumber: batchNo,
                            maxCompletedDate: item.actualCompletedDatetime || null,
                            productCode: item.productCode || '',
                            productName: item.productName || '',
                            poNumber: poNum,
                            viaMapping: alloc.viaMapping,
                            poProductCode: alloc.poProductCode,
                            poQty: Number(alloc.poQty) || 0,
                            // Qty awal PO sebelum batch ini masuk
                            previousFulfilledQty: Number(alloc.previousFulfilledQty) || 0,
                            productionOutput: 0,
                            finalQty: 0,
                            status: alloc.status || 'Open'
                        });
                    }

                    const entry = map.get(key);
                    entry.productionOutput += Number(alloc.addedQty) || 0;

                    // Mengambil MAX Completed Date & Time dari seluruh lot di batch ini
                    if (item.actualCompletedDatetime) {
                        if (!entry.maxCompletedDate || item.actualCompletedDatetime > entry.maxCompletedDate) {
                            entry.maxCompletedDate = item.actualCompletedDatetime;
                        }
                    }

                    // Final Qty = hasil akhir item PO setelah lot terakhir batch ini (sama dengan tab Detail).
                    // Qty bertambah berurutan, jadi nilai dari alokasi terakhir sudah mencakup semua lot sebelumnya.
                    entry.finalQty = alloc.newFulfilledQty !== undefined
                        ? Number(alloc.newFulfilledQty) || 0
                        : entry.previousFulfilledQty + entry.productionOutput;
                    entry.status = alloc.status || entry.status;
                });
            }
        });

        return Array.from(map.values()).map((row) => {
            const ratio = row.poQty > 0 ? (row.finalQty / row.poQty) * 100 : 0;
            return {
                ...row,
                percentage: ratio.toFixed(1)
            };
        });
    }, [previewResults]);

    // Pagination untuk Summary Tab
    const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState(10);
    const summaryTotalItems = summaryRows.length;
    const summaryTotalPages = Math.ceil(summaryTotalItems / summaryPageSize) || 1;
    const summaryPage = Math.min(summaryCurrentPage, summaryTotalPages);
    const paginatedSummary = summaryRows.slice(
        (summaryPage - 1) * summaryPageSize,
        summaryPage * summaryPageSize
    );

    // ----------------------------------------------------
    // 2. DATA DETAIL (Tampilan Detail Lot - PO)
    // ----------------------------------------------------
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);
    const mainTotalItems = previewResults.length;
    const mainTotalPages = Math.ceil(mainTotalItems / mainPageSize) || 1;
    const mainPage = Math.min(mainCurrentPage, mainTotalPages);
    const paginatedResults = previewResults.slice(
        (mainPage - 1) * mainPageSize,
        mainPage * mainPageSize
    );

    const renderAllocationStatusBadge = (status) => {
        const currentStatus = status || 'Open';
        return (
            <span style={getStatusStyle(currentStatus)}>
                {currentStatus}
            </span>
        );
    };

    const tabButtonStyle = (isActive) => ({
        padding: '6px 16px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        backgroundColor: isActive ? '#0d6efd' : '#e9ecef',
        color: isActive ? '#fff' : '#495057',
        transition: 'all 0.2s ease'
    });

    return (
        <div>
            {/* Sub-Tab Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6c757d', marginRight: '4px' }}>
                    View Format:
                </span>
                <button
                    type="button"
                    onClick={() => setSubTab('summary')}
                    style={tabButtonStyle(subTab === 'summary')}
                >
                    Summary (Batch - PO)
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('detail')}
                    style={tabButtonStyle(subTab === 'detail')}
                >
                    Detail (Lot - PO)
                </button>
            </div>

            {/* TAB 1: SUMMARY TABLE (10 Kolom Lengkap & Rapi) */}
            {subTab === 'summary' && (
                <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#fff' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ textAlign: 'center', width: '40px', padding: '8px' }}>No.</th>
                                    <th style={{ textAlign: 'left', width: '100px', padding: '8px' }}>Batch Number</th>
                                    <th style={{ textAlign: 'center', width: '140px', padding: '8px' }}>Completed Date and Time</th>
                                    <th style={{ textAlign: 'left', minWidth: '180px', padding: '8px' }}>Product</th>
                                    <th style={{ textAlign: 'left', width: '130px', padding: '8px', whiteSpace: 'nowrap' }}>PO Number</th>
                                    <th style={{ textAlign: 'right', width: '110px', padding: '8px' }}>Previous Fulfilled (Pcs)</th>
                                    <th style={{ textAlign: 'right', width: '110px', padding: '8px' }}>Production Output (Pcs)</th>
                                    <th style={{ textAlign: 'right', width: '110px', padding: '8px' }}>Final Qty (Pcs)</th>
                                    <th style={{ textAlign: 'right', width: '70px', padding: '8px' }}>Percentage</th>
                                    <th style={{ textAlign: 'center', width: '70px', padding: '8px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSummary.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#6c757d' }}>
                                            No summary data available.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedSummary.map((row, idx) => {
                                        const rowNo = (summaryPage - 1) * summaryPageSize + idx + 1;
                                        return (
                                            <tr key={`${row.batchNumber}-${row.poNumber}-${idx}`} style={{ borderBottom: '1px solid #dee2e6', verticalAlign: 'top' }}>
                                                {/* 1. No. */}
                                                <td style={{ textAlign: 'center', padding: '8px', color: '#6c757d' }}>{rowNo}</td>

                                                {/* 2. Batch Number */}
                                                <td style={{ fontWeight: 'bold', padding: '8px', whiteSpace: 'nowrap' }}>{row.batchNumber}</td>

                                                {/* 3. Completed Date and Time (MAX) */}
                                                <td style={{ textAlign: 'center', padding: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                    {formatDateTime(row.maxCompletedDate)}
                                                </td>

                                                {/* 4. Product (Stacked: Code on top, Name below) */}
                                                <td style={{ padding: '8px', minWidth: '180px' }}>
                                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{row.productCode}</div>
                                                    <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>{row.productName}</div>
                                                </td>

                                                {/* 5. PO Number */}
                                                <td style={{ fontWeight: '500', padding: '8px', whiteSpace: 'nowrap' }}>
                                                    {row.poNumber}
                                                    <CrossCodeTag show={row.viaMapping} caption="PO product" productCode={row.poProductCode} />
                                                </td>

                                                {/* 6. Previous Fulfilled (Pcs) */}
                                                <td style={{ textAlign: 'right', color: '#6c757d', padding: '8px' }}>
                                                    {formatQty(row.previousFulfilledQty)}
                                                </td>

                                                {/* 7. Production Output (Pcs) */}
                                                <td style={{
                                                    textAlign: 'right',
                                                    padding: '8px',
                                                    fontWeight: 'bold',
                                                    color: row.productionOutput < 0 ? '#dc3545' : '#198754'
                                                }}>
                                                    {formatSignedQty(row.productionOutput)}
                                                </td>

                                                {/* 8. Final Qty (Pcs) */}
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>
                                                    {formatQty(row.finalQty)}
                                                </td>

                                                {/* 9. Percentage */}
                                                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>
                                                    {row.percentage}%
                                                </td>

                                                {/* 10. Status */}
                                                <td style={{ textAlign: 'center', padding: '8px' }}>
                                                    {renderAllocationStatusBadge(row.status)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControl
                        pagination={{
                            currentPage: summaryPage,
                            totalPages: summaryTotalPages,
                            totalItems: summaryTotalItems,
                            limit: summaryPageSize
                        }}
                        onPageChange={(p) => setSummaryCurrentPage(p)}
                        onLimitChange={(l) => { setSummaryPageSize(l); setSummaryCurrentPage(1); }}
                    />
                </div>
            )}

            {/* TAB 2: DETAIL TABLE (100% Utuh Tanpa Perubahan) */}
            {subTab === 'detail' && (
                <div style={{ border: '1px solid #dee2e6', borderRadius: '4px' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ textAlign: 'center', width: '40px', padding: '8px' }}>No</th>
                                    <th style={{ textAlign: 'left', width: '90px', padding: '8px' }}>Batch Number</th>
                                    <th style={{ textAlign: 'left', width: '90px', padding: '8px' }}>Lot Number</th>
                                    <th style={{ textAlign: 'left', minWidth: '180px', padding: '8px' }}>Product</th>
                                    <th style={{ textAlign: 'center', width: '140px', padding: '8px' }}>Completed Date and Time</th>
                                    <th style={{ textAlign: 'center', width: '90px', padding: '8px' }}>Exp Date</th>
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
                                        <td colSpan="12" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                            No valid allocated data available to save.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedResults.map((item, localIdx) => {
                                        const actualIndex = (mainPage - 1) * mainPageSize + localIdx;

                                        const rowNo = actualIndex + 1;
                                        const batchNo = item.batchNumber || '-';
                                        const lotNo = item.lotNumber || '-';
                                        const prodCode = item.productCode || '';
                                        const prodName = item.productName || '';
                                        const productTitle = prodCode ? `${prodCode}${prodName ? ' - ' + prodName : ''}` : '-';

                                        const allocList = (item.allocations && item.allocations.length > 0) ? item.allocations : [];
                                        const rowSpan = allocList.length || 1;
                                        const completedText = item.actualCompletedDatetime ? formatDateTime(item.actualCompletedDatetime) : '-';
                                        const expiredText = item.expiredDate ? formatDate(item.expiredDate) : '-';

                                        if (allocList.length === 0) {
                                            return (
                                                <tr key={`${actualIndex}_none`} style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dee2e6' }}>
                                                    <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', color: '#6c757d' }}>{rowNo}</td>
                                                    <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>{batchNo}</td>
                                                    <td style={{ verticalAlign: 'top', padding: '8px' }}>{lotNo}</td>
                                                    <td style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>{productTitle}</td>
                                                    <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>{completedText}</td>
                                                    <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>{expiredText}</td>
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
                                                            <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                {completedText}
                                                            </td>
                                                            <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                {expiredText}
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
                            currentPage: mainPage,
                            totalPages: mainTotalPages,
                            totalItems: mainTotalItems,
                            limit: mainPageSize
                        }}
                        onPageChange={(p) => setMainCurrentPage(p)}
                        onLimitChange={(l) => { setMainPageSize(l); setMainCurrentPage(1); }}
                    />
                </div>
            )}
        </div>
    );
};

export default ValidDataTab;
