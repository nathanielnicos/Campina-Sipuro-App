import { useState, useEffect } from 'react';
import SummaryCards from './SummaryCards';
import ValidDataTab from './ValidDataTab';
import RawDataTab from './RawDataTab';
import UploadSkippedNotice from '../../upload/UploadSkippedNotice';

const ImportProductionLotModal = ({
    show,
    onClose,
    onConfirmImport,
    parsedData = null,
    loading = false
}) => {
    const [activeTab, setActiveTab] = useState('new');
    // Centang "sudah baca" untuk baris Data Changed; direset setiap ada hasil preview baru
    const [dataChangedAck, setDataChangedAck] = useState(false);

    useEffect(() => {
        setDataChangedAck(false);
    }, [parsedData]);

    if (!show || !parsedData) return null;

    // Direct destructuring from parsedData root without OR (||) fallback
    const {
        summary = {},
        previewResults: validData = [],
        unallocatedRows = [],
        duplicateRows = [],
        dataChangedRows = [],
        nonGoodRows = [],
        unregisteredRows = []
    } = parsedData;

    const tabConfigs = {
        new: {
            title: 'Valid Data (Allocated to PO)',
            alertBg: '#d1e7dd',
            alertColor: '#0f5132',
            alertBorder: '#badbcc',
            alertMessage: 'The data below is valid and allocated to matching POs, including POs of a mapped product code (marked "via mapping"). This data will be saved to the database when you click Save.'
        },
        unallocated: {
            title: 'Unallocated Data',
            alertBg: '#cff4fc',
            alertColor: '#055160',
            alertBorder: '#b6effb',
            alertMessage: 'The rows below did not produce a PO allocation (for example: missing batch, lot or production date, no matching open PO, exceeding PO capacity, net quantity of zero, a return with no allocation to reduce, or a decimal quantity for a registered product). See the Reason column and the Excel Row number to find the row in your file. These rows are displayed for information only and will not be saved.'
        },
        duplicate: {
            title: 'Duplicate Rows (Skipped)',
            alertBg: '#fff3cd',
            alertColor: '#664d03',
            alertBorder: '#ffecb5',
            alertMessage: 'The rows below are exact duplicates and will be skipped during processing.'
        },
        data_changed: {
            title: 'Duplicate Data Changed',
            alertBg: '#e2e3e5',
            alertColor: '#41464b',
            alertBorder: '#d3d6d8',
            alertMessage: 'The rows below match data that was imported before, but something has changed. Nothing is updated automatically. Rows with a changed lot status are NOT saved. Rows with a different expiry date ARE saved as new records, so their quantity is added again. Please check the Reason and Result columns and correct the existing data manually if needed (for example with Edit Quantity on the Production Lot page).'
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

    // Save hanya aktif jika ada minimal satu lot yang teralokasi (canSave dari server), file belum pernah diupload, dan tidak sedang menyimpan
    const hasDataChanged = dataChangedRows.length > 0;
    const isSaveDisabled = loading || parsedData.isReupload || !parsedData.canSave || (hasDataChanged && !dataChangedAck);

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
                        Import Production Lot Preview
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

                    {/* Peringatan wajib dibaca: ada baris yang cocok dengan data lama tetapi isinya berubah */}
                    {hasDataChanged && (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            color: '#664d03',
                            border: '1px solid #ffecb5',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            marginBottom: '16px',
                            fontSize: '13px'
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                                ⚠️ {dataChangedRows.length} row(s) match previously imported data but have changed.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                Changed lot status: not saved. Different expiry date: saved as a new record (quantity is added again).
                                Nothing is updated automatically. Review them in the{' '}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('data_changed')}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#0d6efd', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    Data Changed
                                </button>{' '}
                                tab.
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <input
                                    type="checkbox"
                                    checked={dataChangedAck}
                                    onChange={(e) => setDataChangedAck(e.target.checked)}
                                    disabled={loading}
                                />
                                I have read and noted these {dataChangedRows.length} row(s).
                            </label>
                        </div>
                    )}

                    <UploadSkippedNotice
                        skippedRowCount={parsedData.skippedRowCount}
                        skippedTransTypes={parsedData.skippedTransTypes}
                    />

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

                        {activeTab === 'data_changed' && (
                            <RawDataTab
                                rawData={dataChangedRows}
                                emptyMessage="No changed data found."
                                showChange
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

export default ImportProductionLotModal;
