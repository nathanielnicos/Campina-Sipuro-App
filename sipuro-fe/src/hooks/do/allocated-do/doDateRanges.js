// Tiga rentang tanggal di halaman Delivery Order. Setiap tampilan hanya memakai sebagian; picker lain
// tetap tampil tetapi dinonaktifkan, dan nilainya tidak dikirim ke server.

// Parameter query backend untuk tiap rentang
const PARAM_NAMES = {
    do: { from: 'fromDoDate', to: 'toDoDate' },
    return: { from: 'fromReturnDate', to: 'toReturnDate' },
    completed: { from: 'fromCompletedDate', to: 'toCompletedDate' }
};

export const RANGE_FIELDS = [
    { key: 'do', label: 'DO Date Range' },
    { key: 'return', label: 'Return Date Range' },
    { key: 'completed', label: 'Lot Completed Date Range' }
];

export const RANGE_KEYS = RANGE_FIELDS.map((field) => field.key);

export const EMPTY_RANGES = Object.freeze({
    do: Object.freeze({ from: '', to: '' }),
    return: Object.freeze({ from: '', to: '' }),
    completed: Object.freeze({ from: '', to: '' })
});

// Rentang yang berlaku per tampilan (viewMode: DO | RETURN | LOT | READY)
const ENABLED_BY_VIEW = {
    DO: ['do'],
    RETURN: ['return'],
    LOT: ['do', 'return', 'completed'],
    READY: ['completed']
};

// Ekspor memuat pengiriman dan retur: hanya rentang DO dan Return yang dipakai (Completed tidak)
export const EXPORT_RANGE_KEYS = ['do', 'return'];

export const rangeEnabledFor = (viewMode) => {
    const enabled = ENABLED_BY_VIEW[viewMode] || ENABLED_BY_VIEW.DO;
    return { do: enabled.includes('do'), return: enabled.includes('return'), completed: enabled.includes('completed') };
};

export const hasAnyRange = (ranges) => RANGE_KEYS.some((key) => Boolean(ranges[key].from || ranges[key].to));

/**
 * Parameter tanggal untuk permintaan ke server. Rentang yang tidak berlaku di tampilan ini (atau di luar allowedKeys)
 * dikirim kosong, sehingga mengubah / mengosongkan picker yang nonaktif tidak memicu permintaan baru.
 */
export const rangeParams = (viewMode, ranges, allowedKeys = RANGE_KEYS) => {
    const enabled = rangeEnabledFor(viewMode);
    const out = {};
    RANGE_KEYS.forEach((key) => {
        const active = enabled[key] && allowedKeys.includes(key);
        out[PARAM_NAMES[key].from] = active ? ranges[key].from : '';
        out[PARAM_NAMES[key].to] = active ? ranges[key].to : '';
    });
    return out;
};
