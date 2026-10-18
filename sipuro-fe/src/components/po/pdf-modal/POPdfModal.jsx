import { usePOPdfModal } from '../../../hooks/po/pdf-modal/usePOPdfModal';
import POPdfDocument from './POPdfDocument';
import Button from '../../common/Button';

const POPdfModal = ({ poId, onClose }) => {
    const {
        poData,
        seller,
        loading,
        downloading,
        pdfContentRef,
        ppnPercentNum,
        handleDownloadPdf
    } = usePOPdfModal(poId);

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
                        type="button"
                        onClick={onClose}
                        disabled={loading || downloading}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            fontSize: '20px',
                            cursor: loading || downloading ? 'not-allowed' : 'pointer',
                            opacity: loading || downloading ? 0.6 : 1,
                            color: '#6c757d'
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body Modal */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f1f3f5' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', padding: '20px' }}>Loading document...</p>
                    ) : poData ? (
                        <POPdfDocument
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
                    <Button
                        variant="outlineSecondary"
                        size="sm"
                        onClick={onClose}
                        disabled={loading || downloading}
                    >
                        Close
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDownloadPdf}
                        disabled={loading || downloading || !poData}
                    >
                        {downloading ? 'Generating...' : 'Download PDF'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default POPdfModal;
