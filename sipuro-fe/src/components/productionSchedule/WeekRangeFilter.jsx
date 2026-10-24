import { useEffect, useState } from 'react';
import { isValidWeekRange } from '../../utils/weekRange';

const inputStyle = (compact, invalid) => ({
    padding: compact ? '6px 10px' : '8px 12px',
    borderRadius: '4px',
    border: invalid ? '1px solid #dc3545' : '1px solid #ced4da',
    fontSize: '13px',
    outline: 'none'
});

// Filter rentang minggu bersama untuk Production Plan, PO Requirement, dan modal detail.
// variant "card": label di atas (filter halaman). variant "inline": satu baris (modal).
// applyMode "auto": setiap perubahan langsung diteruskan. "manual": perubahan ditahan sampai
// tombol Apply (atau Enter) ditekan, karena pemilih minggu di browser mengubah nilai tiap pindah bulan.
const WeekRangeFilter = ({
    startWeek,
    endWeek,
    onChange,
    disabled = false,
    variant = 'card',
    label,
    applyMode = 'auto'
}) => {
    const inline = variant === 'inline';
    const manual = applyMode === 'manual';
    const [draft, setDraft] = useState({ startWeek, endWeek });

    // Nilai yang sedang berlaku berubah dari luar: samakan isian.
    useEffect(() => {
        setDraft({ startWeek, endWeek });
    }, [startWeek, endWeek]);

    const shown = manual ? draft : { startWeek, endWeek };
    const dirty = manual && (draft.startWeek !== startWeek || draft.endWeek !== endWeek);
    const invalid = !isValidWeekRange(shown.startWeek, shown.endWeek);

    const change = (newStart, newEnd) => {
        if (manual) setDraft({ startWeek: newStart, endWeek: newEnd });
        else onChange(newStart, newEnd);
    };

    const apply = () => {
        if (dirty && !invalid && !disabled) onChange(draft.startWeek, draft.endWeek);
    };

    const handleKeyDown = (e) => {
        if (manual && e.key === 'Enter') apply();
    };
    const title = label || (inline ? 'Filter Week:' : 'Week Range Filter');

    return (
        <div style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', alignItems: inline ? 'center' : 'stretch', gap: inline ? '6px' : '6px' }}>
            <label style={inline
                ? { fontSize: '13px', fontWeight: '600', color: '#495057' }
                : { fontSize: '12px', fontWeight: '700', color: '#212529' }}
            >
                {title}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    type="week"
                    disabled={disabled}
                    value={shown.startWeek}
                    onChange={(e) => change(e.target.value, shown.endWeek)}
                    onKeyDown={handleKeyDown}
                    style={inputStyle(inline, invalid)}
                />
                <span style={{ fontSize: '13px', color: '#6c757d', fontWeight: '500' }}>to</span>
                <input
                    type="week"
                    disabled={disabled}
                    value={shown.endWeek}
                    onChange={(e) => change(shown.startWeek, e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={inputStyle(inline, invalid)}
                />
                {manual && (
                    <button
                        type="button"
                        onClick={apply}
                        disabled={!dirty || invalid || disabled}
                        style={{
                            backgroundColor: (!dirty || invalid || disabled) ? '#adb5bd' : '#0d6efd',
                            color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px',
                            fontSize: '13px', fontWeight: '600',
                            cursor: (!dirty || invalid || disabled) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Apply
                    </button>
                )}
            </div>
            {invalid && (
                <span style={{ fontSize: '11px', color: '#dc3545' }}>
                    Choose a valid range (start week must not be after end week).
                </span>
            )}
        </div>
    );
};

export default WeekRangeFilter;
