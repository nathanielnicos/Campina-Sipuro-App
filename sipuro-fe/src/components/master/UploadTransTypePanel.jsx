import React from 'react';
import { useUploadTransTypes } from '../../hooks/master/useUploadTransTypes';
import { usePermission } from '../../context/PermissionContext';

const SECTIONS = [
    { scope: 'LOT', title: 'Production Lot Upload', note: 'Rows of an active type change the lot allocation. WIP Completion and WIP Completion Return are the production types (Batch + Lot + Item) and are fixed. Types you add are matched by Lot + Item. Out reduces allocations. In restores what the same Doc Source reduced earlier; with no earlier reduction it adds to the lot output.' },
    { scope: 'DO', title: 'Delivery Order Upload', note: 'Only Sales Order Issue and RMA Receipt are supported. They can be activated or deactivated.' }
];

const MATCH_LABEL = { BATCH_LOT: 'Production (Batch + Lot + Item)', LOT: 'Lot + Item' };

const cellStyle = { padding: '8px', fontSize: '12px', borderBottom: '1px solid #dee2e6' };
const inputStyle = { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' };
const smallButton = (color) => ({
    padding: '3px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: `1px solid ${color}`,
    backgroundColor: '#fff', color, cursor: 'pointer', marginRight: '6px'
});

export const UploadTransTypePanel = () => {
    const {
        types, loading, saving, form, editingId,
        handleFormChange, handleSubmit, resetForm, startEdit, handleToggleStatus
    } = useUploadTransTypes();
    const { can } = usePermission();
    const canEdit = can('SETTINGS', 'update');

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>Loading trans types...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
                Only rows whose Trans Type is listed and active are read from the Excel file. Letter case does not matter.
                Direction decides the quantity column: In = column Q (adds), Out = column T (reduces).
            </div>

            {canEdit && (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', padding: '12px', border: '1px solid #dee2e6', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {editingId === null ? 'New Trans Type (non-production)' : 'Edit Trans Type'}
                        </label>
                        <input
                            type="text" required maxLength={50} disabled={saving} value={form.transType}
                            onChange={(e) => handleFormChange('transType', e.target.value)}
                            placeholder="e.g. Good Issue Sample QC" style={{ ...inputStyle, width: '240px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Direction</label>
                        <select disabled={saving} value={form.direction} onChange={(e) => handleFormChange('direction', e.target.value)} style={inputStyle}>
                            <option value="OUT">Out (reduces, column T)</option>
                            <option value="IN">In (adds or restores, column Q)</option>
                        </select>
                    </div>
                    <button type="submit" disabled={saving} style={{ ...inputStyle, border: 'none', backgroundColor: '#0d6efd', color: '#fff', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Processing...' : (editingId === null ? 'Add' : 'Save')}
                    </button>
                    {editingId !== null && (
                        <button type="button" disabled={saving} onClick={resetForm} style={{ ...inputStyle, backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
                    )}
                </form>
            )}

            {SECTIONS.map((section) => {
                const rows = types.filter((t) => t.scope === section.scope);
                return (
                    <div key={section.scope}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#212529' }}>{section.title}</div>
                        <div style={{ fontSize: '11px', color: '#6c757d', margin: '2px 0 8px' }}>{section.note}</div>
                        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5', textAlign: 'left' }}>
                                        <th style={cellStyle}>Trans Type</th>
                                        <th style={cellStyle}>Direction</th>
                                        <th style={cellStyle}>Match By</th>
                                        <th style={cellStyle}>Status</th>
                                        <th style={cellStyle}>Used</th>
                                        {canEdit && <th style={cellStyle}>Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={canEdit ? 6 : 5} style={{ ...cellStyle, textAlign: 'center', color: '#6c757d' }}>No trans types.</td></tr>
                                    ) : rows.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.trans_type}</td>
                                            <td style={cellStyle}>{item.direction === 'IN' ? 'In (Q)' : 'Out (T)'}</td>
                                            <td style={cellStyle}>{section.scope === 'DO' ? '-' : MATCH_LABEL[item.match_by]}</td>
                                            <td style={{ ...cellStyle, color: item.is_active ? '#198754' : '#6c757d', fontWeight: 'bold' }}>
                                                {item.is_active ? 'Active' : 'Inactive'}
                                            </td>
                                            <td style={cellStyle}>{item.in_use ? 'Yes' : 'No'}</td>
                                            {canEdit && (
                                                <td style={cellStyle}>
                                                    <button type="button" disabled={saving} onClick={() => handleToggleStatus(item)} style={smallButton(item.is_active ? '#dc3545' : '#198754')}>
                                                        {item.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    {section.scope === 'LOT' && item.match_by !== 'BATCH_LOT' && !item.in_use && (
                                                        <button type="button" disabled={saving} onClick={() => startEdit(item)} style={smallButton('#0d6efd')}>Edit</button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default UploadTransTypePanel;
