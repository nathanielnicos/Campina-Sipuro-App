import { useState } from 'react';
import SummaryCards from './SummaryCards';
import ValidDataTab from './ValidDataTab';
import RawDataTab from './RawDataTab';

const ImportExcelModal = ({
    show,
    onClose,
    onConfirmImport,
    parsedData = null,
    loading = false
}) => {
    const [activeTab, setActiveTab] = useState('new');

    if (!show || !parsedData) return null;

    // Direct destructuring from parsedData root without OR (||) fallback
    const {
        summary = {},
        previewResults: validData = [],
        unallocatedRows = [],
        duplicateRows = [],
        duplicateStatusUpdateRows = [],
        nonGoodRows = [],
        unregisteredRows = []
    } = parsedData;

    const tabConfigs = {
        new: {
            title: 'Valid Data (Allocated to PO)',
            alertBg: '#d1e7dd',
            alertColor: '#0f5132',
            alertBorder: '#badbcc',
            alertMessage: 'The data below is valid and successfully allocated to matching POs. This data will be saved to the database when you click Save.'
        },
        unallocated: {
            title: 'Unallocated Data',
            alertBg: '#cff4fc',
            alertColor: '#055160',
            alertBorder: '#b6effb',
            alertMessage: 'The rows below did not produce a PO allocation (for example: exceeding PO capacity, no matching open PO, net quantity of zero, or missing production date). See the Reason column. These rows are displayed for information only and will not be saved.'
        },
        duplicate: {
            title: 'Duplicate Rows (Skipped)',
            alertBg: '#fff3cd',
            alertColor: '#664d03',
            alertBorder: '#ffecb5',
            alertMessage: 'The rows below are exact duplicates and will be skipped during processing.'
        },
        duplicate_status_update: {
            title: 'Duplicate Status Update Only',
            alertBg: '#e2e3e5',
            alertColor: '#41464b',
            alertBorder: '#d3d6d8',
            alertMessage: 'The rows below were previously imported but now have a different lot status. They are displayed for information only and are not processed. Use the recall feature to adjust allocations.'
        },
        non_good: {
            title: 'Non-GOOD Status Rows',
            alertBg: '#ffe5d0',
            alertColor: '#853e00',
            alertBorder: '#ffd0a8',
            alertMessage: 'The rows below have a Non-GOOD quality status and require special attention or will be skipped.'
        },
        unregistered: {
            title: 'Unregistered SKU Rows',
            alertBg: '#f8d7da',
            alertColor: '#842029',
            alertBorder: '#f5c2c7',
            alertMessage: 'The rows below contain SKU codes that are not registered in the master data. Please register the SKUs first.'
        }
    };

    const currentConfig = tabConfigs[activeTab] || tabConfigs.new;

    // Save hanya aktif jika ada minimal satu batch yang teralokasi (canSave dari server), file belum pernah diupload, dan tidak sedang menyimpan
    const isSaveDisabled = loading || parsedData.isReupload || !parsedData.canSave;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '1100px',
                maxWidth: '95%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: 'bold' }}>
                        Excel Import Preview
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            color: '#666',
                            lineHeight: 1
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{
                    padding: '20px 24px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    <div style={{ marginBottom: '16px' }}>
                        <SummaryCards
                            summary={summary}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    </div>

                    {/* Warning Banner Khusus Jika File Sudah Pernah Di-upload */}
                    {parsedData.isReupload && (
                        <div style={{
                            backgroundColor: '#f8d7da',
                            color: '#842029',
                            border: '1px solid #f5c2c7',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            marginBottom: '16px',
                            fontSize: '13px',
                            fontWeight: 'bold'
                        }}>
                            ⚠️ {parsedData.warningMessage || 'This file has already been uploaded previously. Saving is disabled.'}
                        </div>
                    )}

                    <div style={{
                        backgroundColor: currentConfig.alertBg,
                        color: currentConfig.alertColor,
                        border: `1px solid ${currentConfig.alertBorder}`,
                        padding: '10px 14px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '13px'
                    }}>
                        <strong>{currentConfig.title}: </strong>{currentConfig.alertMessage}
                    </div>

                    {/* Tab Content */}
                    <div>
                        {activeTab === 'new' && (
                            <ValidDataTab previewResults={validData} />
                        )}

                        {activeTab === 'unallocated' && (
                            <RawDataTab
                                rawData={unallocatedRows}
                                emptyMessage="No unallocated items found."
                                showReason
                            />
                        )}

                        {activeTab === 'duplicate' && (
                            <RawDataTab
                                rawData={duplicateRows}
                                emptyMessage="No duplicate rows found."
                            />
                        )}

                        {activeTab === 'duplicate_status_update' && (
                            <RawDataTab
                                rawData={duplicateStatusUpdateRows}
                                emptyMessage="No status update duplicates found."
                            />
                        )}

                        {activeTab === 'non_good' && (
                            <RawDataTab
                                rawData={nonGoodRows}
                                emptyMessage="No Non-GOOD status rows found."
                            />
                        )}

                        {activeTab === 'unregistered' && (
                            <RawDataTab
                                rawData={unregisteredRows}
                                emptyMessage="No unregistered SKU rows found."
                            />
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            backgroundColor: '#fff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            fontSize: '14px'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmImport}
                        disabled={isSaveDisabled}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                            opacity: isSaveDisabled ? 0.6 : 1,
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        {loading ? 'Saving Data...' : 'Save Import Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportExcelModal;
