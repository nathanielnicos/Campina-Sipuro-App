import React from 'react';
import { useUploadFormats } from '../../hooks/master/useUploadFormats';
import { usePermission } from '../../context/PermissionContext';

const SECTIONS = [
    { scope: 'LOT', title: 'Production Lot Upload', note: 'Used by the Upload Production Lot preview and save.' },
    { scope: 'DO', title: 'Delivery Order Upload', note: 'Used by the Upload Delivery Order preview and save (delivery orders and returns).' }
];

const cellStyle = { padding: '8px', fontSize: '12px', borderBottom: '1px solid #dee2e6' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' };
const inputStyle = { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' };
const buttonStyle = (color, filled, disabled) => ({
    padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', border: `1px solid ${color}`,
    backgroundColor: filled ? color : '#fff', color: filled ? '#fff' : color,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1
});

export const UploadFormatPanel = () => {
    const {
        formats, drafts, loading, savingScope, isChanged,
        handleFieldChange, handleColumnChange, handleResetToDefault, handleSave
    } = useUploadFormats();
    const { can } = usePermission();
    const canEdit = can('SETTINGS', 'update');
    const saving = savingScope !== null;

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>Loading upload formats...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
                Tells the system which Excel column holds each value in the RORCWMS06 file. Change it here when the report layout changes.
                Use Excel column letters (A to ZZ); every field needs its own column. Changes apply from the next upload;
                data that was already uploaded is not changed.
            </div>

            {SECTIONS.map((section) => {
                const format = formats[section.scope];
                const draft = drafts[section.scope];
                if (!format || !draft) return null;
                const changed = isChanged(section.scope);
                const locked = saving || !canEdit;

                return (
                    <div key={section.scope} style={{ border: '1px solid #dee2e6', borderRadius: '6px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#212529' }}>{section.title}</div>
                            {changed && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309' }}>Unsaved changes</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6c757d', margin: '2px 0 12px' }}>{section.note}</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle} htmlFor={`${section.scope}-start-row`}>First data row</label>
                                <input
                                    id={`${section.scope}-start-row`} type="text" inputMode="numeric" disabled={locked} value={draft.startRow}
                                    onChange={(e) => handleFieldChange(section.scope, 'startRow', e.target.value)}
                                    style={{ ...inputStyle, width: '100px' }}
                                />
                                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '3px' }}>Default: {format.defaults.startRow}</div>
                            </div>
                            <div>
                                <label style={labelStyle} htmlFor={`${section.scope}-timestamp-cell`}>Process timestamp cell</label>
                                <input
                                    id={`${section.scope}-timestamp-cell`} type="text" maxLength={6} disabled={locked} value={draft.timestampCell}
                                    onChange={(e) => handleFieldChange(section.scope, 'timestampCell', e.target.value)}
                                    placeholder="e.g. I1" style={{ ...inputStyle, width: '100px' }}
                                />
                                <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '3px' }}>
                                    Default: {format.defaults.timestampCell}. Also used to detect a file that was uploaded before.
                                </div>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5', textAlign: 'left' }}>
                                        <th style={cellStyle}>Field</th>
                                        <th style={cellStyle}>Excel Column</th>
                                        <th style={cellStyle}>Default</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {format.columns.map((field) => (
                                        <tr key={field.key}>
                                            <td style={{ ...cellStyle, fontWeight: 'bold' }}>{field.label}</td>
                                            <td style={cellStyle}>
                                                <input
                                                    type="text" maxLength={2} disabled={locked} value={draft.columns[field.key]}
                                                    aria-label={`${section.title}: ${field.label} column`}
                                                    onChange={(e) => handleColumnChange(section.scope, field.key, e.target.value)}
                                                    style={{ ...inputStyle, width: '60px', textAlign: 'center', textTransform: 'uppercase' }}
                                                />
                                            </td>
                                            <td style={{ ...cellStyle, color: '#6c757d' }}>{field.defaultColumn}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {canEdit && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" disabled={saving} onClick={() => handleResetToDefault(section.scope)} style={buttonStyle('#6c757d', false, saving)}>
                                    Reset to default
                                </button>
                                <button
                                    type="button" disabled={saving || !changed} onClick={() => handleSave(section.scope)}
                                    style={buttonStyle('#0d6efd', true, saving || !changed)}
                                >
                                    {savingScope === section.scope ? 'Processing...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default UploadFormatPanel;
