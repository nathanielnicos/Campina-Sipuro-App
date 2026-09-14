import { useEmployeeList } from '../../hooks/master/useEmployeeList';
import PaginationControl from '../common/PaginationControl';
import { formatDate, formatGender } from '../../utils/formatters';

const EmployeeListPage = () => {
    const {
        employees,
        loading,
        updatingId,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePageChange,
        handleLimitChange,
        handleToggleStatus
    } = useEmployeeList();

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end'
            }}>
                <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Search Code / Employee Name
                    </label>
                    <input
                        type="text"
                        placeholder="Search employee code or name..."
                        value={search}
                        onChange={handleSearchChange}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                    />
                </div>
                {search && (
                    <button
                        onClick={handleResetFilter}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: '1px solid #dc3545',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                        }}
                    >
                        Reset Filter
                    </button>
                )}
            </div>

            {loading ? (
                <div>Loading employee data...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Employee Code</th>
                                    <th style={{ padding: '10px' }}>Full Name</th>
                                    <th style={{ padding: '10px' }}>Gender</th>
                                    <th style={{ padding: '10px' }}>Department</th>
                                    <th style={{ padding: '10px' }}>Birth Date</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '15px', textAlign: 'center' }}>No employee data available</td></tr>
                                ) : (
                                    employees.map((emp) => (
                                        <tr key={emp.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{emp.employee_code}</td>
                                            <td style={{ padding: '10px' }}>{emp.full_name}</td>
                                            <td style={{ padding: '10px' }}>{formatGender(emp.gender)}</td>
                                            <td style={{ padding: '10px' }}>{emp.department || '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {formatDate(emp.birth_date)}
                                            </td>
                                            <td style={{ padding: '10px', color: emp.is_suspended ? '#ef4444' : '#198754', fontWeight: 'bold' }}>
                                                {emp.is_suspended ? 'Inactive' : 'Active'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleToggleStatus(emp)}
                                                    disabled={updatingId === emp.id}
                                                    style={{
                                                        padding: '5px 10px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        cursor: updatingId === emp.id ? 'not-allowed' : 'pointer',
                                                        opacity: updatingId === emp.id ? 0.6 : 1,
                                                        backgroundColor: emp.is_suspended ? '#198754' : '#dc3545',
                                                        color: '#fff',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }}
                                                >
                                                    {updatingId === emp.id
                                                        ? 'Processing...'
                                                        : emp.is_suspended
                                                            ? 'Activate'
                                                            : 'Deactivate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControl
                        pagination={{
                            currentPage,
                            totalPages,
                            totalItems,
                            limit: pageSize
                        }}
                        onPageChange={handlePageChange}
                        onLimitChange={handleLimitChange}
                    />
                </div>
            )}
        </div>
    );
};

export default EmployeeListPage;
