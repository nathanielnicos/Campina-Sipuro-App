import { useEffect, useState } from 'react';
import SummaryCards from './SummaryCards';
import ValidDataTab from './ValidDataTab';
import RawDataTab from './RawDataTab';

const tabConfigs = {
    non_good: {
        borderColor: '#fecba1',
        bgColor: '#fff4eb',
        textColor: '#a73a00',
        headerBg: '#ffe5d0',
        highlightStatus: true,
        infoMessage: <>ℹ️ The following rows have a Lot Status <strong>other than GOOD</strong> and <strong>will be skipped</strong> during saving.</>,
        emptyMessage: 'No rows with non-GOOD status found.'
    },
    duplicate: {
        borderColor: '#ffeeba',
        bgColor: '#fff8e6',
        textColor: '#856404',
        headerBg: '#fff3cd',
        highlightStatus: false,
        infoMessage: <>ℹ️ The following rows have been uploaded previously and <strong>will be skipped</strong> during saving.</>,
        emptyMessage: 'No duplicate data found.'
    },
    unregistered: {
        borderColor: '#f5c2c7',
        bgColor: '#fdf2f2',
        textColor: '#842029',
        headerBg: '#f8d7da',
        highlightStatus: false,
        infoMessage: <>⚠️ The following Batch / Item Codes were not found in the database and <strong>will be skipped</strong> during saving.</>,
        emptyMessage: 'No unregistered data found.'
    }
};

const ImportExcelModal = ({
    isOpen,
    previewData,
    saving,
    onConfirmSave,
    onRejectPreview
}) => {
    const [activeTab, setActiveTab] = useState('new');

    useEffect(() => {
        setActiveTab('new');
    }, [previewData]);

    if (!isOpen || !previewData) return null;

    const summary = previewData.summary || {
        totalRows: 0,
        newCount: 0,
        duplicateCount: 0,
        unregisteredCount: 0,
        nonGoodCount: 0
    };

    const categorizedDetails = previewData.categorizedDetails || {
        newRows: [],
        duplicateRows: [],
        unregisteredRows: [],
        nonGoodRows: []
    };

    const canSave = summary.newCount > 0 && !previewData.isReupload;

    const handleSaveClick = () => {
        onConfirmSave({
            newDetails: categorizedDetails.newRows || []
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '95%', maxWidth: '1350px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box'
            }}>
                {/* Header Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        Production Output Preview (Unsaved)
                    </h3>
                </div>

                {/* Re-upload Warning Alert */}
                {previewData.isReupload && (
                    <div style={{ padding: '10px 12px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>
                        ⚠️ <strong>Re-upload Warning:</strong> {previewData.warningMessage}
                    </div>
                )}

                {/* Metadata & Interactive Summary Cards */}
                <div style={{ fontSize: '13px', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e9ecef', marginBottom: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <strong>File Name:</strong> {previewData.fileName} | <strong>Processed Time:</strong> {previewData.processTimestamp} | <strong>Total Rows:</strong> {summary.totalRows}
                    </div>

                    <SummaryCards
                        summary={summary}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>
                    {activeTab === 'new' && (
                        <ValidDataTab
                            previewResults={previewData.previewResults || []}
                            unallocatedStocks={previewData.unallocatedStocks || []}
                        />
                    )}

                    {activeTab === 'non_good' && (
                        <RawDataTab
                            rows={categorizedDetails.nonGoodRows || []}
                            config={tabConfigs.non_good}
                        />
                    )}

                    {activeTab === 'duplicate' && (
                        <RawDataTab
                            rows={categorizedDetails.duplicateRows || []}
                            config={tabConfigs.duplicate}
                        />
                    )}

                    {activeTab === 'unregistered' && (
                        <RawDataTab
                            rows={categorizedDetails.unregisteredRows || []}
                            config={tabConfigs.unregistered}
                        />
                    )}
                </div>

                {/* Footer Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <button
                        type="button"
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        Close
                    </button>

                    {canSave && (
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={saving}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#198754',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease-in-out'
                            }}
                        >
                            {saving ? 'Saving...' : `Save to Database (${summary.newCount} Valid Rows)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportExcelModal;
