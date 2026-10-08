import React, { useState } from 'react';
import { useSetting } from '../../hooks/master/useSetting';

export const SettingPage = () => {
    const [activeTab, setActiveTab] = useState('po');
    const {
        loading,
        saving,
        poSetting,
        setPoSetting,
        handleSavePoSetting
    } = useSetting();

    const insertTag = (tag) => {
        setPoSetting((prev) => ({
            ...prev,
            template_pattern: prev.template_pattern + tag
        }));
    };

    const generateLocalPreview = (pattern) => {
        if (!pattern) return '';

        const now = new Date();
        const YYYY = now.getFullYear().toString();
        const YY = YYYY.slice(-2);
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        const seqNum = poSetting.next_seq || 1;

        return pattern
            // 1. Format tag sekuensial berdasarkan nilai urutan riil dari DB
            .replace(/\{xxxx\}/g, String(seqNum).padStart(4, '0'))
            .replace(/\{xxx\}/g, String(seqNum).padStart(3, '0'))
            .replace(/\{xx\}/g, String(seqNum).padStart(2, '0'))

            // 2. Eksekusi tag customer
            .replace(/\{customer_code\}/g, 'CRMI')
            .replace(/\{customer_id\}/g, '1')

            // 3. Eksekusi tag tanggal/waktu
            .replace(/\{year\}/g, YYYY)
            .replace(/\{yy\}/g, YY)
            .replace(/\{month\}/g, MM)
            .replace(/\{date\}/g, DD)
            .replace(/\{hour\}/g, hh)
            .replace(/\{min\}/g, mm)
            .replace(/\{sec\}/g, ss);
    };

    const availableTags = [
        { label: '3-Digit Sequential', value: '{xxx}' },
        { label: '2-Digit Sequential', value: '{xx}' },
        { label: '4-Digit Sequential', value: '{xxxx}' },
        { label: 'Customer Code', value: '{customer_code}' },
        { label: 'Customer ID', value: '{customer_id}' },
        { label: 'Year (4-Digit)', value: '{year}' },
        { label: 'Year (2-Digit)', value: '{yy}' },
        { label: 'Month (2-Digit)', value: '{month}' },
        { label: 'Date (2-Digit)', value: '{date}' },
        { label: 'Hour (2-Digit)', value: '{hour}' },
        { label: 'Minute (2-Digit)', value: '{min}' },
        { label: 'Second (2-Digit)', value: '{sec}' }
    ];

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            {/* Navigation Tab Panel */}
            <div style={{
                backgroundColor: '#fff',
                padding: '12px 16px 0 16px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid #dee2e6',
                borderBottom: 'none',
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('po')}
                    disabled={saving}
                    style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        border: '1px solid #dee2e6',
                        borderBottom: activeTab === 'po' ? '3px solid #0d6efd' : '1px solid #dee2e6',
                        backgroundColor: activeTab === 'po' ? '#fff' : '#f8f9fa',
                        color: activeTab === 'po' ? '#0d6efd' : '#495057',
                        borderRadius: '4px 4px 0 0',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1
                    }}
                >
                    PO Number Format
                </button>
            </div>

            {/* Container Body */}
            <div style={{
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '0 0 8px 8px',
                border: '1px solid #dee2e6'
            }}>
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>
                        Loading PO settings...
                    </div>
                ) : (
                    activeTab === 'po' && (
                        <form onSubmit={handleSavePoSetting} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Input Pattern */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#212529' }}>
                                    PO Number Template Pattern
                                </label>
                                <input
                                    type="text"
                                    disabled={saving}
                                    value={poSetting.template_pattern}
                                    onChange={(e) => setPoSetting({ ...poSetting, template_pattern: e.target.value })}
                                    placeholder="e.g. {xxx}/PO/{customer_code}/{year}"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: '1px solid #ced4da',
                                        boxSizing: 'border-box',
                                        fontSize: '13px',
                                        fontFamily: 'monospace',
                                        backgroundColor: saving ? '#e9ecef' : '#fff'
                                    }}
                                />
                                <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#6c757d' }}>
                                    Type the pattern above or click the variable tags below to append them.
                                </span>
                            </div>

                            {/* Variable Placeholder Buttons */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
                                    Available Variable Placeholders:
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {availableTags.map((tag, idx) => (
                                        <button
                                            type="button"
                                            key={idx}
                                            disabled={saving}
                                            onClick={() => insertTag(tag.value)}
                                            style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                backgroundColor: '#f8f9fa',
                                                border: '1px solid #ced4da',
                                                borderRadius: '4px',
                                                cursor: saving ? 'not-allowed' : 'pointer',
                                                opacity: saving ? 0.6 : 1,
                                                color: '#212529',
                                                transition: 'all 0.15s ease-in-out'
                                            }}
                                        >
                                            <strong style={{ color: '#0d6efd', fontFamily: 'monospace' }}>{tag.value}</strong> ({tag.label})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reset Cycle Option */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#212529' }}>
                                    Counter Reset Cycle
                                </label>
                                <select
                                    disabled={saving}
                                    value={poSetting.reset_cycle}
                                    onChange={(e) => setPoSetting({ ...poSetting, reset_cycle: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: '1px solid #ced4da',
                                        fontSize: '13px',
                                        boxSizing: 'border-box',
                                        backgroundColor: saving ? '#e9ecef' : '#fff'
                                    }}
                                >
                                    <option value="YEARLY">Reset Every Year (Recommended)</option>
                                    <option value="MONTHLY">Reset Every Month</option>
                                    <option value="NEVER">Never Reset (Continuous)</option>
                                </select>
                            </div>

                            {/* Description TextArea */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#212529' }}>
                                    Description / Remarks
                                </label>
                                <textarea
                                    disabled={saving}
                                    rows="2"
                                    value={poSetting.description}
                                    onChange={(e) => setPoSetting({ ...poSetting, description: e.target.value })}
                                    placeholder="Additional notes regarding this setting pattern..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: '1px solid #ced4da',
                                        fontSize: '13px',
                                        boxSizing: 'border-box',
                                        backgroundColor: saving ? '#e9ecef' : '#fff'
                                    }}
                                />
                            </div>

                            {/* Sample Preview Card */}
                            <div style={{
                                backgroundColor: '#e7f1ff',
                                border: '1px solid #b6d4fe',
                                borderRadius: '6px',
                                padding: '12px 16px'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#084298', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    New PO Number Preview (Sample)
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', color: '#052c65' }}>
                                    {generateLocalPreview(poSetting.template_pattern) || '---'}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        padding: '8px 18px',
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        borderRadius: '4px',
                                        border: 'none',
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        opacity: saving ? 0.6 : 1,
                                        backgroundColor: '#0d6efd',
                                        color: '#fff',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    {saving ? 'Processing...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    )
                )}
            </div>
        </div>
    );
};

export default SettingPage;
