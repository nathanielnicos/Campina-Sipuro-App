import React from 'react';
import QtyStack from '../../common/QtyStack';
import ProductCell from './ProductCell';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import { cellStyle, rowStyle, emptyRow } from './doRowStyles';

export const READY_COLUMN_COUNT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

const fifoStyle = {
    display: 'inline-block',
    minWidth: '26px',
    textAlign: 'center',
    padding: '1px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
    borderRadius: '10px',
    backgroundColor: '#e7f1ff',
    color: '#084298',
    border: '1px solid #b6d4fe'
};

// Umur lot dalam hari penuh sejak tanggal selesai produksi; kosong bila tanggal tidak ada / tidak valid
const ageInDays = (value, now = Date.now()) => {
    if (!value) return null;
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value).replace(' ', 'T'));
    if (Number.isNaN(time)) return null;
    return Math.max(0, Math.floor((now - time) / DAY_MS));
};

/**
 * Tampilan Ready to Ship: satu baris per lot yang masih punya sisa, urut dari tanggal selesai produksi terlama.
 * "#" = urutan kirim global, "FIFO per Produk" = urutan di dalam produk yang sama.
 */
const DoReadyRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return emptyRow(READY_COLUMN_COUNT, 'No lots ready to ship.');
    }

    return mappingList.map((row) => {
        const age = ageInDays(row.actual_completed_datetime);
        return (
            <tr key={`${row.lot_id}-${row.lot_number}`} style={rowStyle}>
                <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{row.rank}</td>
                <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.lot_number}</td>
                <td style={{ ...cellStyle, minWidth: '220px' }}>
                    <ProductCell code={row.product_code} name={row.product_name} />
                </td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}><span style={fifoStyle}>{row.fifo_rank}</span></td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(row.actual_completed_datetime)}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDate(row.expired_date)}</td>
                <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{age === null ? '-' : age}</td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <QtyStack pcs={row.qty_lot} ctn={row.qty_lot_ctn} />
                </td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <QtyStack pcs={row.net_delivered_pcs} ctn={row.net_delivered_ctn} color="#6c757d" />
                </td>
                <td style={{ ...cellStyle, width: '120px' }}>
                    <QtyStack pcs={row.balance_pcs} ctn={row.balance_ctn} color="#198754" />
                </td>
            </tr>
        );
    });
};

export default DoReadyRows;
