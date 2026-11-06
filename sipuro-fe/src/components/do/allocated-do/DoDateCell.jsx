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

/**
 * Tanggal pada baris Summary: tanggal paling awal; bila ada tanggal lain pada baris yang sama
 * tampil penanda "+N" dengan daftar tanggalnya di tooltip.
 */
const DoDateCell = ({ dates }) => {
    if (!dates || !dates.first) return null;
    return (
        <>
            {formatDateTime(dates.first)}
            {dates.extra > 0 && (
                <span style={extraStyle} title={dates.all.map(formatDateTime).join('\n')}>+{dates.extra}</span>
            )}
        </>
    );
};

export default DoDateCell;
