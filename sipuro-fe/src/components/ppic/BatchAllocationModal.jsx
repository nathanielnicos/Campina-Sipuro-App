import React from 'react';
import { formatQty } from '../../utils/formatters';

const BatchAllocationModal = ({
    isOpen,
    selectedSku,
    allocatedQty,
    setAllocatedQty,
    allocationMode,
    setAllocationMode,
    existingBatches,
    selectedBatchId,
    batchCode,
    setBatchCode,
    productionDate,
    setProductionDate,
    expiredDate,
    setExpiredDate,
    submitting,
    onSelectBatchExisting,
    onSubmit,
    onClose
}) => {
    if (!isOpen || !selectedSku) return null;

    const handleQtyChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (rawValue === '') {
            setAllocatedQty('');
            return;
        }

        let numericVal = Number(rawValue);
        const maxVal = Number(selectedSku.total_qty_needed) || 0;

        if (maxVal > 0 && numericVal > maxVal) {
            numericVal = maxVal;
        }

        setAllocatedQty(String(numericVal));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();

        // Konfirmasi Simpan Alokasi
        if (!window.confirm('Apakah Anda yakin ingin menyimpan alokasi batch ini?')) {
            return;
        }

        const cleanQty = String(allocatedQty).replace(/\D/g, '');
        onSubmit(e, cleanQty);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '480px' }}>
                <h3 style={{ marginTop: 0 }}>Alokasi Batch untuk SKU:</h3>
                <p style={{ margin: '4px 0 12px 0', color: '#333', fontWeight: 'bold' }}>
                    {selectedSku.product_code} - {selectedSku.product_name}
                </p>

                <div style={{ backgroundColor: '#e9ecef', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
                    Sisa Kebutuhan: <strong>{formatQty(selectedSku.total_qty_needed)} {selectedSku.base_uom}</strong> ({formatQty(selectedSku.total_po_count)} PO)
                </div>

                <form onSubmit={handleFormSubmit}>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Qty Alokasi Batch *</label>
                        <input
                            type="text"
                            value={allocatedQty ? formatQty(allocatedQty) : ''}
                            onChange={handleQtyChange}
                            placeholder="0"
                            required
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Pilih Opsi Batch *</label>
                        <select
                            value={allocationMode}
                            onChange={(e) => setAllocationMode(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        >
                            <option value="">-- Pilih --</option>
                            <option value="NEW">Buat Batch Baru</option>
                            <option value="EXISTING">Pilih Batch yang Sudah Ada</option>
                        </select>
                    </div>

                    {allocationMode === 'EXISTING' && (
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Nomor Batch Eksisting *</label>
                            {existingBatches.length === 0 ? (
                                <p style={{ color: 'red', fontSize: '12px', margin: 0 }}>Tidak ada batch 'Open' untuk SKU ini.</p>
                            ) : (
                                <select
                                    value={selectedBatchId}
                                    onChange={onSelectBatchExisting}
                                    required
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                >
                                    <option value="">-- Pilih Batch --</option>
                                    {existingBatches.map(b => (
                                        <option key={b.id_batch} value={b.id_batch}>
                                            {b.batch_number} (Tgl: {b.plan_production_date ? b.plan_production_date.split('T')[0] : '-'})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {allocationMode !== '' && (
                        <>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Nomor Batch *</label>
                                <input
                                    type="text"
                                    value={batchCode}
                                    onChange={(e) => setBatchCode(e.target.value)}
                                    disabled={allocationMode === 'EXISTING'}
                                    required
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Tanggal Rencana Produksi *</label>
                                <input
                                    type="date"
                                    value={productionDate}
                                    onChange={(e) => setProductionDate(e.target.value)}
                                    disabled={allocationMode === 'EXISTING'}
                                    required
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Tanggal Kadaluarsa</label>
                                <input
                                    type="date"
                                    value={expiredDate}
                                    onChange={(e) => setExpiredDate(e.target.value)}
                                    disabled={allocationMode === 'EXISTING'}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}>
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || (allocationMode === 'EXISTING' && existingBatches.length === 0)}
                            style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            {submitting ? 'Menyimpan...' : 'Simpan Alokasi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BatchAllocationModal;
