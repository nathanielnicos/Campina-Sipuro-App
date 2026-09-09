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
import { useDashboard } from '../../hooks/dashboard/useDashboard';

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
    const {
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
    } = useDashboard();

    if (loading && !stats) return <div style={{ padding: '20px' }}>Loading dashboard data...</div>;
    if (!stats) return <div style={{ padding: '20px' }}>Statistical data is not available.</div>;

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false
    };

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            {/* BARIS 1: Grafik Tren Pesanan vs Realisasi Fulfilled */}
            <div style={{ ...styles.card, marginBottom: '20px' }}>
                <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>
                        PO Quantity vs Production Output {trendMode === 'YTD' ? `(${selectedYear})` : `(${formatMonthLabel(selectedMonth)})`}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                        {/* Custom Searchable Product Dropdown */}
                        <div style={{ position: 'relative', width: '220px' }} ref={dropdownRef}>
                            <input
                                type="text"
                                value={isDropdownOpen ? searchInput : selectedProductLabel}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onFocus={() => {
                                    setSearchInput('');
                                    setIsDropdownOpen(true);
                                }}
                                placeholder="Search product..."
                                title={selectedProductLabel}
                                style={styles.productSearchInput}
                            />
                            {isDropdownOpen && (
                                <div style={styles.dropdownMenu}>
                                    <div
                                        style={{
                                            ...styles.dropdownItem,
                                            fontWeight: selectedProduct === '' ? 'bold' : 'normal',
                                            backgroundColor: selectedProduct === '' ? '#f1f5f9' : 'transparent'
                                        }}
                                        onClick={() => handleSelectProductItem(null)}
                                    >
                                        All Products
                                    </div>
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((p) => (
                                            <div
                                                key={p.id_product}
                                                style={{
                                                    ...styles.dropdownItem,
                                                    fontWeight: String(selectedProduct) === String(p.id_product) ? 'bold' : 'normal',
                                                    backgroundColor: String(selectedProduct) === String(p.id_product) ? '#f1f5f9' : 'transparent'
                                                }}
                                                onClick={() => handleSelectProductItem(p)}
                                            >
                                                {p.product_code} - {p.product_name}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={styles.dropdownNoResult}>No product found</div>
                                    )}
                                </div>
                            )}
                        </div>

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

            {/* BARIS 2: Status PO dan Top 5 Produk */}
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
                                            color: '#334155',
                                            font: {
                                                size: 13,
                                                weight: 'normal'
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
        gap: '4px',
        backgroundColor: '#f1f5f9',
        padding: '3px',
        borderRadius: '6px'
    },
    switchBtn: {
        padding: '5px 10px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    productSearchInput: {
        width: '100%',
        padding: '5px 8px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '12px',
        color: '#1e293b',
        backgroundColor: '#ffffff',
        outline: 'none',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        boxSizing: 'border-box'
    },
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        right: 0,
        width: '280px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        marginTop: '4px',
        maxHeight: '220px',
        overflowY: 'auto',
        zIndex: 100,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    dropdownItem: {
        padding: '8px 12px',
        fontSize: '12px',
        color: '#1e293b',
        cursor: 'pointer',
        transition: 'background-color 0.15s'
    },
    dropdownNoResult: {
        padding: '8px 12px',
        fontSize: '12px',
        color: '#94a3b8',
        textAlign: 'center'
    },
    selectPicker: {
        padding: '5px 8px',
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
