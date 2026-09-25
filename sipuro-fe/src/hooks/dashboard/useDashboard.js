import { useState, useEffect, useRef } from 'react';
import { getDashboardStats } from '../../services/dashboardApi';
import { fetchProducts } from '../../services/poApi';
import { getStatusStyle } from '../../utils/statusHelper';
import { getWibDate } from '../../utils/dateHelper';

export const useDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trendMode, setTrendMode] = useState('YTD');

    // State untuk Master Produk & Dropdown
    const [productsList, setProductsList] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedProductLabel, setSelectedProductLabel] = useState('All Products');
    const [searchInput, setSearchInput] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // State untuk Picker Grafik Baris 1 - Menggunakan WibDate
    const nowWib = getWibDate();
    const currentYear = nowWib.getFullYear();
    const currentMonth = `${currentYear}-${String(nowWib.getMonth() + 1).padStart(2, '0')}`;
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // State untuk Filter Tanggal Baris 2
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Load Daftar Produk saat komponen dibuat
    useEffect(() => {
        const loadProducts = async () => {
            try {
                const res = await fetchProducts();
                if (res.success && Array.isArray(res.data)) {
                    setProductsList(res.data);
                }
            } catch (err) {
                console.error('Failed to load product list:', err);
            }
        };
        loadProducts();
    }, []);

    // Close Dropdown saat klik di luar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                setSearchInput('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load Data Statistik Setiap Filter Berubah
    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const res = await getDashboardStats(
                    trendMode,
                    startDate,
                    endDate,
                    selectedYear,
                    selectedMonth,
                    selectedProduct
                );
                if (res.success) {
                    setStats(res.data);
                }
            } catch (err) {
                console.error('Failed to load dashboard statistics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [trendMode, startDate, endDate, selectedYear, selectedMonth, selectedProduct]);

    const handleResetDateFilter = () => {
        setStartDate('');
        setEndDate('');
    };

    // Filter list produk berdasarkan teks pencarian
    const filteredProducts = productsList.filter((p) => {
        if (!searchInput) return true;
        const searchLower = searchInput.toLowerCase();
        const codeMatch = p.product_code?.toLowerCase().includes(searchLower);
        const nameMatch = p.product_name?.toLowerCase().includes(searchLower);
        return codeMatch || nameMatch;
    });

    const handleSelectProductItem = (prod) => {
        if (!prod) {
            setSelectedProduct('');
            setSelectedProductLabel('All Products');
        } else {
            setSelectedProduct(prod.id_product);
            setSelectedProductLabel(`${prod.product_code} - ${prod.product_name}`);
        }
        setSearchInput('');
        setIsDropdownOpen(false);
    };

    // Format Data untuk Charts
    const monthlyData = stats ? {
        labels: stats.monthlyStats.map(item => item.month_label || item.label_key),
        datasets: [
            {
                label: 'PO Qty (Pcs)',
                data: stats.monthlyStats.map(item => Number(item.total_volume) || 0),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6'
            },
            {
                label: 'Production Output (Pcs)',
                data: stats.monthlyStats.map(item => Number(item.total_fulfilled) || 0),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#10b981'
            }
        ]
    } : null;

    const statusData = stats ? {
        labels: stats.statusStats.map(item => item.status),
        datasets: [
            {
                data: stats.statusStats.map(item => Number(item.count) || 0),
                backgroundColor: stats.statusStats.map(
                    item => getStatusStyle(item.status).backgroundColor || '#e2e3e5'
                ),
                borderColor: stats.statusStats.map(
                    item => getStatusStyle(item.status).color || '#383d41'
                ),
                borderWidth: 1
            }
        ]
    } : null;

    const topProductsData = stats ? {
        labels: stats.topProducts.map(item => item.product_code),
        datasets: [
            {
                label: 'Total PO Qty',
                data: stats.topProducts.map(item => Number(item.total_qty) || 0),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3b82f6',
                borderWidth: 1
            }
        ]
    } : null;

    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    return {
        stats,
        loading,
        trendMode,
        setTrendMode,
        selectedProduct,
        selectedProductLabel,
        searchInput,
        setSearchInput,
        isDropdownOpen,
        setIsDropdownOpen,
        dropdownRef,
        filteredProducts,
        handleSelectProductItem,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        handleResetDateFilter,
        monthlyData,
        statusData,
        topProductsData,
        yearOptions
    };
};
