import React, { useEffect, useState } from 'react';
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
import { getPPICDashboardStats } from '../../services/ppicApi';
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

const PPICDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trendMode, setTrendMode] = useState('YTD');

    // State untuk Filter Tanggal Baris 2 (Berdasarkan Tanggal Dibuat PO)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchStats(trendMode, startDate, endDate);
    }, [trendMode, startDate, endDate]);

    const fetchStats = async (mode, from, to) => {
        setLoading(true);
        try {
            const res = await getPPICDashboardStats(mode, from, to);
            if (res.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Gagal memuat statistik dasbor:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleResetDateFilter = () => {
        setStartDate('');
        setEndDate('');
    };

    if (loading && !stats) return <div style={{ padding: '20px' }}>Memuat data dasbor...</div>;
    if (!stats) return <div style={{ padding: '20px' }}>Data statistik tidak tersedia.</div>;

    // 1. Data Chart Tren Pesanan (Hanya Total Qty dalam Base UOM)
    const monthlyData = {
        labels: stats.monthlyStats.map(item => item.month_label || item.label_key),
        datasets: [
            {
                label: 'Total Qty (Base UOM)',
                data: stats.monthlyStats.map(item => Number(item.total_volume) || 0),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
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
                label: 'Total Qty PO',
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

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Dasbor Perencanaan & Monitoring PPIC</h2>

            {/* BARIS 1: Grafik Tren Pesanan (Penuh 1 Baris) */}
            <div style={{ ...styles.card, marginBottom: '20px' }}>
                <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>
                        Tren Pesanan {trendMode === 'YTD' ? 'Year to Date (Januari - Bulan Ini)' : 'Month to Date (Tgl 1 - Hari Ini)'}
                    </h3>

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
                            YTD (Per Bulan)
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
                            MTD (Per Hari)
                        </button>
                    </div>
                </div>

                <div style={styles.chartWrapperFull}>
                    <Line
                        data={monthlyData}
                        options={{
                            ...commonOptions,
                            plugins: {
                                legend: { position: 'top' }
                            },
                            scales: {
                                y: {
                                    type: 'linear',
                                    display: true,
                                    title: { display: true, text: 'Total Qty (Base UOM)' },
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
                    <span style={styles.filterLabelHeader}>Filter Tanggal Dibuat PO</span>
                    <small style={styles.filterSubLabel}>(Berlaku untuk grafik Status PO & Top 5 Produk)</small>
                </div>
                <div style={styles.dateInputsContainer}>
                    <div style={styles.inputGroup}>
                        <label style={styles.inputLabel}>Dari Tanggal:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={styles.dateInput}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.inputLabel}>Sampai Tanggal:</label>
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
                            Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* BARIS 2: Status PO dan Top 5 Produk (2 Kolom Berdampingan) */}
            <div style={styles.gridTwo}>
                {/* Status PO */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Status PO</h3>
                    <div style={styles.chartWrapperPie}>
                        <Pie
                            data={statusData}
                            options={{
                                ...commonOptions,
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: { boxWidth: 15, padding: 12 }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Top 5 Produk */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Top 5 Produk Kebutuhan Tertinggi</h3>
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
                                            label: (context) => `Total Qty PO: ${context.parsed.y}`
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
        marginBottom: '12px'
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

export default PPICDashboard;
