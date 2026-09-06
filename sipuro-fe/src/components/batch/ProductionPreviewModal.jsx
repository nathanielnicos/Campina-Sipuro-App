import { useEffect, useState } from 'react';
import { formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';

const ProductionPreviewModal = ({
    isOpen,
    previewData,
    saving,
    onConfirmSave,
    onRejectPreview
}) => {
    // Pagination Tabel Utama
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);

    // Pagination Tabel Kelebihan Stok
    const [unallocCurrentPage, setUnallocCurrentPage] = useState(1);
    const [unallocPageSize, setUnallocPageSize] = useState(10);

    const activePreviewData = previewData;

    useEffect(() => {
        setMainCurrentPage(1);
        setUnallocCurrentPage(1);
    }, [activePreviewData]);

    if (!isOpen || !activePreviewData) return null;

    const previewResults = activePreviewData.previewResults || [];
    const unallocatedStocks = activePreviewData.unallocatedStocks || [];

    const registeredCount = previewResults.filter(item => item.isRegistered).length;
    const canSave = registeredCount > 0 && !activePreviewData.isReupload;

    // Pagination Tabel Utama
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

    const renderStatusBadge = (isRegistered) => {
        const badgeStyle = {
            display: 'block',
            width: '100%',
            padding: '4px 0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxSizing: 'border-box'
        };

        return isRegistered ? (
            <span style={{ ...badgeStyle, backgroundColor: '#198754', color: '#fff' }}>TERDAFTAR</span>
        ) : (
            <span style={{ ...badgeStyle, backgroundColor: '#dc3545', color: '#fff' }}>TIDAK TERDAFTAR</span>
        );
    };

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
                        Preview Hasil Produksi (Belum Disimpan)
                    </h3>
                </div>

                {activePreviewData.isReupload && (
                    <div style={{ padding: '10px 12px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>
                        ⚠️ <strong>Peringatan Unggah Ulang:</strong> {activePreviewData.warningMessage}
                    </div>
                )}

                <div style={{ fontSize: '13px', backgroundColor: '#e9ecef', padding: '10px 12px', borderRadius: '4px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <strong>Nama File:</strong> {activePreviewData.fileName} | <strong>Waktu Proses:</strong> {activePreviewData.processTimestamp}
                    </div>
                    <div>
                        <strong>Terdaftar:</strong> <span style={{ color: '#198754', fontWeight: 'bold' }}>{registeredCount}</span> / {mainTotalItems} Baris
                    </div>
                </div>

                {/* Area Table */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>

                    {/* Tabel Utama */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <th style={{ textAlign: 'center', width: '110px' }}>Status</th>
                                        <th style={{ textAlign: 'left', width: '110px' }}>Kode Batch</th>
                                        <th style={{ textAlign: 'left' }}>Produk</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Tgl Rencana</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Tgl Aktual</th>
                                        <th style={{ textAlign: 'left', width: '140px' }}>Kode PO</th>
                                        <th style={{ textAlign: 'right', width: '90px' }}>Kuantitas Alokasi</th>
                                        <th style={{ textAlign: 'right', width: '90px' }}>Kuantitas Terpenuhi</th>
                                        <th style={{ textAlign: 'right', width: '90px' }}>Hasil Produksi</th>
                                        <th style={{ textAlign: 'right', width: '70px' }}>Persentase</th>
                                        <th style={{ textAlign: 'center', width: '80px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedResults.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                Tidak ada data preview alokasi.
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
                                            const isDateDifferent = item.isRegistered && planDate !== '-' && actDate !== '-' && planDate !== actDate;

                                            const productTitle = item.productName
                                                ? `${item.productCode} - ${item.productName}`
                                                : item.productCode || '-';

                                            const allocList = item.isRegistered ? (item.allocations || []) : [];
                                            const rowSpan = allocList.length > 0 ? allocList.length : 1;

                                            if (!item.isRegistered || allocList.length === 0) {
                                                return (
                                                    <tr key={actualIndex} style={{ backgroundColor: '#ffebee' }}>
                                                        <td style={{ textAlign: 'center', padding: '6px' }}>
                                                            {renderStatusBadge(item.isRegistered)}
                                                        </td>
                                                        <td style={{ fontWeight: 'bold' }}>{item.batchNumber}</td>
                                                        <td>{productTitle}</td>
                                                        <td style={{ textAlign: 'center' }}>{planDate}</td>
                                                        <td style={{ textAlign: 'center' }}>{actDate}</td>
                                                        <td colSpan="6" style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>
                                                            Tidak ada alokasi PO aktif untuk batch ini
                                                        </td>
                                                    </tr>
                                                );
                                            }

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
                                                                <td rowSpan={rowSpan} style={{ textAlign: 'center', padding: '6px', verticalAlign: 'top' }}>
                                                                    {renderStatusBadge(item.isRegistered)}
                                                                </td>
                                                                <td rowSpan={rowSpan} style={{ fontWeight: 'bold', verticalAlign: 'top' }}>
                                                                    {item.batchNumber}
                                                                </td>
                                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'top' }}>
                                                                    {productTitle}
                                                                </td>
                                                                <td rowSpan={rowSpan} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                                                    {planDate}
                                                                </td>
                                                                <td rowSpan={rowSpan} style={{
                                                                    textAlign: 'center',
                                                                    verticalAlign: 'top',
                                                                    fontWeight: isDateDifferent ? 'bold' : 'normal',
                                                                    color: isDateDifferent ? '#dc3545' : 'inherit'
                                                                }}>
                                                                    {actDate}
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
                            <h4 style={{ marginBottom: '8px', color: '#856404' }}>Kelebihan Produksi</h4>
                            <div style={{ border: '1px solid #ffeeba', borderRadius: '4px', backgroundColor: '#fff3cd' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr>
                                                <th>No Batch</th>
                                                <th>Produk</th>
                                                <th style={{ textAlign: 'right' }}>Kuantitas Sisa (PCS)</th>
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

                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <button
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Tutup
                    </button>

                    {canSave && (
                        <button
                            onClick={onConfirmSave}
                            disabled={saving}
                            style={{ padding: '8px 16px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {saving ? 'Menyimpan...' : 'Simpan Ke Database'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductionPreviewModal;
