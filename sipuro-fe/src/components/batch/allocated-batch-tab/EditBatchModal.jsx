import { useState, useEffect } from 'react';

export const EditBatchModal = ({ isOpen, onClose, batchData, onSubmit, loading }) => {
    const [newBatchNumber, setNewBatchNumber] = useState('');

    useEffect(() => {
        if (batchData) {
            setNewBatchNumber(batchData.batch_number || '');
        }
    }, [batchData]);

    if (!isOpen || !batchData) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(batchData.id_batch, newBatchNumber);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '450px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#212529' }}>
                    Rename Batch Number
                </h3>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '4px' }}>
                            Product
                        </label>
                        <input
                            type="text"
                            value={batchData.product_name ? `${batchData.product_code || ''} - ${batchData.product_name}` : '-'}
                            disabled
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                backgroundColor: '#e9ecef',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#212529', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                            New Batch Number <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={newBatchNumber}
                            onChange={(e) => setNewBatchNumber(e.target.value)}
                            placeholder="Enter new batch number"
                            required
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            style={{
                                padding: '8px 16px',
                                border: '1px solid #6c757d',
                                backgroundColor: '#fff',
                                color: '#6c757d',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: loading ? 0.65 : 1
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !newBatchNumber.trim()}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                backgroundColor: loading || !newBatchNumber.trim() ? '#6c757d' : '#0d6efd',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: loading || !newBatchNumber.trim() ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: loading || !newBatchNumber.trim() ? 0.65 : 1
                            }}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditBatchModal;
