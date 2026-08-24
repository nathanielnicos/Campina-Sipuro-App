import React from 'react';
import { getStatusStyle } from '../../utils/statusHelper';
import PaginationControl from '../common/PaginationControl';

const formatQty = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('id-ID');
};

const BatchMappingTable = ({
    mappingList = [],
    pagination = { currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 },
    onPageChange,
    onLimitChange
}) => {
    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>Nomor Batch</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '12px 16px' }}>SKU</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Target Alokasi</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Terpenuhi</th>
                            <th style={{ padding: '12px 16px' }}>Rincian Mapping PO (Target | Terpenuhi)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappingList.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    Belum ada data mapping batch.
                                </td>
                            </tr>
                        ) : (
                            mappingList.map((row) => (
                                <tr key={row.id_batch} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <strong>{row.batch_number}</strong>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            ...(getStatusStyle ? getStatusStyle(row.batch_status) : {}),
                                            padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'
                                        }}>
                                            {row.batch_status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {row.product_code} - {row.product_name}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        {formatQty(row.total_allocated_qty)}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                                        {formatQty(row.total_fulfilled_qty)}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                                        {row.po_numbers}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Reusable Pagination Component */}
            <PaginationControl
                pagination={pagination}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        </div>
    );
};

export default BatchMappingTable;
