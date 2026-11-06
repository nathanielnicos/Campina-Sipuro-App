import React from 'react';
import { formatDateTime } from '../../../utils/dateHelper';

const extraStyle = {
    marginLeft: '6px',
    padding: '1px 6px',
    fontSize: '10px',
    borderRadius: '8px',
    backgroundColor: '#e7f1ff',
    color: '#084298',
    border: '1px solid #b6d4fe',
    whiteSpace: 'nowrap'
};

const tooltipOf = (groups) => groups
    .map((g) => `${formatDateTime(g.date)}${g.labels.length > 0 ? ` - ${g.labels.join(', ')}` : ''}`)
    .join('\n');

/**
 * Tanggal satu transaksi (DO atau retur): tanggal paling awal. Bila transaksi punya tanggal lain,
 * tampil penanda "+N"; tooltip memuat setiap tanggal beserta lot-nya.
 */
const DoDateCell = ({ dates }) => {
    if (!dates || !dates.first) return null;
    return (
        <>
            {formatDateTime(dates.first)}
            {dates.extra > 0 && (
                <span style={extraStyle} title={tooltipOf(dates.groups)}>+{dates.extra}</span>
            )}
        </>
    );
};

export default DoDateCell;
