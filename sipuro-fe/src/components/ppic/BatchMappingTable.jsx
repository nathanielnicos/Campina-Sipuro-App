import React from 'react';
import { getStatusStyle } from '../../utils/statusHelper';

const formatQty = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('id-ID');
};

const BatchMappingTable = ({ mappingList }) => {
    return (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                    <th>Nomor Batch</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Target Alokasi</th>
                    <th style={{ textAlign: 'right' }}>Terpenuhi</th>
                    <th>Rincian Mapping PO (Target | Terpenuhi)</th>
                </tr>
            </thead>
            <tbody>
                {mappingList.length === 0 ? (
                    <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                            Belum ada data mapping batch.
                        </td>
                    </tr>
                ) : (
                    mappingList.map((row) => (
                        <tr key={row.id_batch}>
                            <td><strong>{row.batch_number}</strong></td>
                            <td style={{ textAlign: 'center' }}>
                                <span style={{
                                    ...(getStatusStyle ? getStatusStyle(row.batch_status) : {}),
                                    padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px'
                                }}>
                                    {row.batch_status}
                                </span>
                            </td>
                            <td>{row.product_code} - {row.product_name}</td>
                            <td style={{ textAlign: 'right' }}>{formatQty(row.total_allocated_qty)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>{formatQty(row.total_fulfilled_qty)}</td>
                            <td style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{row.po_numbers}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
};

export default BatchMappingTable;
