import React, { useState } from 'react';
import PaginationControl from '../../common/PaginationControl';
import SalesInvoiceFilter from './SalesInvoiceFilter';
import SiViewRows from './SiViewRows';
import SiDoViewRows from './SiDoViewRows';
import { useSalesInvoiceTable } from '../../../hooks/si/useSalesInvoiceTable';

const SalesInvoiceTable = ({ reloadTrigger }) => {
    // Mode: 'SI' (By SI Number) atau 'DO' (By DO Number)
    const [viewMode, setViewMode] = useState('SI');

    const [searchQuery, setSearchQuery] = useState('');
    const [fromSiDate, setFromSiDate] = useState('');
    const [toSiDate, setToSiDate] = useState('');

    const filterState = { searchQuery, fromSiDate, toSiDate };
    const tableData = useSalesInvoiceTable(reloadTrigger, filterState, viewMode);

    const handleReset = () => {
        setSearchQuery('');
        setFromSiDate('');
        setToSiDate('');
        tableData.setPage(1);
    };

    const isSi = viewMode === 'SI';
    const isDo = viewMode === 'DO';

    const tabStyle = (isActive) => ({
        padding: '6px 14px', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
        backgroundColor: isActive ? '#0d6efd' : 'transparent', color: isActive ? '#fff' : '#6c757d', transition: 'all 0.2s'
    });

    return (
        <div style={{ position: 'relative', opacity: tableData.loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {tableData.loading && (
                <div style={{ position: 'absolute', top: -25, right: 10, fontSize: '12px', color: '#0d6efd', fontWeight: 'bold' }}>
                    Loading Sales Invoice data...
                </div>
            )}

            {tableData.error && <div style={{ color: 'red', marginBottom: '16px' }}>{tableData.error}</div>}

            <SalesInvoiceFilter
                searchQuery={searchQuery}
                fromSiDate={fromSiDate}
                toSiDate={toSiDate}
                onSearchChange={(e) => { setSearchQuery(e.target.value); tableData.setPage(1); }}
                onFromSiDateChange={(val) => { setFromSiDate(val); tableData.setPage(1); }}
                onToSiDateChange={(val) => { setToSiDate(val); tableData.setPage(1); }}
                onResetFilters={handleReset}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>Display Invoice By:</span>
                    <div style={{ display: 'flex', backgroundColor: '#e9ecef', borderRadius: '6px', padding: '3px', gap: '2px' }}>
                        <button type="button" onClick={() => setViewMode('SI')} style={tabStyle(isSi)}>SI Number</button>
                        <button type="button" onClick={() => setViewMode('DO')} style={tabStyle(isDo)}>DO Number</button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {isSi ? (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>SI Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>SI Date</th>
                                        <th style={{ padding: '12px 14px' }}>DO Number</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Qty (Ctn)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Qty (Pcs)</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>DO Number</th>
                                        <th style={{ padding: '12px 14px' }}>SI Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>SI Date</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Qty (Ctn)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Qty (Pcs)</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {isSi ? <SiViewRows mappingList={tableData.mappingList} /> : <SiDoViewRows mappingList={tableData.mappingList} />}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={tableData.pagination}
                    onPageChange={(newPage) => tableData.setPage(newPage)}
                    onLimitChange={(newLimit) => { tableData.setLimit(newLimit); tableData.setPage(1); }}
                />
            </div>
        </div>
    );
};

export default SalesInvoiceTable;
