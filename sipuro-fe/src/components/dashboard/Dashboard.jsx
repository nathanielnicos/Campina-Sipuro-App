import { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { getDashboardStats } from '../../services/dashboardApi';
import { getStatusStyle } from '../../utils/statusHelper';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const formatMonthLabel = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    if (!year || !month) return monthStr;

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthIndex = parseInt(month, 10) - 1;
    return `${months[monthIndex] || month} ${year}`;
};

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trendMode, setTrendMode] = useState('YTD');

    // State untuk Picker Grafik Baris 1
    const currentYear = new Date().getFullYear();
    const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // State untuk Filter Tanggal Baris 2 (Berdasarkan Tanggal Dibuat PO)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchStats(trendMode, startDate, endDate, selectedYear, selectedMonth);
    }, [trendMode, startDate, endDate, selectedYear, selectedMonth]);

    const fetchStats = async (mode, from, to, year, month) => {
        setLoading(true);
        try {
            const res = await getDashboardStats(mode, from, to, year, month);
            if (res.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Failed to load dashboard statistics:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResetDateFilter = () => {
        setStartDate('');
        setEndDate('');
    };

    if (loading && !stats) return <div style={{ padding: '20px' }}>Loading dashboard data...</div>;
    if (!stats) return <div style={{ padding: '20px' }}>Statistical data is not available.</div>;

    // 1. Data Chart Tren Pesanan vs Realisasi Fulfilled
    const monthlyData = {
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
    };

    // 2. Data Chart Status PO (Legend di kanan)
    const statusData = {
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
    };

    // 3. Data Chart Top 5 Produk (Sumbu X: Kode Produk, Tooltip: Nama Produk)
    const topProductsData = {
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
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false
    };

    // Pilihan tahun (5 tahun terakhir sampai tahun depan)
    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            {/* BARIS 1: Grafik Tren Pesanan vs Realisasi Fulfilled */}
            <div style={{ ...styles.card, marginBottom: '20px' }}>
                <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>
                        PO Quantity vs Production Output {trendMode === 'YTD' ? `(${selectedYear})` : `(${formatMonthLabel(selectedMonth)})`}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Picker Dinamis Berdasarkan Mode */}
                        {trendMode === 'YTD' ? (
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                style={styles.selectPicker}
                            >
                                {yearOptions.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={styles.monthPicker}
                            />
                        )}

                        {/* Switch Filter YTD vs MTD */}
                        <div style={styles.switchContainer}>
                            <button
                                type="button"
                                onClick={() => setTrendMode('YTD')}
                                style={{
                                    ...styles.switchBtn,
                                    backgroundColor: trendMode === 'YTD' ? '#3b82f6' : '#e2e8f0',
                                    color: trendMode === 'YTD' ? '#ffffff' : '#475569'
                                }}
                            >
                                YTD
                            </button>
                            <button
                                type="button"
                                onClick={() => setTrendMode('MTD')}
                                style={{
                                    ...styles.switchBtn,
                                    backgroundColor: trendMode === 'MTD' ? '#3b82f6' : '#e2e8f0',
                                    color: trendMode === 'MTD' ? '#ffffff' : '#475569'
                                }}
                            >
                                MTD
                            </button>
                        </div>
                    </div>
                </div>

                <div style={styles.chartWrapperFull}>
                    <Line
                        data={monthlyData}
                        options={{
                            ...commonOptions,
                            plugins: {
                                legend: { position: 'top' },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString('id-ID')} Pcs`
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    ticks: {
                                        autoSkip: true,
                                        maxTicksLimit: trendMode === 'MTD' ? 16 : 12
                                    }
                                },
                                y: {
                                    type: 'linear',
                                    display: true,
                                    title: { display: true, text: 'Total Qty (Pcs)' },
                                    beginAtZero: true
                                }
                            }
                        }}
                    />
                </div>
            </div>

            {/* BARIS 2 FILTER HEADER: Filter Rentang Tanggal Dibuat PO */}
            <div style={styles.filterBar}>
                <div style={styles.filterTitleGroup}>
                    <span style={styles.filterLabelHeader}>PO Created Date Filter</span>
                    <small style={styles.filterSubLabel}>(Applies to PO Status & Top 5 Products charts)</small>
                </div>
                <div style={styles.dateInputsContainer}>
                    <div style={styles.inputGroup}>
                        <label style={styles.inputLabel}>From Date:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={styles.dateInput}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.inputLabel}>To Date:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={styles.dateInput}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            type="button"
                            onClick={handleResetDateFilter}
                            style={styles.resetBtn}
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* BARIS 2: Status PO dan Top 5 Produk (2 Kolom Berdampingan) */}
            <div style={styles.gridTwo}>
                {/* Status PO */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>PO Status</h3>
                    <div style={styles.chartWrapperPie}>
                        <Pie
                            data={statusData}
                            options={{
                                ...commonOptions,
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            boxWidth: 15,
                                            padding: 12,
                                            color: '#334155', // Warna abu-abu gelap yang lebih kontras tapi tetap halus
                                            font: {
                                                size: 13,
                                                weight: 'normal' // Menggunakan font weight normal
                                            }
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Top 5 Produk */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Top 5 High-Demand Products</h3>
                    <div style={styles.chartWrapper}>
                        <Bar
                            data={topProductsData}
                            options={{
                                ...commonOptions,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            title: (tooltipItems) => {
                                                const idx = tooltipItems[0].dataIndex;
                                                return stats.topProducts[idx]?.product_name || tooltipItems[0].label;
                                            },
                                            label: (context) => `Total PO Qty: ${context.parsed.y.toLocaleString('id-ID')} Pcs`
                                        }
                                    }
                                },
                                scales: {
                                    x: {
                                        ticks: {
                                            maxRotation: 0,
                                            autoSkip: false
                                        }
                                    },
                                    y: { beginAtZero: true }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        padding: '10px 0',
        color: '#1e293b'
    },
    title: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '16px'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '10px'
    },
    switchContainer: {
        display: 'flex',
        gap: '6px',
        backgroundColor: '#f1f5f9',
        padding: '3px',
        borderRadius: '6px'
    },
    switchBtn: {
        padding: '5px 12px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    selectPicker: {
        padding: '5px 10px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '12px',
        color: '#1e293b',
        backgroundColor: '#ffffff',
        outline: 'none',
        cursor: 'pointer'
    },
    monthPicker: {
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '12px',
        color: '#1e293b',
        backgroundColor: '#ffffff',
        outline: 'none'
    },
    filterBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap',
        gap: '12px'
    },
    filterTitleGroup: {
        display: 'flex',
        flexDirection: 'column'
    },
    filterLabelHeader: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#334155'
    },
    filterSubLabel: {
        fontSize: '11px',
        color: '#64748b'
    },
    dateInputsContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
    },
    inputGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    inputLabel: {
        fontSize: '12px',
        fontWeight: '500',
        color: '#475569'
    },
    dateInput: {
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #cbd5e1',
        fontSize: '13px',
        color: '#1e293b',
        outline: 'none'
    },
    resetBtn: {
        padding: '6px 12px',
        backgroundColor: '#ef4444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
    },
    card: {
        backgroundColor: '#ffffff',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
    },
    cardTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#334155'
    },
    chartWrapperFull: {
        position: 'relative',
        height: '300px',
        width: '100%'
    },
    chartWrapper: {
        position: 'relative',
        height: '260px',
        width: '100%'
    },
    chartWrapperPie: {
        position: 'relative',
        height: '260px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center'
    }
};

export default Dashboard;
