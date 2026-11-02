import React, { useState } from 'react';
import PaginationControl from '../../common/PaginationControl';
import DoFilter from './DoFilter';
import DoViewModeSwitcher from './DoViewModeSwitcher';
import DoSummaryRows from './DoSummaryRows';
import DoDetailRows from './DoDetailRows';
import DoLotViewRows from './DoLotViewRows';
import DoReturnViewRows from './DoReturnViewRows';
import useDeliveryOrderTable from '../../../hooks/do/allocated-do/useDeliveryOrderTable';

const thStyle = { padding: '12px 14px' };
const QTY_COLUMN = 'Qty (Pcs)';

// Kolom per tampilan
const COLUMNS = {
    DO_SUMMARY: ['DO Number', 'Date and Time', 'Product', 'Qty (Pcs)'],
    DO_LOT: ['DO Number', 'Date and Time', 'Product', 'Lot Number', 'Qty (Pcs)'],
    LOT: ['Lot Number', 'Product', 'Completed Date and Time', 'Exp Date', 'DO Number', 'Date and Time', 'Qty (Pcs)'],
    RETURN: ['Return Number', 'Date and Time', 'Lot Number', 'Product', 'Qty (Pcs)']
};

const DoTable = ({ reloadTrigger }) => {
    const [viewMode, setViewMode] = useState('DO'); // 'DO' | 'LOT' | 'RETURN'
    const [detailLevel, setDetailLevel] = useState('SUMMARY'); // 'SUMMARY' | 'LOT' (hanya tampilan DO)

    const [searchQuery, setSearchQuery] = useState('');
    const [fromDoDate, setFromDoDate] = useState('');
    const [toDoDate, setToDoDate] = useState('');

    const tableData = useDeliveryOrderTable(reloadTrigger, { searchQuery, fromDoDate, toDoDate }, viewMode);

    const handleReset = () => {
        setSearchQuery('');
        setFromDoDate('');
        setToDoDate('');
        tableData.setPage(1);
    };

    let columns = COLUMNS.RETURN;
    let rows = <DoReturnViewRows mappingList={tableData.mappingList} />;
    if (viewMode === 'DO' && detailLevel === 'SUMMARY') {
        columns = COLUMNS.DO_SUMMARY;
        rows = <DoSummaryRows mappingList={tableData.mappingList} />;
    } else if (viewMode === 'DO') {
        columns = COLUMNS.DO_LOT;
        rows = <DoDetailRows mappingList={tableData.mappingList} />;
    } else if (viewMode === 'LOT') {
        columns = COLUMNS.LOT;
        rows = <DoLotViewRows mappingList={tableData.mappingList} />;
    }

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
                fromDoDate={fromDoDate}
                toDoDate={toDoDate}
                onSearchChange={(e) => { setSearchQuery(e.target.value); tableData.setPage(1); }}
                onFromDoDateChange={(val) => { setFromDoDate(val); tableData.setPage(1); }}
                onToDoDateChange={(val) => { setToDoDate(val); tableData.setPage(1); }}
                onResetFilters={handleReset}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <DoViewModeSwitcher
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    detailLevel={detailLevel}
                    onDetailLevelChange={setDetailLevel}
                />

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {columns.map((label) => (
                                    <th key={label} style={label === QTY_COLUMN ? { ...thStyle, textAlign: 'right' } : thStyle}>{label}</th>
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
