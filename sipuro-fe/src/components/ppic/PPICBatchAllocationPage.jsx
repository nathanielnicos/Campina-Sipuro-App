import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchUnassignedSummary,
    assignBatchBulk,
    fetchBatchMapping,
    fetchBatchesBySku,
    fetchUnallocatedStocks
} from '../../services/ppicApi';
import {
    previewProductionApi,
    confirmProductionApi
} from '../../services/productionUploadApi';

import PendingSkuTable from './PendingSkuTable';
import BatchMappingTable from './BatchMappingTable';
import UnallocatedStockTable from './UnallocatedStockTable';
import ProductionPreviewModal from './ProductionPreviewModal';
import BatchAllocationModal from './BatchAllocationModal';

const PPICBatchAllocationPage = ({ currentUser }) => {
    const fileInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('summary');
    const [summaryList, setSummaryList] = useState([]);
    const [mappingList, setMappingList] = useState([]);
    const [unallocatedList, setUnallocatedList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State Filter Tab 1
    const [searchProduct1, setSearchProduct1] = useState('');
    const [searchPo1, setSearchPo1] = useState('');

    // State Filter Tab 2
    const [searchQuery2, setSearchQuery2] = useState('');
    const [fromDate2, setFromDate2] = useState('');
    const [toDate2, setToDate2] = useState('');
    const [batchStatus2, setBatchStatus2] = useState('');

    // State Filter Tab 3
    const [searchStock3, setSearchStock3] = useState('');
    const [prodDate3, setProdDate3] = useState('');

    // Pagination
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryLimit, setSummaryLimit] = useState(10);
    const [summaryPagination, setSummaryPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const [mappingPage, setMappingPage] = useState(1);
    const [mappingLimit, setMappingLimit] = useState(10);
    const [mappingPagination, setMappingPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const [unallocatedPage, setUnallocatedPage] = useState(1);
    const [unallocatedLimit, setUnallocatedLimit] = useState(10);
    const [unallocatedPagination, setUnallocatedPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // Modals
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
            const filters = { searchProduct: searchProduct1, searchPo: searchPo1 };
            const res = await fetchUnassignedSummary(summaryPage, summaryLimit, filters);
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
        } else if (activeTab === 'mapping') {
            const filters = { search: searchQuery2, fromDate: fromDate2, toDate: toDate2, batchStatus: batchStatus2 };
            const res = await fetchBatchMapping(mappingPage, mappingLimit, filters);
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
        } else if (activeTab === 'unallocated') {
            const filters = { search: searchStock3, prodDate: prodDate3 };
            const res = await fetchUnallocatedStocks(unallocatedPage, unallocatedLimit, filters);
            if (res && res.success) {
                setUnallocatedList(res.data || []);
                if (res.pagination) {
                    setUnallocatedPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Gagal mengambil data stok lebihan.');
            }
        }
        setLoading(false);
    }, [
        activeTab,
        summaryPage, summaryLimit, searchProduct1, searchPo1,
        mappingPage, mappingLimit, searchQuery2, fromDate2, toDate2, batchStatus2,
        unallocatedPage, unallocatedLimit, searchStock3, prodDate3
    ]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleResetTab1 = () => {
        setSearchProduct1('');
        setSearchPo1('');
        setSummaryPage(1);
    };

    const handleResetTab2 = () => {
        setSearchQuery2('');
        setFromDate2('');
        setToDate2('');
        setBatchStatus2('');
        setMappingPage(1);
    };

    const handleResetTab3 = () => {
        setSearchStock3('');
        setProdDate3('');
        setUnallocatedPage(1);
    };

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

    const handleFulfilledChange = (index, rawValue) => {
        if (!previewData || !previewData.previewResults) return;

        const updatedResults = [...previewData.previewResults];
        const numericValue = rawValue === '' ? 0 : Number(rawValue);

        updatedResults[index] = {
            ...updatedResults[index],
            fulfilledQty: numericValue
        };

        setPreviewData({
            ...previewData,
            previewResults: updatedResults
        });
    };

    const handleConfirmSave = async () => {
        const confirmMsg = previewData?.isReupload
            ? `${previewData.warningMessage}\nApakah Anda tetap ingin menyimpan ulang hasil alokasi produksi ini?`
            : 'Simpan hasil realisasi produksi ke database?';

        if (!window.confirm(confirmMsg)) return;

        setSaving(true);
        const payload = {
            processTimestamp: previewData.processTimestamp,
            fileName: previewData.fileName,
            userId: currentUser?.id || 1,
            allocations: previewData.detailedAllocations || [],
            unallocatedStocks: previewData.unallocatedStocks || []
        };

        const res = await confirmProductionApi(payload);
        setSaving(false);

        if (res && res.success) {
            alert(res.message || 'Berhasil disimpan!');
            handleResetUploadState();
            loadData();
        } else {
            alert('Gagal menyimpan: ' + (res?.message || 'Terjadi kesalahan.'));
        }
    };

    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        setUploadFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRejectPreview = () => {
        handleResetUploadState();
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
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #dee2e6',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={() => setActiveTab('summary')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'summary' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'summary' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Belum Ada Batch
                    </button>
                    <button
                        onClick={() => setActiveTab('mapping')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'mapping' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'mapping' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Daftar Batch
                    </button>
                    <button
                        onClick={() => setActiveTab('unallocated')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'unallocated' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'unallocated' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Kelebihan Produksi
                    </button>
                </div>

                <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '6px' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setUploadFile(e.target.files[0] || null)}
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

            {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

            <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 10,
                        fontSize: '12px',
                        color: '#0d6efd',
                        fontWeight: 'bold',
                        zIndex: 10
                    }}>
                        Memuat data...
                    </div>
                )}

                {activeTab === 'summary' && (
                    <PendingSkuTable
                        summaryList={summaryList}
                        onOpenModal={handleOpenModal}
                        pagination={summaryPagination}
                        onPageChange={(newPage) => setSummaryPage(newPage)}
                        onLimitChange={(newLimit) => {
                            setSummaryLimit(newLimit);
                            setSummaryPage(1);
                        }}
                        searchProduct={searchProduct1}
                        setSearchProduct={(val) => { setSearchProduct1(val); setSummaryPage(1); }}
                        searchPo={searchPo1}
                        setSearchPo={(val) => { setSearchPo1(val); setSummaryPage(1); }}
                        onResetFilters={handleResetTab1}
                    />
                )}

                {activeTab === 'mapping' && (
                    <BatchMappingTable
                        mappingList={mappingList}
                        pagination={mappingPagination}
                        onPageChange={(newPage) => setMappingPage(newPage)}
                        onLimitChange={(newLimit) => {
                            setMappingLimit(newLimit);
                            setMappingPage(1);
                        }}
                        searchQuery={searchQuery2}
                        setSearchQuery={(val) => { setSearchQuery2(val); setMappingPage(1); }}
                        fromDate={fromDate2}
                        setFromDate={(val) => { setFromDate2(val); setMappingPage(1); }}
                        toDate={toDate2}
                        setToDate={(val) => { setToDate2(val); setMappingPage(1); }}
                        batchStatus={batchStatus2}
                        setBatchStatus={(val) => { setBatchStatus2(val); setMappingPage(1); }}
                        onResetFilters={handleResetTab2}
                    />
                )}

                {activeTab === 'unallocated' && (
                    <UnallocatedStockTable
                        unallocatedList={unallocatedList}
                        pagination={unallocatedPagination}
                        onPageChange={(newPage) => setUnallocatedPage(newPage)}
                        onLimitChange={(newLimit) => {
                            setUnallocatedLimit(newLimit);
                            setUnallocatedPage(1);
                        }}
                        onRefresh={loadData}
                        searchStock={searchStock3}
                        setSearchStock={(val) => setSearchStock3(val)}
                        prodDate={prodDate3}
                        setProdDate={(val) => setProdDate3(val)}
                        onResetFilters={handleResetTab3}
                    />
                )}
            </div>

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
