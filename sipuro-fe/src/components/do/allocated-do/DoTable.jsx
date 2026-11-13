import React, { useState, useMemo } from 'react';
import PaginationControl from '../../common/PaginationControl';
import DoFilter from './DoFilter';
import DoViewModeSwitcher from './DoViewModeSwitcher';
import DoSummaryRows from './DoSummaryRows';
import DoDetailRows from './DoDetailRows';
import DoLotViewRows from './DoLotViewRows';
import DoReadyRows from './DoReadyRows';
import DoReturnViewRows from './DoReturnViewRows';
import DoReturnSummaryRows from './DoReturnSummaryRows';
import useDeliveryOrderTable from '../../../hooks/do/allocated-do/useDeliveryOrderTable';
import useEstimatedPo from '../../../hooks/do/allocated-do/useEstimatedPo';
import useDeliveryOrderExport from '../../../hooks/do/allocated-do/useDeliveryOrderExport';
import { usePermission } from '../../../context/PermissionContext';
import { EMPTY_RANGES, EXPORT_RANGE_KEYS, rangeEnabledFor, rangeParams } from '../../../hooks/do/allocated-do/doDateRanges';

const thStyle = { padding: '12px 14px' };
const RIGHT_ALIGNED_COLUMNS = ['Qty (Pcs)', 'Qty Lot', 'Remaining (Pcs)', 'Balance (Pcs)', 'Net Delivered (Pcs)', 'Age (Days)'];
const ESTIMATED_PO_COLUMN = 'Estimated PO';

// Kolom per tampilan. DO dan Return memakai urutan yang sama: nomor transaksi, waktu, produk, lot, qty.
const COLUMNS = {
    DO_SUMMARY: ['DO Number', 'Date and Time', 'Product', 'Qty (Pcs)'],
    DO_LOT: ['DO Number', 'Date and Time', 'Product', 'Lot Number', 'Qty (Pcs)'],
    LOT: ['Lot Number', 'Product', 'Completed Date and Time', 'Exp Date', 'DO / Return Number', 'Date and Time', 'Qty (Pcs)', 'Balance (Pcs)'],
    READY: ['#', 'Lot Number', 'Product', 'FIFO per Product', 'Completed Date and Time', 'Exp Date', 'Age (Days)', 'Qty Lot', 'Net Delivered (Pcs)', 'Remaining (Pcs)'],
    RETURN_SUMMARY: ['Return Number', 'Date and Time', 'Product', 'Qty (Pcs)'],
    RETURN_LOT: ['Return Number', 'Date and Time', 'Product', 'Lot Number', 'Qty (Pcs)']
};

const DoTable = ({ reloadTrigger }) => {
    // Export hanya untuk kelompok yang diberi izin "export" pada menu DO (diatur di Access Permission)
    const { can } = usePermission();
    const canExport = can('DO', 'export');

    const [viewMode, setViewMode] = useState('DO'); // 'DO' | 'RETURN' | 'LOT' | 'READY'
    const [detailLevel, setDetailLevel] = useState('SUMMARY'); // 'SUMMARY' | 'LOT' (tampilan DO dan Return)

    const [searchQuery, setSearchQuery] = useState('');
    // Tiga rentang tanggal terpisah: do (DO Date), return (Return Date), completed (Lot Completed Date)
    const [ranges, setRanges] = useState(EMPTY_RANGES);

    const [showEstimatedPo, setShowEstimatedPo] = useState(false);

    // Hanya rentang yang berlaku di tampilan aktif yang dikirim; ekspor hanya memakai rentang DO dan Return
    const rangeEnabled = rangeEnabledFor(viewMode);
    const tableData = useDeliveryOrderTable(reloadTrigger, { searchQuery, ...rangeParams(viewMode, ranges) }, viewMode);
    const exportData = useDeliveryOrderExport({ searchQuery, ...rangeParams(viewMode, ranges, EXPORT_RANGE_KEYS) });

    // Perkiraan PO hanya untuk tampilan DO Number (Summary dan Per Lot), atas DO yang sedang tampil
    const estimatedPoActive = showEstimatedPo && viewMode === 'DO';
    const visibleDoIds = useMemo(
        () => (viewMode === 'DO' ? tableData.mappingList.map((order) => order.delivery_order_id) : []),
        [viewMode, tableData.mappingList]
    );
    const estimate = useEstimatedPo(estimatedPoActive, visibleDoIds);

    const handleRangeChange = (key, edge, value) => {
        setRanges((prev) => ({ ...prev, [key]: { ...prev[key], [edge]: value } }));
        tableData.setPage(1);
    };

    const handleReset = () => {
        setSearchQuery('');
        setRanges(EMPTY_RANGES);
        tableData.setPage(1);
    };

    let columns = COLUMNS.RETURN_LOT;
    let rows = <DoReturnViewRows mappingList={tableData.mappingList} />;
    if (viewMode === 'RETURN' && detailLevel === 'SUMMARY') {
        columns = COLUMNS.RETURN_SUMMARY;
        rows = <DoReturnSummaryRows mappingList={tableData.mappingList} />;
    } else if (viewMode === 'DO' && detailLevel === 'SUMMARY') {
        columns = COLUMNS.DO_SUMMARY;
        rows = <DoSummaryRows mappingList={tableData.mappingList} estimate={estimate} />;
    } else if (viewMode === 'DO') {
        columns = COLUMNS.DO_LOT;
        rows = <DoDetailRows mappingList={tableData.mappingList} estimate={estimate} />;
    } else if (viewMode === 'LOT') {
        columns = COLUMNS.LOT;
        rows = <DoLotViewRows mappingList={tableData.mappingList} />;
    } else if (viewMode === 'READY') {
        columns = COLUMNS.READY;
        rows = <DoReadyRows mappingList={tableData.mappingList} />;
    }

    if (estimatedPoActive) columns = [...columns, ESTIMATED_PO_COLUMN];

    return (
        <div style={{ position: 'relative', opacity: tableData.loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {tableData.loading && (
                <div style={{ position: 'absolute', top: -25, right: 10, fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                    Loading DO data...
                </div>
            )}

            {tableData.error && <div style={{ color: 'red', marginBottom: '16px' }}>{tableData.error}</div>}

            <DoFilter
                searchQuery={searchQuery}
                ranges={ranges}
                rangeEnabled={rangeEnabled}
                onSearchChange={(e) => { setSearchQuery(e.target.value); tableData.setPage(1); }}
                onRangeChange={handleRangeChange}
                onResetFilters={handleReset}
                estimatedPoEnabled={viewMode === 'DO'}
                estimatedPoOn={showEstimatedPo}
                onToggleEstimatedPo={() => setShowEstimatedPo((on) => !on)}
                canExport={canExport}
                exporting={exportData.exporting}
                onExport={exportData.handleExportExcel}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <DoViewModeSwitcher
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    detailLevel={detailLevel}
                    onDetailLevelChange={setDetailLevel}
                />

                {viewMode === 'LOT' && (
                    <div style={{ padding: '8px 14px', fontSize: '12px', color: '#6c757d', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        Date ranges select lots that have a matching DO, return, or completed date. Each lot always shows its full history so the balance stays correct.
                    </div>
                )}

                {viewMode === 'READY' && (
                    <div style={{ padding: '8px 14px', fontSize: '12px', color: '#6c757d', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        Lots with remaining stock, oldest completed date first. Lots without PO allocation are hidden. The Lot Completed Date Range applies here; lots without a completed date are hidden when it is set.
                    </div>
                )}

                {estimatedPoActive && (
                    <div style={{ padding: '8px 14px', fontSize: '12px', color: '#6c757d', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        {estimate.error
                            ? <span style={{ color: '#dc3545' }}>{estimate.error}</span>
                            : 'Estimated PO is a FIFO estimate per lot (oldest PO and oldest DO first). It is not recorded data and does not change DO values.'}
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {columns.map((label) => (
                                    <th key={label} style={RIGHT_ALIGNED_COLUMNS.includes(label) ? { ...thStyle, textAlign: 'right' } : thStyle}>{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{rows}</tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={tableData.pagination}
                    onPageChange={(newPage) => tableData.setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        tableData.setLimit(newLimit);
                        tableData.setPage(1);
                    }}
                />
            </div>
        </div>
    );
};

export default DoTable;
