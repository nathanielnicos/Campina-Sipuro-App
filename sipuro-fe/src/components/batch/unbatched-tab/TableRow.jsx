import React from 'react';
import { formatQty } from '../../../utils/formatters';

const TableRow = ({ row, currentUserRole, isAnyFilterActive, onOpenModal }) => {
    // Memastikan array po_items tersedia, fallback jika backend mengirim po_numbers string lama
    let items = [];
    if (row.po_items && Array.isArray(row.po_items) && row.po_items.length > 0) {
        items = row.po_items;
    } else if (row.po_numbers) {
        const poList = row.po_numbers.split('\n').filter(Boolean);
        const createdList = row.created_dates ? row.created_dates.split('\n').filter(Boolean) : [];
        const deliveryList = row.requested_delivery_dates ? row.requested_delivery_dates.split('\n').filter(Boolean) : [];

        items = poList.map((itemStr, idx) => {
            const poNumber = itemStr.split(' (')[0];
            const match = itemStr.match(/\((.*?)\)/);
            const rawContent = match ? match[1] : '';
            const numericPart = rawContent.split(' ')[0];

            return {
                po_number: poNumber,
                created_date: createdList[idx] || '-',
                requested_delivery_date: deliveryList[idx] || '-',
                remaining_qty: numericPart || 0
            };
        });
    }

    const rowSpanCount = items.length > 0 ? items.length : 1;

    if (items.length === 0) {
        return (
            <tr style={{ borderBottom: '1px solid #f1f3f5' }}>
                <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <strong>{row.product_code}</strong>
                </td>
                <td style={{ padding: '12px 10px', verticalAlign: 'middle', maxWidth: '220px', wordBreak: 'break-word', color: '#212529', fontWeight: '500' }}>
                    {row.product_name}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    {formatQty(row.total_qty_needed)}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', color: '#212529' }}>
                    {formatQty(row.total_po_count)}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
            </tr>
        );
    }

    return (
        <>
            {items.map((item, idx) => {
                const isFirstRow = idx === 0;
                const isLastRow = idx === items.length - 1;

                return (
                    <tr
                        key={`${row.id_product}-${idx}`}
                        style={{
                            borderBottom: isLastRow ? '1px solid #dee2e6' : '1px dashed #e9ecef',
                            backgroundColor: '#fff'
                        }}
                    >
                        {/* Kolom Induk Utama (Tanpa border vertikal) */}
                        {isFirstRow && (
                            <>
                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <strong>{row.product_code}</strong>
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        verticalAlign: 'middle',
                                        maxWidth: '220px',
                                        wordBreak: 'break-word',
                                        color: '#212529',
                                        fontWeight: '500'
                                    }}
                                >
                                    {row.product_name}
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        textAlign: 'right',
                                        fontWeight: 'bold',
                                        verticalAlign: 'middle',
                                        color: '#212529'
                                    }}
                                >
                                    {formatQty(row.total_qty_needed)}
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        textAlign: 'center',
                                        verticalAlign: 'middle',
                                        color: '#212529'
                                    }}
                                >
                                    {formatQty(row.total_po_count)}
                                </td>
                            </>
                        )}

                        {/* Kolom Detail Per-PO */}
                        <td style={{ padding: '8px 10px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: '500', color: '#212529' }}>
                            {item.po_number || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#212529' }}>
                            {item.created_date || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#212529', fontWeight: '500' }}>
                            {formatQty(item.remaining_qty)}
                        </td>
                    </tr>
                );
            })}
        </>
    );
};

export default TableRow;
