import { useState } from 'react';
import POFilterBar from './POFilterBar';
import POTable from './POTable';
import POPdfModal from '../pdf-modal/POPdfModal';
import PODModal from '../detail-modal/PODModal';
import { useGlobalModal } from '../../../context/ModalContext';
import useDebounce from '../../../hooks/useDebounce';

// Import Hooks
import { usePOFilterBar } from '../../../hooks/po/page/usePOFilterBar';
import { usePOTable } from '../../../hooks/po/page/usePOTable';
import { usePOExportExcel } from '../../../hooks/po/page/usePOExportExcel';

// refreshSignal: angka dari induk (App). Jika nilainya berubah, daftar PO dimuat ulang
// tanpa memasang ulang halaman, sehingga filter dan halaman aktif tidak hilang.
const POPage = ({ customerId = 1, user, refreshSignal = 0 }) => {
    const [selectedPdfPoId, setSelectedPdfPoId] = useState(null);

    // Modal detail / buat PO dikelola di halaman ini
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPoId, setSelectedPoId] = useState(null);
    const [localRefresh, setLocalRefresh] = useState(0);

    const { showAlert } = useGlobalModal();

    // 1. Hook Filter
    const {
        search,
        startDate,
        endDate,
        status,
        sortConfig,
        currentPage,
        setCurrentPage,
        isFilterActive,
        handleSort,
        handleSearchChange,
        handleStartDateChange,
        handleEndDateChange,
        handleStatusChange,
        handleResetFilters
    } = usePOFilterBar();

    // Pencarian ke server ditunda 400 ms setelah pengguna berhenti mengetik (kotak input tetap langsung responsif)
    const debouncedSearch = useDebounce(search, 400);

    // 2. Hook Fetch List Data
    const {
        poList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange
    } = usePOTable({
        customerId,
        currentPage,
        setCurrentPage,
        search: debouncedSearch,
        startDate,
        endDate,
        status,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        refreshSignal: refreshSignal + localRefresh
    });

    // 3. Hook Export Excel
    const { exporting, handleExportExcel } = usePOExportExcel({
        customerId,
        filters: { 
            search: debouncedSearch, 
            startDate, 
            endDate, 
            status 
        }
    });

    const handleOpenCreate = () => {
        if (user && user.role !== 'CUSTOMER') {
            showAlert({
                type: 'warning',
                title: 'Access Restricted',
                message: 'Only Customers can create new Purchase Orders.'
            });
            return;
        }
        setSelectedPoId(null);
        setShowDetailModal(true);
    };

    const handleSelectPODetail = (poHeaderId) => {
        setSelectedPoId(poHeaderId);
        setShowDetailModal(true);
    };

    const handleCloseModal = () => {
        setShowDetailModal(false);
        setSelectedPoId(null);
    };

    const handlePOSuccess = () => {
        handleCloseModal();
        setLocalRefresh((prev) => prev + 1);
    };

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <POFilterBar
                search={search}
                startDate={startDate}
                endDate={endDate}
                status={status}
                isFilterActive={isFilterActive}
                userRole={user?.role}
                exporting={exporting}
                onSearchChange={handleSearchChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onStatusChange={handleStatusChange}
                onResetFilters={handleResetFilters}
                onExportExcel={handleExportExcel}
                onCreateNewPO={handleOpenCreate}
            />

            {loading && <p>Loading PO data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <POTable
                    poList={poList}
                    fetching={fetching}
                    sortConfig={sortConfig}
                    user={user}
                    isFilterActive={isFilterActive}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onSort={handleSort}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    onSelectPODetail={handleSelectPODetail}
                    onOpenPdfModal={(poId) => setSelectedPdfPoId(poId)}
                />
            )}

            {selectedPdfPoId && (
                <POPdfModal
                    poId={selectedPdfPoId}
                    onClose={() => setSelectedPdfPoId(null)}
                />
            )}

            {showDetailModal && (
                <PODModal
                    poId={selectedPoId}
                    currentUser={user}
                    onClose={handleCloseModal}
                    onSuccess={handlePOSuccess}
                />
            )}
        </div>
    );
};

export default POPage;
