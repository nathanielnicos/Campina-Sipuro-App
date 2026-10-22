import React, { useState } from 'react';
import PaginationControl from '../../common/PaginationControl';
import DeliveryOrderFilter from './DoFilter';
import DoViewRows from './DoViewRows';
import DoPoViewRows from './DoPoViewRows';
import DoLotViewRows from './DoLotViewRows';
import useDeliveryOrderTable from '../../../hooks/do/allocated-do/useDeliveryOrderTable';

const DoTable = ({ reloadTrigger }) => {
    // Mode: 'DO', 'PO', atau 'LOT'
    const [viewMode, setViewMode] = useState('DO');

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDoDate, setFromDoDate] = useState('');
    const [toDoDate, setToDoDate] = useState('');

    const filterState = { searchQuery, fromDoDate, toDoDate };
    const tableData = useDeliveryOrderTable(reloadTrigger, filterState, viewMode);

    const handleReset = () => {
        setSearchQuery('');
        setFromDoDate('');
        setToDoDate('');
        tableData.setPage(1);
    };

    const isDo = viewMode === 'DO';
    const isPo = viewMode === 'PO';
    const isLot = viewMode === 'LOT';

    const tabStyle = (isActive) => ({
        padding: '6px 14px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        backgroundColor: isActive ? '#0d6efd' : 'transparent',
        color: isActive ? '#fff' : '#6c757d',
        transition: 'all 0.2s'
    });

    return (
        <div style={{ position: 'relative', opacity: tableData.loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {tableData.loading && (
                <div style={{ position: 'absolute', top: -25, right: 10, fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                    Loading DO data...
                </div>
            )}

            {tableData.error && <div style={{ color: 'red', marginBottom: '16px' }}>{tableData.error}</div>}

            <DeliveryOrderFilter
                searchQuery={searchQuery}
                fromDoDate={fromDoDate}
                toDoDate={toDoDate}
                onSearchChange={(e) => { setSearchQuery(e.target.value); tableData.setPage(1); }}
                onFromDoDateChange={(val) => { setFromDoDate(val); tableData.setPage(1); }}
                onToDoDateChange={(val) => { setToDoDate(val); tableData.setPage(1); }}
                onResetFilters={handleReset}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                {/* Switcher Mode Tab */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>Display DO By:</span>
                    <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px', gap: '2px' }}>
                        <button type="button" onClick={() => setViewMode('DO')} style={tabStyle(isDo)}>DO / Shipment No</button>
                        <button type="button" onClick={() => setViewMode('PO')} style={tabStyle(isPo)}>PO Fulfillment</button>
                        <button type="button" onClick={() => setViewMode('LOT')} style={tabStyle(isLot)}>Lot Traceability</button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {isDo && (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>DO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Pick-Up Date</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Item Qty</th>
                                        <th style={{ padding: '12px 14px' }}>Lot Number</th>
                                        <th style={{ padding: '12px 14px' }}>Target PO</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>PO Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Shipped Qty</th>
                                    </>
                                )}

                                {isPo && (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>PO Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>PO Qty</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Fulfilled</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Delivered</th>
                                        <th style={{ padding: '12px 14px' }}>DO Shipment</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Delivered Qty</th>
                                    </>
                                )}

                                {isLot && (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>Lot Number</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Production Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Exp Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Shipped</th>
                                        <th style={{ padding: '12px 14px' }}>Shipment Summary (DO &rarr; PO)</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {isDo && <DoViewRows mappingList={tableData.mappingList} />}
                            {isPo && <DoPoViewRows mappingList={tableData.mappingList} />}
                            {isLot && <DoLotViewRows mappingList={tableData.mappingList} />}
                        </tbody>
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
