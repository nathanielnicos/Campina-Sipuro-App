import React, { useState } from 'react';
import ImportSiSummaryCards from './ImportSiSummaryCards';
import ImportSiValidDataTab from './ImportSiValidDataTab';
import ImportSiRawDataTab from './ImportSiRawDataTab';

const ImportSiModal = ({ show, onClose, onConfirmImport, parsedData = null, loading = false }) => {
    const [activeTab, setActiveTab] = useState('valid');

    if (!show || !parsedData) return null;

    const {
        summary = {},
        validRows = [],
        unallocatedRows = [],
        duplicateRows = [],
        nonInterfacedRows = [],
        unregisteredRows = []
    } = parsedData;

    const tabConfigs = {
        valid: {
            title: 'Valid Sales Invoices',
            alertBg: '#d1e7dd', alertColor: '#0f5132', alertBorder: '#badbcc',
            alertMessage: 'The Sales Invoices below successfully matched with registered Delivery Orders. Click Save to commit.'
        },
        unallocated: {
            title: 'Unallocated (Delivery Order Not Found)',
            alertBg: '#cff4fc', alertColor: '#055160', alertBorder: '#b6effb',
            alertMessage: 'The rows below could not be matched because the referenced DO has not been uploaded yet in the Delivery Order menu.'
        },
        duplicate: {
            title: 'Duplicate Rows (Skipped)',
            alertBg: '#fff3cd', alertColor: '#664d03', alertBorder: '#ffecb5',
            alertMessage: 'These Sales Invoices have already been saved previously.'
        },
        non_interfaced: {
            title: 'Non-Interfaced Status',
            alertBg: '#e2e3e5', alertColor: '#41464b', alertBorder: '#d3d6d8',
            alertMessage: 'These rows do not have INTERFACED delivery status and are ignored.'
        },
        unregistered: {
            title: 'Unregistered SKU',
            alertBg: '#f8d7da', alertColor: '#842029', alertBorder: '#f5c2c7',
            alertMessage: 'These item codes are not registered in the master products list.'
        }
    };

    const currentConfig = tabConfigs[activeTab] || tabConfigs.valid;
    const isSaveDisabled = loading || parsedData.isReupload || !parsedData.canSave;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', width: '1100px', maxWidth: '95%', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: 'bold' }}>
                        Import Sales Invoice Preview
                    </h3>
                    <button type="button" onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '16px' }}>
                        <ImportSiSummaryCards summary={summary} activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>

                    {parsedData.isReupload && (
                        <div style={{ backgroundColor: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 'bold' }}>
                            ⚠️ {parsedData.warningMessage || 'This file has already been uploaded previously. Saving is disabled.'}
                        </div>
                    )}

                    <div style={{ backgroundColor: currentConfig.alertBg, color: currentConfig.alertColor, border: `1px solid ${currentConfig.alertBorder}`, padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                        <strong>{currentConfig.title}: </strong>{currentConfig.alertMessage}
                    </div>

                    <div>
                        {activeTab === 'valid' && <ImportSiValidDataTab validRows={validRows} />}
                        {activeTab === 'unallocated' && <ImportSiRawDataTab rawData={unallocatedRows} emptyMessage="No unallocated rows." showReason />}
                        {activeTab === 'duplicate' && <ImportSiRawDataTab rawData={duplicateRows} emptyMessage="No duplicate rows." showReason />}
                        {activeTab === 'non_interfaced' && <ImportSiRawDataTab rawData={nonInterfacedRows} emptyMessage="No non-interfaced rows." />}
                        {activeTab === 'unregistered' && <ImportSiRawDataTab rawData={unregisteredRows} emptyMessage="No unregistered SKU rows." showReason />}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#f8f9fa' }}>
                    <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
                    <button type="button" onClick={onConfirmImport} disabled={isSaveDisabled} style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: isSaveDisabled ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isSaveDisabled ? 0.6 : 1 }}>
                        {loading ? 'Saving Data...' : 'Save SI Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportSiModal;
