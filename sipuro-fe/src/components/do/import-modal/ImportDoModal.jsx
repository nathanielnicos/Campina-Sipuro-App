import React, { useState } from 'react';
import ImportDoSummaryCards from './ImportDoSummaryCards';
import ImportDoValidDataTab from './ImportDoValidDataTab';
import ImportDoRawDataTab from './ImportDoRawDataTab';

const ImportDoModal = ({
    show,
    onClose,
    onConfirmImport,
    parsedData = null,
    loading = false
}) => {
    const [activeTab, setActiveTab] = useState('new');

    if (!show || !parsedData) return null;

    // Menyesuaikan dengan response backend DO
    const {
        summary = {},
        allocatedDoGroups = [],
        categorizedDetails = {}
    } = parsedData;

    const unallocatedRows = categorizedDetails.unallocatedRows || [];
    const duplicateRows = categorizedDetails.duplicateRows || [];
    const nonGoodRows = categorizedDetails.nonGoodRows || [];
    const unregisteredRows = categorizedDetails.unregisteredRows || [];

    const tabConfigs = {
        new: {
            title: 'Valid DO Data (Allocated to PO)',
            alertBg: '#d1e7dd',
            alertColor: '#0f5132',
            alertBorder: '#badbcc',
            alertMessage: 'The DO items below are valid and successfully mapped to open PO lot allocations. Click Save to commit.'
        },
        unallocated: {
            title: 'Unallocated DO Items',
            alertBg: '#cff4fc',
            alertColor: '#055160',
            alertBorder: '#b6effb',
            alertMessage: 'The items below could not be allocated (for example: insufficient PO lot allocation quantity or missing lot). These will not be saved.'
        },
        duplicate: {
            title: 'Duplicate Rows (Skipped)',
            alertBg: '#fff3cd',
            alertColor: '#664d03',
            alertBorder: '#ffecb5',
            alertMessage: 'The rows below are exact duplicates and will be skipped.'
        },
        non_good: {
            title: 'Non-GOOD Status Rows',
            alertBg: '#ffe5d0',
            alertColor: '#853e00',
            alertBorder: '#ffd0a8',
            alertMessage: 'These rows have Non-GOOD status and are skipped from processing.'
        },
        unregistered: {
            title: 'Unregistered SKU Rows',
            alertBg: '#f8d7da',
            alertColor: '#842029',
            alertBorder: '#f5c2c7',
            alertMessage: 'These items are not registered in master products.'
        }
    };

    const currentConfig = tabConfigs[activeTab] || tabConfigs.new;
    const isSaveDisabled = loading || parsedData.isReupload || !parsedData.canSave;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '1100px',
                maxWidth: '95%',
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: 'bold' }}>
                        Import Delivery Order Preview
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666', lineHeight: 1 }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '16px' }}>
                        <ImportDoSummaryCards
                            summary={summary}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    </div>

                    {parsedData.isReupload && (
                        <div style={{
                            backgroundColor: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7',
                            padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 'bold'
                        }}>
                            ⚠️ {parsedData.warningMessage || 'This file has already been uploaded previously. Saving is disabled.'}
                        </div>
                    )}

                    <div style={{
                        backgroundColor: currentConfig.alertBg, color: currentConfig.alertColor,
                        border: `1px solid ${currentConfig.alertBorder}`, padding: '10px 14px',
                        borderRadius: '6px', marginBottom: '16px', fontSize: '13px'
                    }}>
                        <strong>{currentConfig.title}: </strong>{currentConfig.alertMessage}
                    </div>

                    {/* Tab Contents */}
                    <div>
                        {activeTab === 'new' && (
                            <ImportDoValidDataTab allocatedDoGroups={allocatedDoGroups} />
                        )}
                        {activeTab === 'unallocated' && (
                            <ImportDoRawDataTab rawData={unallocatedRows} emptyMessage="No unallocated items found." showReason />
                        )}
                        {activeTab === 'duplicate' && (
                            <ImportDoRawDataTab rawData={duplicateRows} emptyMessage="No duplicate rows found." />
                        )}
                        {activeTab === 'non_good' && (
                            <ImportDoRawDataTab rawData={nonGoodRows} emptyMessage="No Non-GOOD status rows found." />
                        )}
                        {activeTab === 'unregistered' && (
                            <ImportDoRawDataTab rawData={unregisteredRows} emptyMessage="No unregistered SKU rows found." />
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid #dee2e6',
                    display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#f8f9fa'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmImport}
                        disabled={isSaveDisabled}
                        style={{
                            padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none',
                            borderRadius: '4px', cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                            opacity: isSaveDisabled ? 0.6 : 1, fontWeight: 'bold', fontSize: '14px'
                        }}
                    >
                        {loading ? 'Saving Data...' : 'Save DO Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportDoModal;
