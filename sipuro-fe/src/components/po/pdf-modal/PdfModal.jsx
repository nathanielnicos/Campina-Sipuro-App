import { usePdfModal } from '../../../hooks/po/pdf-modal/usePdfModal';
import PdfDocument from './PdfDocument';

const PdfModal = ({ poId, onClose }) => {
    const {
        poData,
        seller,
        loading,
        pdfContentRef,
        ppnPercentNum,
        handleDownloadPdf
    } = usePdfModal(poId);

    if (!poId) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                width: '850px',
                maxWidth: '92%',
                maxHeight: '88vh',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                overflow: 'hidden'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa'
                }}>
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>PO Document Preview</h5>
                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#6c757d' }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body Modal */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f1f3f5' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', padding: '20px' }}>Loading document...</p>
                    ) : poData ? (
                        <PdfDocument
                            ref={pdfContentRef}
                            poData={poData}
                            seller={seller}
                            ppnPercentNum={ppnPercentNum}
                        />
                    ) : (
                        <p style={{ textAlign: 'center', color: '#dc3545', padding: '20px' }}>Failed to load PO data.</p>
                    )}
                </div>

                {/* Footer Modal Actions */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '4px',
                            border: '1px solid #6c757d',
                            backgroundColor: '#ffffff',
                            color: '#6c757d',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Close
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={loading || !poData}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#dc3545',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            cursor: loading || !poData ? 'not-allowed' : 'pointer',
                            opacity: loading || !poData ? 0.6 : 1,
                            fontSize: '13px'
                        }}
                    >
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PdfModal;
