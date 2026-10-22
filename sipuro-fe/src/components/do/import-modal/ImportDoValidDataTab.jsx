import React, { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

const ImportDoValidDataTab = ({ allocatedDoGroups = [] }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalItems = allocatedDoGroups.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedGroups = allocatedDoGroups.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    if (totalItems === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                No valid DO allocation data available to save.
            </div>
        );
    }

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>DO / Shipment No</th>
                            <th style={{ textAlign: 'center', padding: '8px', width: '100px' }}>Pick-Up Date</th>
                            <th style={{ textAlign: 'left', padding: '8px', minWidth: '160px' }}>Item Code</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '110px' }}>Lot Number</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '90px' }}>Total DO Qty</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '120px' }}>Target PO</th>
                            <th style={{ textAlign: 'center', padding: '8px', width: '100px' }}>PO Created</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '90px' }}>Allocated (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedGroups.map(({ group, doAllocations }, gIdx) => {
                            const allocs = Array.isArray(doAllocations) && doAllocations.length > 0
                                ? doAllocations
                                : [{ poNumber: '-', poCreatedDate: null, qtyPcs: 0 }];
                            const rowSpan = allocs.length;

                            return allocs.map((alloc, aIdx) => (
                                <tr key={`${gIdx}_${aIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    {aIdx === 0 && (
                                        <>
                                            <td rowSpan={rowSpan} style={{ padding: '8px', fontWeight: 'bold', verticalAlign: 'top' }}>
                                                {group.shipmentNum}
                                            </td>
                                            <td rowSpan={rowSpan} style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                                                {formatDate(group.transDate)}
                                            </td>
                                            <td rowSpan={rowSpan} style={{ padding: '8px', verticalAlign: 'top' }}>
                                                {group.itemCode}
                                            </td>
                                            <td rowSpan={rowSpan} style={{ padding: '8px', fontFamily: 'monospace', fontWeight: '500', verticalAlign: 'top' }}>
                                                {group.lotNumber}
                                            </td>
                                            <td rowSpan={rowSpan} style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>
                                                {formatQty(group.totalQty)}
                                            </td>
                                        </>
                                    )}
                                    <td style={{ padding: '8px', fontWeight: '500' }}>
                                        {alloc.poNumber}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', color: '#6c757d' }}>
                                        {formatDate(alloc.poCreatedDate)}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                                        {formatQty(alloc.qtyPcs)}
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>

            <PaginationControl
                pagination={{
                    currentPage,
                    totalPages,
                    totalItems,
                    limit: pageSize
                }}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
            />
        </div>
    );
};

export default ImportDoValidDataTab;
