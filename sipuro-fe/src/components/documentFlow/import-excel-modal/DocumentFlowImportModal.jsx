import { useState } from 'react';
import DocumentFlowSummaryCards from './DocumentFlowSummaryCards';
import DocumentFlowDataTab from './DocumentFlowDataTab';
import DocumentFlowRowsToFix from './DocumentFlowRowsToFix';

const DocumentFlowImportModal = ({
    show,
    parsedData = null,
    loading = false,
    onConfirmImport,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState('new');

    if (!show || !parsedData) return null;

    // Direct destructuring from parsedData root without OR (||) fallback
    const {
        summary = {},
        previewResults: validData = [],
        duplicateRows = [],
        unregisteredRows = [],
        nonInterfacedRows = [],
        rowsToFix = [],
        warnings = []
    } = parsedData;

    const tabConfigs = {
        new: {
            title: 'Valid Data',
            alertBg: '#d1e7dd',
            alertColor: '#0f5132',
            alertBorder: '#badbcc',
            alertMessage: 'The rows below are valid and have been allocated to production batches (FIFO). They will be saved when you click Save.'
        },
        duplicate: {
            title: 'Duplicate Rows',
            alertBg: '#fff3cd',
            alertColor: '#664d03',
            alertBorder: '#ffecb5',
            alertMessage: 'The rows below have already been saved (same DO and item). They will be skipped.'
        },
        unregistered: {
            title: 'Unregistered SKU Rows',
            alertBg: '#f8d7da',
            alertColor: '#842029',
            alertBorder: '#f5c2c7',
            alertMessage: 'The rows below contain an SKU that is not registered, or a PO that is not found. They will not be saved and do not block saving the valid rows. The unmatched part of the PO is highlighted.'
        },
        nonInterfaced: {
            title: 'Non-Interfaced Status',
            alertBg: '#e2e3e5',
            alertColor: '#41464b',
            alertBorder: '#d3d6d8',
            alertMessage: 'The rows below do not have the Interfaced status. They are ignored and will not be saved.'
        }
    };

    const currentConfig = tabConfigs[activeTab] || tabConfigs.new;

    // Save hanya aktif jika ada minimal satu data yang bisa disimpan (canSave dari server), file belum pernah diupload, dan tidak sedang menyimpan
    const isSaveDisabled = loading || parsedData.isReupload || !parsedData.canSave || rowsToFix.length > 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
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
                        Upload Document Flow Preview
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
                        <DocumentFlowSummaryCards
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

                    <DocumentFlowRowsToFix rows={rowsToFix} />

                    {warnings.map((w, i) => (
                        <div key={i} style={{
                            backgroundColor: '#fff3cd',
                            color: '#664d03',
                            border: '1px solid #ffecb5',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            marginBottom: '16px',
                            fontSize: '13px'
                        }}>
                            ℹ️ {w.message}{Array.isArray(w.rows) && w.rows.length > 0 ? ` (Excel rows: ${w.rows.join(', ')})` : ''}
                        </div>
                    ))}

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
                            <DocumentFlowDataTab key="new" variant="valid" rawData={validData} />
                        )}
                        {activeTab === 'duplicate' && (
                            <DocumentFlowDataTab key="duplicate" variant="duplicate" rawData={duplicateRows} />
                        )}
                        {activeTab === 'unregistered' && (
                            <DocumentFlowDataTab key="unregistered" variant="unregistered" rawData={unregisteredRows} />
                        )}
                        {activeTab === 'nonInterfaced' && (
                            <DocumentFlowDataTab key="nonInterfaced" variant="nonInterfaced" rawData={nonInterfacedRows} />
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
                        {loading ? 'Saving Data...' : 'Save Valid Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentFlowImportModal;
