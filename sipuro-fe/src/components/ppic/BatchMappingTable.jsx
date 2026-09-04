import React, { useState } from 'react';
import { getStatusStyle } from '../../utils/statusHelper';
import { formatDate, formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';
import { exportBatchExcelApi } from '../../services/ppicApi';

const BatchMappingTable = ({
    mappingList = [],
    poTolerance,
    pagination = { currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 },
    onPageChange,
    onLimitChange,
    searchQuery,
    setSearchQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    batchStatus,
    setBatchStatus,
    onResetFilters
}) => {
    const [viewMode, setViewMode] = useState('BATCH');
    const [exporting, setExporting] = useState(false);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const isFilterActive = Boolean(searchQuery || fromDate || toDate || batchStatus);

    const handleFromDateChange = (e) => {
        setFromDate(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const handleToDateChange = (e) => {
        setToDate(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const handleStatusChange = (e) => {
        setBatchStatus(e.target.value);
        if (onPageChange) onPageChange(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        const res = await exportBatchExcelApi({
            search: searchQuery,
            fromDate,
            toDate,
            batchStatus
        });
        setExporting(false);

        if (!res.success) {
            alert(res.message);
        }
    };

    const renderPoView = () => {
        const poMap = {};

        mappingList.forEach((row) => {
            const allocations = Array.isArray(row.po_allocations) && row.po_allocations.length > 0
                ? row.po_allocations
                : [];

            allocations.forEach((po) => {
                const poNum = po.po_number || '-';
                const productCode = row.product_code || '-';

                if (!poMap[poNum]) {
                    poMap[poNum] = {
                        po_number: poNum,
                        totalRowCount: 0,
                        skus: {}
                    };
                }

                if (!poMap[poNum].skus[productCode]) {
                    poMap[poNum].skus[productCode] = {
                        product_code: productCode,
                        product_name: row.product_name,
                        batches: []
                    };
                }

                poMap[poNum].skus[productCode].batches.push({
                    batch_number: row.batch_number,
                    plan_production_date: row.plan_production_date,
                    batch_status: row.batch_status,
                    allocated_qty: Number(po.allocated_qty) || 0,
                    fulfilled_qty: Number(po.fulfilled_qty) || 0,
                    status: po.status || '-'
                });

                poMap[poNum].totalRowCount += 1;
            });
        });

        const poList = Object.values(poMap);

        if (poList.length === 0) {
            return (
                <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                        Belum ada data mapping PO.
                    </td>
                </tr>
            );
        }

        return poList.map((poGroup) => {
            const skuList = Object.values(poGroup.skus);
            let isFirstPoRow = true;

            return skuList.map((skuGroup) => {
                const skuRowCount = skuGroup.batches.length;

                return skuGroup.batches.map((batch, batchIdx) => {
                    const target = batch.allocated_qty;
                    const fulfilled = batch.fulfilled_qty;
                    const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

                    const showPoCell = isFirstPoRow;
                    const showSkuCell = batchIdx === 0;

                    if (isFirstPoRow) isFirstPoRow = false;

                    return (
                        <tr key={`${poGroup.po_number}-${skuGroup.product_code}-${batch.batch_number}-${batchIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                            {showPoCell && (
                                <td
                                    rowSpan={poGroup.totalRowCount}
                                    style={{
                                        padding: '12px 14px',
                                        verticalAlign: 'top',
                                        backgroundColor: '#fff',
                                        fontWeight: 'bold',
                                        borderRight: '1px solid #f0f0f0'
                                    }}
                                >
                                    {poGroup.po_number}
                                </td>
                            )}

                            {showSkuCell && (
                                <td
                                    rowSpan={skuRowCount}
                                    style={{
                                        padding: '12px 14px',
                                        verticalAlign: 'top',
                                        backgroundColor: '#fff',
                                        borderRight: '1px solid #f0f0f0'
                                    }}
                                >
                                    <strong>{skuGroup.product_code}</strong> - {skuGroup.product_name}
                                </td>
                            )}

                            <td style={{ padding: '10px 14px', fontWeight: '500' }}>
                                {batch.batch_number}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {formatDate(batch.plan_production_date)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{
                                    ...getStatusStyle(batch.batch_status),
                                    padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'
                                }}>
                                    {batch.batch_status}
                                </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                {formatQty(target)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                                {formatQty(fulfilled)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                                <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                    {percent}%
                                </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {batch.status !== '-' ? (
                                    <span style={{
                                        ...getStatusStyle(batch.status),
                                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                                    }}>
                                        {batch.status}
                                    </span>
                                ) : '-'}
                            </td>
                        </tr>
                    );
                });
            });
        });
    };

    const renderBatchView = () => {
        if (mappingList.length === 0) {
            return (
                <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                        Belum ada data mapping batch.
                    </td>
                </tr>
            );
        }

        return mappingList.map((row) => {
            const allocations = Array.isArray(row.po_allocations) && row.po_allocations.length > 0
                ? row.po_allocations
                : [{ po_number: '-', allocated_qty: row.total_allocated_qty, fulfilled_qty: row.total_fulfilled_qty, status: '-' }];

            return allocations.map((po, idx) => {
                const target = Number(po.allocated_qty) || 0;
                const fulfilled = Number(po.fulfilled_qty) || 0;
                const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

                return (
                    <tr key={`${row.id_batch}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {idx === 0 && (
                            <>
                                <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <strong>{row.batch_number}</strong>
                                </td>
                                <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <strong>{row.product_code}</strong> - {row.product_name}
                                </td>
                                <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(row.plan_production_date)}
                                </td>
                                <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <span style={{
                                        ...getStatusStyle(row.batch_status),
                                        padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'
                                    }}>
                                        {row.batch_status}
                                    </span>
                                </td>
                            </>
                        )}

                        <td style={{ padding: '10px 14px', fontWeight: '500' }}>
                            {po.po_number}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {formatQty(target)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                            {formatQty(fulfilled)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                {percent}%
                            </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {po.status !== '-' ? (
                                <span style={{
                                    ...getStatusStyle(po.status),
                                    padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                                }}>
                                    {po.status}
                                </span>
                            ) : '-'}
                        </td>
                    </tr>
                );
            });
        });
    };

    return (
        <div>
            {/* Filter Bar Tab 2 */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                alignItems: 'end'
            }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Pencarian Data</label>
                    <input
                        type="text"
                        placeholder="Cari Batch / Produk / PO..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Dari Tanggal</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={handleFromDateChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Sampai Tanggal</label>
                    <input
                        type="date"
                        value={toDate}
                        onChange={handleToDateChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Status Batch</label>
                    <select
                        value={batchStatus}
                        onChange={handleStatusChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    >
                        <option value="">Semua Status</option>
                        <option value="Open">Open</option>
                        <option value="Close">Close</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onResetFilters}
                        disabled={!isFilterActive}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                            color: isFilterActive ? '#fff' : '#adb5bd',
                            border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: isFilterActive ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            backgroundColor: '#198754',
                            color: '#fff',
                            border: '1px solid #198754',
                            borderRadius: '4px',
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {exporting ? 'Mengunduh...' : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* Tabel & Switcher View Mode */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>
                        Tampilkan Data Berdasarkan:
                    </span>

                    <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px' }}>
                        <button
                            type="button"
                            onClick={() => setViewMode('BATCH')}
                            style={{
                                padding: '6px 14px',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'BATCH' ? '#0d6efd' : 'transparent',
                                color: viewMode === 'BATCH' ? '#fff' : '#6c757d',
                                transition: 'all 0.2s'
                            }}
                        >
                            Nomor Batch
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('PO')}
                            style={{
                                padding: '6px 14px',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'PO' ? '#0d6efd' : 'transparent',
                                color: viewMode === 'PO' ? '#fff' : '#6c757d',
                                transition: 'all 0.2s'
                            }}
                        >
                            Nomor PO
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {viewMode === 'BATCH' ? (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>Nomor Batch</th>
                                        <th style={{ padding: '12px 14px' }}>Produk</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Rencana Produksi</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status Batch</th>
                                        <th style={{ padding: '12px 14px' }}>PO</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>Nomor PO</th>
                                        <th style={{ padding: '12px 14px' }}>Produk</th>
                                        <th style={{ padding: '12px 14px' }}>Nomor Batch</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Rencana Produksi</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status Batch</th>
                                    </>
                                )}
                                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Target Alokasi (PCS)</th>
                                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Terpenuhi (PCS)</th>
                                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Persentase</th>
                                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status Alokasi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'BATCH' ? renderBatchView() : renderPoView()}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={onPageChange}
                    onLimitChange={onLimitChange}
                />
            </div>
        </div>
    );
};

export default BatchMappingTable;
