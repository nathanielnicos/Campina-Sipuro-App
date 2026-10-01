import React, { useState, useRef, useEffect } from 'react';
import useOnClickOutside from '../../hooks/useOnClickOutside';
import { formatDate } from '../../utils/dateHelper';

const DateRangePicker = ({
    label = 'Date Range',
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempFrom, setTempFrom] = useState(fromDate || '');
    const [tempTo, setTempTo] = useState(toDate || '');
    const containerRef = useRef(null);

    // Close dropdown saat mengklik di luar komponen
    useOnClickOutside(containerRef, () => {
        if (isOpen) {
            setIsOpen(false);
        }
    });

    // Sinkronkan state temporary saat props dari luar berubah (misal saat tombol Reset Filters diklik)
    useEffect(() => {
        setTempFrom(fromDate || '');
        setTempTo(toDate || '');
    }, [fromDate, toDate]);

    // Format tampilan teks pada input tunggal menggunakan formatDate
    const getDisplayText = () => {
        const formattedFrom = fromDate ? formatDate(fromDate) : '';
        const formattedTo = toDate ? formatDate(toDate) : '';

        if (formattedFrom && formattedTo) return `${formattedFrom}  →  ${formattedTo}`;
        if (formattedFrom) return `${formattedFrom}  →  ...`;
        if (formattedTo) return `...  →  ${formattedTo}`;
        return '';
    };

    // Toggle pop-up dan reset temp state sesuai prop aktif saat ini
    const handleToggleOpen = () => {
        if (!isOpen) {
            setTempFrom(fromDate || '');
            setTempTo(toDate || '');
        }
        setIsOpen(!isOpen);
    };

    // Jalankan filter utama hanya saat tombol Apply diklik
    const handleApply = () => {
        if (onFromDateChange) onFromDateChange({ target: { value: tempFrom } });
        if (onToDateChange) onToDateChange({ target: { value: tempTo } });
        setIsOpen(false);
    };

    // Reset/Clear tanggal
    const handleClear = (e) => {
        e.stopPropagation();
        setTempFrom('');
        setTempTo('');
        if (onFromDateChange) onFromDateChange({ target: { value: '' } });
        if (onToDateChange) onToDateChange({ target: { value: '' } });
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#212529' }}>
                {label}
            </label>

            {/* Single Input Display */}
            <div
                onClick={handleToggleOpen}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    minHeight: '38px'
                }}
            >
                <span style={{ color: getDisplayText() ? '#212529' : '#6c757d', fontSize: '12px' }}>
                    {getDisplayText() || 'Select Date Range'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(fromDate || toDate) && (
                        <span
                            onClick={handleClear}
                            title="Clear Date"
                            style={{
                                cursor: 'pointer',
                                color: '#dc3545',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                padding: '0 4px'
                            }}
                        >
                            ✕
                        </span>
                    )}
                    <span style={{ fontSize: '14px', color: '#6c757d' }}>📅</span>
                </div>
            </div>

            {/* Custom Pop-up Picker */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: '#fff',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '12px',
                    zIndex: 1000,
                    width: '280px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#6c757d', marginBottom: '2px', fontWeight: 'bold' }}>
                                From Date
                            </label>
                            <input
                                type="date"
                                value={tempFrom}
                                onChange={(e) => setTempFrom(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '11px', color: '#6c757d', marginBottom: '2px', fontWeight: 'bold' }}>
                                To Date
                            </label>
                            <input
                                type="date"
                                value={tempTo}
                                onChange={(e) => setTempTo(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleApply}
                            style={{
                                width: '100%',
                                padding: '6px',
                                backgroundColor: '#0d6efd',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                marginTop: '4px'
                            }}
                        >
                            Apply Range
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
