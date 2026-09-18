import { useState, useEffect, useCallback } from 'react';
import {
    fetchProductionPlansSummary,
    fetchProductionPlanDetail,
    saveProductionPlan
} from '../../services/productionPlanApi';

// Helper menghitung ISO Week & Year murni UTC
const getIsoWeekInfo = (dateObj) => {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
};

// Helper mendapatkan ISO Week & Year saat ini
const getCurrentIsoWeek = () => {
    return getIsoWeekInfo(new Date());
};

// Helper menggeser week secara presisi dan konsisten lintas tahun (100% ISO-8601)
const shiftIsoWeek = (year, week, delta) => {
    // Cari tanggal Kamis di minggu ke-1 ISO (selalu ada pada 4 Januari UTC)
    const simpleThursday = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simpleThursday.getUTCDay() || 7;

    // Cari tanggal Senin minggu ke-1 ISO
    const firstMonday = new Date(simpleThursday);
    firstMonday.setUTCDate(simpleThursday.getUTCDate() - (dayOfWeek - 1));

    // Dapatkan tanggal Senin untuk (week - 1) + delta minggu
    const targetMonday = new Date(firstMonday);
    targetMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1 + delta) * 7);

    return getIsoWeekInfo(targetMonday);
};

export const useProductionPlan = () => {
    const { year: currentYear, week: currentWeek } = getCurrentIsoWeek();
    const defaultStart = shiftIsoWeek(currentYear, currentWeek, 0);
    const defaultEnd = shiftIsoWeek(currentYear, currentWeek, 8);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [search, setSearch] = useState('');

    const [startWeek, setStartWeek] = useState(`${defaultStart.year}-W${String(defaultStart.week).padStart(2, '0')}`);
    const [endWeek, setEndWeek] = useState(`${defaultEnd.year}-W${String(defaultEnd.week).padStart(2, '0')}`);

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
    const [revisions, setRevisions] = useState([]);
    const [initialRevisions, setInitialRevisions] = useState([]);
    const [hasExistingPlan, setHasExistingPlan] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Fetch Summary Data Halaman List
    const loadSummary = useCallback(async (page = 1, limit = 10, searchKeyword = search, sW = startWeek, eW = endWeek) => {
        setLoading(true);
        try {
            const res = await fetchProductionPlansSummary({
                page,
                limit,
                search: searchKeyword,
                start_week: sW,
                end_week: eW
            });
            if (res.success) {
                setData(res.data || []);
                setWeeks(res.weeks || []);
                setPagination(res.pagination || { currentPage: page, totalPages: 1, totalItems: 0, limit });
            }
        } catch (err) {
            console.error('Error loadSummary Production Plan:', err);
        } finally {
            setLoading(false);
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
        setModalLoading(true);
        try {
            const res = await fetchProductionPlanDetail(idProduct, {
                start_week: sW,
                end_week: eW
            });
            if (res.success) {
                setModalWeeks(res.weeks || []);
                setHasExistingPlan(res.has_existing_plan || false);

                let fetchedRevs = res.revisions || [];

                if (!res.has_existing_plan || fetchedRevs.length === 0) {
                    const todayStr = new Date().toISOString().split('T')[0];
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
            setModalLoading(false);
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

    const handleModalFilterChange = (newSW, newEW) => {
        setModalStartWeek(newSW);
        setModalEndWeek(newEW);
        if (selectedProduct) {
            loadModalDetail(selectedProduct.id_product, newSW, newEW);
        }
    };

    const closeModal = () => {
        if (saving) return; // Prevent closing while saving in progress
        setIsModalOpen(false);
        setSelectedProduct(null);
        setRevisions([]);
        setInitialRevisions([]);
        setHasExistingPlan(false);
    };

    // Save Plan with confirmation & English alerts
    const handleSave = async () => {
        if (!selectedProduct) return;

        const isConfirmed = window.confirm('Are you sure you want to save these Production Plan changes?');
        if (!isConfirmed) return;

        setSaving(true);
        try {
            const payload = {
                id_product: selectedProduct.id_product,
                revisions,
                weeks: modalWeeks
            };

            const res = await saveProductionPlan(payload);
            if (res.success) {
                closeModal();
                loadSummary(pagination.currentPage, pagination.limit, search, startWeek, endWeek);
            } else {
                alert(res.message || 'Failed to save production plan.');
            }
        } catch (err) {
            console.error('Error handleSave Production Plan:', err);
            alert('An error occurred while saving the data.');
        } finally {
            setSaving(false);
        }
    };

    return {
        loading,
        data,
        weeks,
        search,
        setSearch,
        startWeek,
        setStartWeek,
        endWeek,
        setEndWeek,
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
