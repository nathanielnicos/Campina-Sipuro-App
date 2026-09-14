import { useEffect, useState } from 'react';
import { formatQty, formatDate, formatDateTime } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

const ImportExcelModal = ({
    isOpen,
    previewData,
    saving,
    onConfirmSave,
    onRejectPreview
}) => {
    // State Tab
    const [activeTab, setActiveTab] = useState('new'); // 'new' | 'duplicate' | 'unregistered'

    // Pagination Tabel Utama (Alokasi FIFO)
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);

    // Pagination Tabel Kelebihan Stok
    const [unallocCurrentPage, setUnallocCurrentPage] = useState(1);
    const [unallocPageSize, setUnallocPageSize] = useState(10);

    // Pagination Tabel Duplikat
    const [dupCurrentPage, setDupCurrentPage] = useState(1);
    const [dupPageSize, setDupPageSize] = useState(10);

    // Pagination Tabel Tidak Terdaftar
    const [unregCurrentPage, setUnregCurrentPage] = useState(1);
    const [unregPageSize, setUnregPageSize] = useState(10);

    const activePreviewData = previewData;

    useEffect(() => {
        setMainCurrentPage(1);
        setUnallocCurrentPage(1);
        setDupCurrentPage(1);
        setUnregCurrentPage(1);
        setActiveTab('new');
    }, [activePreviewData]);

    if (!isOpen || !activePreviewData) return null;

    const summary = activePreviewData.summary || {
        totalRows: 0,
        newCount: 0,
        duplicateCount: 0,
        unregisteredCount: 0
    };

    const categorizedDetails = activePreviewData.categorizedDetails || {
        newRows: [],
        duplicateRows: [],
        unregisteredRows: []
    };

    const previewResults = activePreviewData.previewResults || [];
    const unallocatedStocks = activePreviewData.unallocatedStocks || [];

    const canSave = summary.newCount > 0 && !activePreviewData.isReupload;

    // Pagination Tabel Utama (Alokasi FIFO)
    const mainTotalItems = previewResults.length;
    const mainTotalPages = Math.ceil(mainTotalItems / mainPageSize) || 1;
    const paginatedResults = previewResults.slice(
        (mainCurrentPage - 1) * mainPageSize,
        mainCurrentPage * mainPageSize
    );

    // Pagination Tabel Kelebihan Stok
    const unallocTotalItems = unallocatedStocks.length;
    const unallocTotalPages = Math.ceil(unallocTotalItems / unallocPageSize) || 1;
    const paginatedUnallocated = unallocatedStocks.slice(
        (unallocCurrentPage - 1) * unallocPageSize,
        unallocCurrentPage * unallocPageSize
    );

    // Pagination Tabel Duplikat
    const duplicateRows = categorizedDetails.duplicateRows || [];
    const dupTotalItems = duplicateRows.length;
    const dupTotalPages = Math.ceil(dupTotalItems / dupPageSize) || 1;
    const paginatedDuplicates = duplicateRows.slice(
        (dupCurrentPage - 1) * dupPageSize,
        dupCurrentPage * dupPageSize
    );

    // Pagination Tabel Tidak Terdaftar
    const unregisteredRows = categorizedDetails.unregisteredRows || [];
    const unregTotalItems = unregisteredRows.length;
    const unregTotalPages = Math.ceil(unregTotalItems / unregPageSize) || 1;
    const paginatedUnregistered = unregisteredRows.slice(
        (unregCurrentPage - 1) * unregPageSize,
        unregCurrentPage * unregPageSize
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

    const handleSaveClick = () => {
        // Teruskan data newDetails agar controller bisa menyimpan ke production_upload_details
        onConfirmSave({
            newDetails: categorizedDetails.newRows || []
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '95%', maxWidth: '1350px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        Production Output Preview (Unsaved)
                    </h3>
                </div>

                {activePreviewData.isReupload && (
                    <div style={{ padding: '10px 12px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>
                        ⚠️ <strong>Re-upload Warning:</strong> {activePreviewData.warningMessage}
                    </div>
                )}

                {/* Metadata & Kartu Ringkasan Status Baris */}
                <div style={{ fontSize: '13px', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e9ecef', marginBottom: '16px' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <strong>File Name:</strong> {activePreviewData.fileName} | <strong>Processed Time:</strong> {activePreviewData.processTimestamp} | <strong>Total Rows:</strong> {summary.totalRows}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, backgroundColor: '#d1e7dd', color: '#0f5132', padding: '8px 12px', borderRadius: '4px', border: '1px solid #badbcc' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>New Data (Ready to Process)</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.newCount} Rows</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#fff3cd', color: '#664d03', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ffecb5' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Duplicate Data (Skipped)</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.duplicateCount} Rows</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f8d7da', color: '#842029', padding: '8px 12px', borderRadius: '4px', border: '1px solid #f5c2c7' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Unregistered Data (Skipped)</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{summary.unregisteredCount} Rows</div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: '16px' }}>
                    <button
                        onClick={() => setActiveTab('new')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'new' ? '3px solid #198754' : 'none',
                            backgroundColor: 'transparent',
                            fontWeight: activeTab === 'new' ? 'bold' : 'normal',
                            color: activeTab === 'new' ? '#198754' : '#495057',
                            cursor: 'pointer'
                        }}
                    >
                        FIFO Allocation ({summary.newCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('duplicate')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'duplicate' ? '3px solid #ffc107' : 'none',
                            backgroundColor: 'transparent',
                            fontWeight: activeTab === 'duplicate' ? 'bold' : 'normal',
                            color: activeTab === 'duplicate' ? '#856404' : '#495057',
                            cursor: 'pointer'
                        }}
                    >
                        Duplicate Data ({summary.duplicateCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('unregistered')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderBottom: activeTab === 'unregistered' ? '3px solid #dc3545' : 'none',
                            backgroundColor: 'transparent',
                            fontWeight: activeTab === 'unregistered' ? 'bold' : 'normal',
                            color: activeTab === 'unregistered' ? '#dc3545' : '#495057',
                            cursor: 'pointer'
                        }}
                    >
                        Unregistered Data ({summary.unregisteredCount})
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>

                    {/* TAB 1: DATA BARU & HASIL ALOKASI FIFO */}
                    {activeTab === 'new' && (
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
                                                        No new allocated data available.
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

                            {/* Tabel Kelebihan Stok Produksi */}
                            {unallocatedStocks.length > 0 && (
                                <div>
                                    <h4 style={{ marginBottom: '8px', color: '#856404' }}>Overproduction (Lebihan Stok)</h4>
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
                    )}

                    {/* TAB 2: DATA DUPLIKAT */}
                    {activeTab === 'duplicate' && (
                        <div style={{ border: '1px solid #ffeeba', borderRadius: '4px', backgroundColor: '#fff8e6' }}>
                            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#856404' }}>
                                ℹ️ The following rows have been uploaded previously and <strong>will be skipped</strong> during saving.
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fff3cd' }}>
                                            <th style={{ textAlign: 'left' }}>Batch Number</th>
                                            <th style={{ textAlign: 'left' }}>Lot Number</th>
                                            <th style={{ textAlign: 'left' }}>Item Code</th>
                                            <th style={{ textAlign: 'right' }}>Qty Pac</th>
                                            <th style={{ textAlign: 'center' }}>Start Datetime</th>
                                            <th style={{ textAlign: 'center' }}>Completed Datetime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedDuplicates.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                    No duplicate data found.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedDuplicates.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 'bold' }}>{row.batchNumber}</td>
                                                    <td>{row.lotNumber || '-'}</td>
                                                    <td>{row.itemCode}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatQty(row.qtyPac)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualStartDatetime) || '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualCompletedDatetime) || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControl
                                pagination={{
                                    currentPage: dupCurrentPage,
                                    totalPages: dupTotalPages,
                                    totalItems: dupTotalItems,
                                    limit: dupPageSize
                                }}
                                onPageChange={(p) => setDupCurrentPage(p)}
                                onLimitChange={(l) => { setDupPageSize(l); setDupCurrentPage(1); }}
                            />
                        </div>
                    )}

                    {/* TAB 3: DATA TIDAK TERDAFTAR */}
                    {activeTab === 'unregistered' && (
                        <div style={{ border: '1px solid #f5c2c7', borderRadius: '4px', backgroundColor: '#fdf2f2' }}>
                            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#842029' }}>
                                ⚠️ The following Batch / Item Codes were not found in the database and <strong>will be skipped</strong> during saving.
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8d7da' }}>
                                            <th style={{ textAlign: 'left' }}>Batch Number</th>
                                            <th style={{ textAlign: 'left' }}>Lot Number</th>
                                            <th style={{ textAlign: 'left' }}>Item Code</th>
                                            <th style={{ textAlign: 'right' }}>Qty Pac</th>
                                            <th style={{ textAlign: 'center' }}>Start Datetime</th>
                                            <th style={{ textAlign: 'center' }}>Completed Datetime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUnregistered.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                    No unregistered data found.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedUnregistered.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 'bold' }}>{row.batchNumber}</td>
                                                    <td>{row.lotNumber || '-'}</td>
                                                    <td>{row.itemCode}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatQty(row.qtyPac)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualStartDatetime) || '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualCompletedDatetime) || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControl
                                pagination={{
                                    currentPage: unregCurrentPage,
                                    totalPages: unregTotalPages,
                                    totalItems: unregTotalItems,
                                    limit: unregPageSize
                                }}
                                onPageChange={(p) => setUnregCurrentPage(p)}
                                onLimitChange={(l) => { setUnregPageSize(l); setUnregCurrentPage(1); }}
                            />
                        </div>
                    )}

                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <button
                        type="button"
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        Close
                    </button>

                    {canSave && (
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={saving}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#198754',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease-in-out'
                            }}
                        >
                            {saving ? 'Saving...' : `Save to Database (${summary.newCount} New Rows)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportExcelModal;
