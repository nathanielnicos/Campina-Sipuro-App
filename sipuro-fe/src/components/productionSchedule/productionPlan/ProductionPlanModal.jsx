import { useMemo } from 'react';
import { formatQty } from '../../../utils/formatters';

const ProductionPlanModal = ({
    isOpen,
    onClose,
    product,
    weeks,
    startWeek,
    endWeek,
    onFilterChange,
    revisions,
    setRevisions,
    initialRevisions,
    hasExistingPlan,
    loading,
    saving,
    onSave
}) => {
    // Helper Unformat Thousand Separator
    const parseNumberOnly = (val) => {
        if (typeof val === 'number') return val;
        const cleaned = String(val || '').replace(/\D/g, '');
        return cleaned ? parseInt(cleaned, 10) : 0;
    };

    // Indeks revisi terakhir sebelum Campina's Plan
    const lastRevIndex = useMemo(() => {
        if (revisions.length <= 1) return 0;
        return revisions.length - 2;
    }, [revisions]);

    // Tambah Baris Revision Baru
    const handleAddRevision = () => {
        const today = new Date();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateFormattedStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
        const todayIso = today.toISOString().split('T')[0];

        const lastRevData = revisions[lastRevIndex]?.weeks_data || {};
        const copiedWeeksData = { ...lastRevData };

        const newRevisionItem = {
            revision_type: 'REVISION',
            revision_label: `Revision ${dateFormattedStr}`,
            revision_date: todayIso,
            weeks_data: copiedWeeksData
        };

        const updatedRevs = [...revisions];
        // Sisipkan sebelum baris Campina's Plan
        const campinaPlanIndex = updatedRevs.length - 1;
        updatedRevs.splice(campinaPlanIndex, 0, newRevisionItem);

        // Update Campina's Plan agar default-nya ikut revisi baru
        updatedRevs[updatedRevs.length - 1] = {
            ...updatedRevs[updatedRevs.length - 1],
            weeks_data: { ...copiedWeeksData }
        };

        setRevisions(updatedRevs);
    };

    // Handle Perubahan Input Cell Qty
    const handleCellChange = (revIndex, weekKey, rawInputValue) => {
        const numValue = parseNumberOnly(rawInputValue);
        const updatedRevs = [...revisions];

        // 1. Update sel yang diketik
        updatedRevs[revIndex] = {
            ...updatedRevs[revIndex],
            weeks_data: {
                ...updatedRevs[revIndex].weeks_data,
                [weekKey]: numValue
            }
        };

        // 2. Jika yang di-edit adalah revisi terakhir (atau Proposed jika belum ada revisi),
        //    otomatis ikuti nilainya ke Campina's Plan
        const campinaIdx = updatedRevs.length - 1;
        if (revIndex === (campinaIdx - 1)) {
            updatedRevs[campinaIdx] = {
                ...updatedRevs[campinaIdx],
                weeks_data: {
                    ...updatedRevs[campinaIdx].weeks_data,
                    [weekKey]: numValue
                }
            };
        }

        setRevisions(updatedRevs);
    };

    // Validasi Tombol Save
    const isSaveDisabled = useMemo(() => {
        if (loading || saving) return true;
        const isDataChanged = JSON.stringify(revisions) !== JSON.stringify(initialRevisions);
        if (!isDataChanged) return true;

        for (const rev of revisions) {
            if (!rev.weeks_data) return true;
            for (const w of weeks) {
                const key = `${w.year}_${w.week_number}`;
                const val = rev.weeks_data[key];
                if (val === undefined || val === null || val === '') return true;
            }
        }
        return false;
    }, [revisions, initialRevisions, weeks, loading, saving]);

    // Data revisi terakhir untuk acuan highlight
    const lastRevWeeksData = revisions[lastRevIndex]?.weeks_data || {};

    // Data awal Campina's Plan (Before) dari database
    const initialCampinaPlanData = useMemo(() => {
        const initialCampinaObj = initialRevisions.find(r => r.revision_type === 'CAMPINA_PLAN');
        return initialCampinaObj?.weeks_data || {};
    }, [initialRevisions]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1050
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', width: '90%',
                maxWidth: '1200px', maxHeight: '90vh', display: 'flex',
                flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h5 style={{ margin: 0, fontWeight: 'bold', color: '#212529' }}>Production Plan Detail</h5>
                        <small style={{ color: '#6c757d' }}>
                            Product: <strong>{product?.product_code}</strong> - {product?.product_name}
                        </small>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            border: 'none', background: 'transparent', fontSize: '20px',
                            cursor: saving ? 'not-allowed' : 'pointer', color: '#6c757d',
                            opacity: saving ? 0.5 : 1
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#495057' }}>
                            <label style={{ fontWeight: '600' }}>Filter Week:</label>
                            <input
                                type="week"
                                disabled={saving}
                                value={startWeek}
                                onChange={(e) => onFilterChange(e.target.value, endWeek)}
                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', outline: 'none' }}
                            />
                            <span>to</span>
                            <input
                                type="week"
                                disabled={saving}
                                value={endWeek}
                                onChange={(e) => onFilterChange(startWeek, e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', outline: 'none' }}
                            />
                        </div>

                        <button
                            onClick={handleAddRevision}
                            disabled={loading || saving}
                            style={{
                                backgroundColor: (loading || saving) ? '#6c757d' : '#198754',
                                color: '#fff', border: 'none',
                                padding: '8px 16px', borderRadius: '4px', fontWeight: '600',
                                cursor: (loading || saving) ? 'not-allowed' : 'pointer', fontSize: '13px',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            + Add Revision
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                            Loading plan data...
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', minWidth: '180px', position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2 }}>
                                            Version Plan
                                        </th>
                                        {weeks.map(w => (
                                            <th key={`${w.year}_${w.week_number}`} style={{ padding: '10px 12px', textAlign: 'center', minWidth: '110px' }}>
                                                <div>Week {w.week_number}</div>
                                                <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'normal' }}>
                                                    {w.date_label}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Baris Revisions & Active Campina's Plan */}
                                    {revisions.map((rev, rIdx) => {
                                        const isCampinaPlan = rev.revision_type === 'CAMPINA_PLAN';

                                        return (
                                            <tr key={rIdx} style={{
                                                borderBottom: '1px solid #dee2e6',
                                                backgroundColor: isCampinaPlan ? '#f0f7ff' : '#fff'
                                            }}>
                                                <td style={{
                                                    padding: '10px 12px', fontWeight: 'bold', color: isCampinaPlan ? '#0d6efd' : '#212529',
                                                    position: 'sticky', left: 0, backgroundColor: isCampinaPlan ? '#f0f7ff' : '#fff', zIndex: 1
                                                }}>
                                                    {rev.revision_label}
                                                </td>

                                                {weeks.map(w => {
                                                    const key = `${w.year}_${w.week_number}`;
                                                    const currentVal = rev.weeks_data?.[key] ?? 0;
                                                    const lastRevVal = lastRevWeeksData[key] ?? 0;

                                                    // Highlight Oranye jika Campina's Plan di-edit manual berbeda dari revisi terakhir
                                                    const isEditedInCampina = isCampinaPlan && Number(currentVal) !== Number(lastRevVal);

                                                    return (
                                                        <td key={key} style={{
                                                            padding: '4px', textAlign: 'center',
                                                            backgroundColor: isEditedInCampina ? '#fff3cd' : 'transparent'
                                                        }}>
                                                            <input
                                                                type="text"
                                                                disabled={saving}
                                                                value={formatQty(currentVal)}
                                                                onChange={(e) => handleCellChange(rIdx, key, e.target.value)}
                                                                style={{
                                                                    width: '100%',
                                                                    boxSizing: 'border-box',
                                                                    padding: '6px 8px',
                                                                    textAlign: 'right',
                                                                    borderRadius: '4px',
                                                                    border: isEditedInCampina ? '1px solid #ffe69c' : '1px solid #ced4da',
                                                                    backgroundColor: isEditedInCampina ? '#fff3cd' : '#fff',
                                                                    fontWeight: isEditedInCampina ? 'bold' : 'normal',
                                                                    color: '#212529',
                                                                    outline: 'none',
                                                                    opacity: saving ? 0.7 : 1
                                                                }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {/* Baris Campina's Plan (Before) - Dipindah ke Paling Bawah */}
                                    {hasExistingPlan && (
                                        <tr style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                                            <td style={{
                                                padding: '10px 12px', fontWeight: 'bold', color: '#6c757d',
                                                position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 1
                                            }}>
                                                Campina's Plan (Before)
                                            </td>
                                            {weeks.map(w => {
                                                const key = `${w.year}_${w.week_number}`;
                                                const beforeVal = initialCampinaPlanData[key] ?? 0;
                                                return (
                                                    <td key={key} style={{ padding: '10px 12px', textAlign: 'right', color: '#6c757d', fontWeight: 'bold' }}>
                                                        {formatQty(beforeVal)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            backgroundColor: '#6c757d', color: '#fff', border: 'none',
                            padding: '8px 16px', borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600',
                            opacity: saving ? 0.6 : 1
                        }}
                    >
                        Close
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaveDisabled}
                        style={{
                            backgroundColor: isSaveDisabled ? '#adb5bd' : '#0d6efd',
                            color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '4px',
                            cursor: isSaveDisabled ? 'not-allowed' : 'pointer', fontWeight: '600',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductionPlanModal;
