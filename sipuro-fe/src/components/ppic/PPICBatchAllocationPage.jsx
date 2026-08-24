import React, { useState, useEffect, useCallback } from 'react';
import {
    fetchUnassignedSummary,
    assignBatchBulk,
    fetchBatchMapping,
    fetchBatchesBySku,
    previewProductionApi,
    confirmProductionApi
} from '../../services/ppicApi';

import PendingSkuTable from './PendingSkuTable';
import BatchMappingTable from './BatchMappingTable';
import ProductionPreviewModal from './ProductionPreviewModal';
import BatchAllocationModal from './BatchAllocationModal';

const PPICBatchAllocationPage = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState('summary');
    const [summaryList, setSummaryList] = useState([]);
    const [mappingList, setMappingList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State Pagination Tab 1 (Summary / Pending SKU)
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryLimit, setSummaryLimit] = useState(10);
    const [summaryPagination, setSummaryPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
    });

    // State Pagination Tab 2 (Batch Mapping)
    const [mappingPage, setMappingPage] = useState(1);
    const [mappingLimit, setMappingLimit] = useState(10);
    const [mappingPagination, setMappingPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
    });

    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [selectedSku, setSelectedSku] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allocationMode, setAllocationMode] = useState('');
    const [existingBatches, setExistingBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');

    const [allocatedQty, setAllocatedQty] = useState('');
    const [batchCode, setBatchCode] = useState('');
    const [productionDate, setProductionDate] = useState('');
    const [expiredDate, setExpiredDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        if (activeTab === 'summary') {
            const res = await fetchUnassignedSummary(summaryPage, summaryLimit);
            if (res && res.success) {
                setSummaryList(res.data || []);
                if (res.pagination) {
                    setSummaryPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Gagal mengambil data rekap kebutuhan batch.');
            }
        } else {
            const res = await fetchBatchMapping(mappingPage, mappingLimit);
            if (res && res.success) {
                setMappingList(res.data || []);
                if (res.pagination) {
                    setMappingPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Gagal mengambil riwayat mapping batch.');
            }
        }
        setLoading(false);
    }, [activeTab, summaryPage, summaryLimit, mappingPage, mappingLimit]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) return alert('Silakan pilih file Excel terlebih dahulu!');

        const formData = new FormData();
        formData.append('file', uploadFile);

        setUploading(true);
        const res = await previewProductionApi(formData);
        setUploading(false);

        if (res && res.success) {
            setPreviewData(res.data);
            setIsPreviewOpen(true);
        } else {
            alert('Upload Gagal: ' + (res?.message || 'Gagal memproses file.'));
        }
    };

    const handleFulfilledChange = (idx, newVal) => {
        const updated = [...previewData.previewResults];
        const parsedQty = Number(newVal) || 0;
        updated[idx].fulfilledQty = parsedQty;
        updated[idx].rowStatus = parsedQty >= updated[idx].allocatedQty ? 'Close' : 'Open';

        setPreviewData({
            ...previewData,
            previewResults: updated
        });
    };

    const handleConfirmSave = async () => {
        if (!window.confirm('Simpan hasil realisasi produksi ke database?')) return;

        setSaving(true);
        const payload = {
            processTimestamp: previewData.processTimestamp,
            fileName: previewData.fileName,
            userId: currentUser?.id || 1,
            allocations: previewData.previewResults,
            unallocatedStocks: previewData.unallocatedStocks
        };

        const res = await confirmProductionApi(payload);
        setSaving(false);

        if (res && res.success) {
            alert(res.message || 'Berhasil disimpan!');
            setIsPreviewOpen(false);
            setPreviewData(null);
            setUploadFile(null);
            loadData();
        } else {
            alert('Gagal menyimpan: ' + (res?.message || 'Terjadi kesalahan.'));
        }
    };

    const handleRejectPreview = () => {
        if (window.confirm('Batalkan proses upload? Data tidak akan disimpan ke database.')) {
            setIsPreviewOpen(false);
            setPreviewData(null);
            setUploadFile(null);
        }
    };

    const handleOpenModal = async (sku) => {
        setSelectedSku(sku);
        setAllocatedQty(sku.total_qty_needed);
        setAllocationMode('');
        setSelectedBatchId('');
        setBatchCode('');
        setProductionDate(new Date().toISOString().split('T')[0]);
        setExpiredDate('');

        const res = await fetchBatchesBySku(sku.id_product);
        if (res && res.success) {
            setExistingBatches(res.data || []);
        } else {
            setExistingBatches([]);
        }

        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSku(null);
    };

    const handleSelectBatchExisting = (e) => {
        const batchId = e.target.value;
        setSelectedBatchId(batchId);
        const found = existingBatches.find(b => String(b.id_batch) === String(batchId));
        if (found) {
            setBatchCode(found.batch_number);
            setProductionDate(found.plan_production_date ? found.plan_production_date.split('T')[0] : '');
            setExpiredDate(found.expired_date ? found.expired_date.split('T')[0] : '');
        } else {
            setBatchCode('');
            setProductionDate('');
            setExpiredDate('');
        }
    };

    const handleSubmitBatch = async (e) => {
        e.preventDefault();

        if (!allocationMode) return alert('Silakan pilih opsi alokasi!');

        const inputQty = Number(allocatedQty);
        if (!inputQty || inputQty <= 0) return alert('Qty alokasi harus lebih besar dari 0!');
        if (inputQty > selectedSku.total_qty_needed) return alert(`Qty input (${inputQty}) melebihi total sisa kebutuhan (${selectedSku.total_qty_needed})!`);

        if (allocationMode === 'NEW' && (!batchCode || !productionDate)) return alert('Nomor Batch dan Tanggal Produksi wajib diisi!');
        if (allocationMode === 'EXISTING' && !selectedBatchId) return alert('Silakan pilih batch eksisting!');

        const payload = {
            id_product: selectedSku.id_product,
            allocation_mode: allocationMode,
            selected_batch_id: selectedBatchId || null,
            batch_number: batchCode,
            plan_production_date: productionDate,
            expired_date: expiredDate || null,
            allocated_qty: inputQty,
            created_by: currentUser?.username || 'PPIC User'
        };

        setSubmitting(true);
        const res = await assignBatchBulk(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            loadData();
        } else {
            alert('Gagal: ' + (res?.message || 'Terjadi kesalahan saat mengalokasikan batch.'));
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>Alokasi Batch Produksi</h2>
                    <p style={{ color: '#666', margin: '4px 0 0 0' }}>Kelola kebutuhan alokasi batch dan upload realisasi hasil produksi.</p>
                </div>

                <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd' }}>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        style={{ fontSize: '12px' }}
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{ padding: '6px 12px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {uploading ? 'Membaca Excel...' : 'Upload Produksi'}
                    </button>
                </form>
            </div>

            <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('summary')}
                    style={{
                        padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold',
                        borderBottom: activeTab === 'summary' ? '3px solid #0d6efd' : 'none',
                        color: activeTab === 'summary' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    Kebutuhan Alokasi (Pending SKU)
                </button>
                <button
                    onClick={() => setActiveTab('mapping')}
                    style={{
                        padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold',
                        borderBottom: activeTab === 'mapping' ? '3px solid #0d6efd' : 'none',
                        color: activeTab === 'mapping' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    Monitoring Batch & Mapping PO
                </button>
            </div>

            {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

            {loading ? (
                <p>Memuat data...</p>
            ) : activeTab === 'summary' ? (
                <PendingSkuTable
                    summaryList={summaryList}
                    onOpenModal={handleOpenModal}
                    pagination={summaryPagination}
                    onPageChange={(newPage) => setSummaryPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setSummaryLimit(newLimit);
                        setSummaryPage(1);
                    }}
                />
            ) : (
                <BatchMappingTable
                    mappingList={mappingList}
                    pagination={mappingPagination}
                    onPageChange={(newPage) => setMappingPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setMappingLimit(newLimit);
                        setMappingPage(1);
                    }}
                />
            )}

            <ProductionPreviewModal
                isOpen={isPreviewOpen}
                previewData={previewData}
                saving={saving}
                onFulfilledChange={handleFulfilledChange}
                onConfirmSave={handleConfirmSave}
                onRejectPreview={handleRejectPreview}
            />

            <BatchAllocationModal
                isOpen={isModalOpen}
                selectedSku={selectedSku}
                allocatedQty={allocatedQty}
                setAllocatedQty={setAllocatedQty}
                allocationMode={allocationMode}
                setAllocationMode={setAllocationMode}
                existingBatches={existingBatches}
                selectedBatchId={selectedBatchId}
                batchCode={batchCode}
                setBatchCode={setBatchCode}
                productionDate={productionDate}
                setProductionDate={setProductionDate}
                expiredDate={expiredDate}
                setExpiredDate={setExpiredDate}
                submitting={submitting}
                onSelectBatchExisting={handleSelectBatchExisting}
                onSubmit={handleSubmitBatch}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default PPICBatchAllocationPage;
