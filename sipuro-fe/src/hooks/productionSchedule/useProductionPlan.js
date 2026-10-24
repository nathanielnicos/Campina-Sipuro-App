import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchProductionPlansSummary,
    fetchProductionPlanDetail,
    saveProductionPlan
} from '../../services/productionPlanApi';
import { getWibDateString } from '../../utils/dateHelper';
import { getDefaultWeekRange, isValidWeekRange } from '../../utils/weekRange';
import { useGlobalModal } from '../../context/ModalContext';

export const useProductionPlan = () => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [search, setSearch] = useState('');

    const [weekRange, setWeekRange] = useState(() => getDefaultWeekRange());
    const { startWeek, endWeek } = weekRange;
    const handleWeekRangeChange = useCallback((newStart, newEnd) => {
        setWeekRange({ startWeek: newStart, endWeek: newEnd });
    }, []);

    // Hanya respons dari permintaan terakhir yang boleh mengubah tampilan.
    const summaryRequestRef = useRef(0);
    const detailRequestRef = useRef(0);

    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [modalWeeks, setModalWeeks] = useState([]);
    const [modalStartWeek, setModalStartWeek] = useState(startWeek);
    const [modalEndWeek, setModalEndWeek] = useState(endWeek);
    // Rentang minggu dari data yang benar-benar sedang tampil; inilah yang dikirim saat simpan.
    const [loadedRange, setLoadedRange] = useState(null);
    const [revisions, setRevisions] = useState([]);
    const [initialRevisions, setInitialRevisions] = useState([]);
    const [hasExistingPlan, setHasExistingPlan] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Fetch Summary Data Halaman List
    const loadSummary = useCallback(async (page = 1, limit = 10, searchKeyword = search, sW = startWeek, eW = endWeek) => {
        if (!isValidWeekRange(sW, eW)) return;
        const requestId = ++summaryRequestRef.current;
        setLoading(true);
        try {
            const res = await fetchProductionPlansSummary({
                page,
                limit,
                search: searchKeyword,
                start_week: sW,
                end_week: eW
            });
            if (requestId !== summaryRequestRef.current) return;
            if (res.success) {
                setData(res.data || []);
                setWeeks(res.weeks || []);
                setPagination(res.pagination || { currentPage: page, totalPages: 1, totalItems: 0, limit });
            }
        } catch (err) {
            console.error('Error loadSummary Production Plan:', err);
        } finally {
            if (requestId === summaryRequestRef.current) setLoading(false);
        }
    }, [search, startWeek, endWeek]);

    useEffect(() => {
        loadSummary(1, pagination.limit, search, startWeek, endWeek);
    }, [search, startWeek, endWeek, loadSummary, pagination.limit]);

    const handlePageChange = (newPage) => {
        loadSummary(newPage, pagination.limit, search, startWeek, endWeek);
    };

    const handleLimitChange = (newLimit) => {
        loadSummary(1, newLimit, search, startWeek, endWeek);
    };

    // Load Detail Product di Modal
    const loadModalDetail = useCallback(async (idProduct, sW = modalStartWeek, eW = modalEndWeek) => {
        if (!isValidWeekRange(sW, eW)) return;
        const requestId = ++detailRequestRef.current;
        setModalLoading(true);
        try {
            const res = await fetchProductionPlanDetail(idProduct, {
                start_week: sW,
                end_week: eW
            });
            if (requestId !== detailRequestRef.current) return;
            if (res.success) {
                setLoadedRange({ startWeek: sW, endWeek: eW });
                setModalWeeks(res.weeks || []);
                setHasExistingPlan(res.has_existing_plan || false);

                let fetchedRevs = res.revisions || [];

                if (!res.has_existing_plan || fetchedRevs.length === 0) {
                    const todayStr = getWibDateString();
                    const emptyWeeksData = {};
                    (res.weeks || []).forEach(w => {
                        emptyWeeksData[`${w.year}_${w.week_number}`] = 0;
                    });

                    fetchedRevs = [
                        {
                            revision_type: 'PROPOSED',
                            revision_label: 'Proposed Plan',
                            revision_date: todayStr,
                            weeks_data: { ...emptyWeeksData }
                        },
                        {
                            revision_type: 'CAMPINA_PLAN',
                            revision_label: "Campina's Plan",
                            revision_date: todayStr,
                            weeks_data: { ...emptyWeeksData }
                        }
                    ];
                }

                setRevisions(fetchedRevs);
                setInitialRevisions(JSON.parse(JSON.stringify(fetchedRevs)));
            }
        } catch (err) {
            console.error('Error openModal Production Plan:', err);
        } finally {
            if (requestId === detailRequestRef.current) setModalLoading(false);
        }
    }, [modalStartWeek, modalEndWeek]);

    // Open Modal
    const openModal = (product) => {
        setSelectedProduct(product);
        setModalStartWeek(startWeek);
        setModalEndWeek(endWeek);
        setIsModalOpen(true);
        loadModalDetail(product.id_product, startWeek, endWeek);
    };

    const hasUnsavedChanges = JSON.stringify(revisions) !== JSON.stringify(initialRevisions);

    const handleModalFilterChange = (newSW, newEW) => {
        const applyFilter = () => {
            setModalStartWeek(newSW);
            setModalEndWeek(newEW);
            if (selectedProduct) {
                loadModalDetail(selectedProduct.id_product, newSW, newEW);
            }
        };

        // Rentang yang belum lengkap/valid hanya mengisi kolom input, tanpa memuat ulang data.
        if (!isValidWeekRange(newSW, newEW)) {
            setModalStartWeek(newSW);
            setModalEndWeek(newEW);
            return;
        }

        if (hasUnsavedChanges) {
            showConfirm({
                title: 'Discard Unsaved Changes',
                message: 'Changing the week range reloads the plan and discards your unsaved changes. Continue?',
                confirmText: 'Discard & Change',
                onConfirm: applyFilter
            });
            return;
        }

        applyFilter();
    };

    const closeModal = () => {
        if (saving) return;
        detailRequestRef.current += 1; // abaikan respons detail yang masih berjalan
        setIsModalOpen(false);
        setSelectedProduct(null);
        setRevisions([]);
        setInitialRevisions([]);
        setHasExistingPlan(false);
        setLoadedRange(null);
    };

    // Fungsi internal eksekusi API Simpan
    const executeSave = async () => {
        if (!loadedRange) return;
        setSaving(true);
        try {
            // Hanya minggu pada rentang yang tampil yang dikirim; server tidak menghapus minggu/revisi lain.
            const payload = {
                id_product: selectedProduct.id_product,
                start_week: loadedRange.startWeek,
                end_week: loadedRange.endWeek,
                revisions: revisions.map((rev) => ({
                    id_revision: rev.id_revision,
                    revision_type: rev.revision_type,
                    revision_label: rev.revision_label,
                    revision_date: rev.revision_date,
                    weeks_data: rev.weeks_data
                }))
            };

            const res = await saveProductionPlan(payload);
            if (res.success) {
                closeModal();
                loadSummary(pagination.currentPage, pagination.limit, search, startWeek, endWeek);
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: 'Production plan saved successfully!'
                });
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res.message || 'Failed to save production plan.'
                });
            }
        } catch (err) {
            console.error('Error handleSave Production Plan:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'An error occurred while saving the data.'
            });
        } finally {
            setSaving(false);
        }
    };

    // Save Plan dengan Modal Konfirmasi
    const handleSave = () => {
        if (!selectedProduct) return;

        showConfirm({
            title: 'Save Production Plan',
            message: 'Are you sure you want to save these Production Plan changes?',
            confirmText: 'Save Changes',
            onConfirm: executeSave
        });
    };

    return {
        loading,
        data,
        weeks,
        search,
        setSearch,
        startWeek,
        endWeek,
        handleWeekRangeChange,
        pagination,
        handlePageChange,
        handleLimitChange,
        // Modal
        isModalOpen,
        selectedProduct,
        modalWeeks,
        modalStartWeek,
        modalEndWeek,
        revisions,
        setRevisions,
        initialRevisions,
        hasExistingPlan,
        modalLoading,
        saving,
        openModal,
        closeModal,
        handleSave,
        handleModalFilterChange
    };
};
