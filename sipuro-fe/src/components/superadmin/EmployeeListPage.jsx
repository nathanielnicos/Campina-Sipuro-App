import React, { useState, useEffect } from 'react';
import { getEmployees } from '../../services/superadminApi';

const EmployeeListPage = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await getEmployees();
            if (res.success) {
                setEmployees(res.data);
            } else {
                setEmployees(res.data || res);
            }
        } catch (err) {
            console.error('Gagal mengambil data karyawan:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Daftar Pengguna Karyawan</h3>
            </div>

            {loading ? (
                <div>Memuat data karyawan...</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>ID Karyawan</th>
                            <th style={{ padding: '10px' }}>Nama Lengkap</th>
                            <th style={{ padding: '10px' }}>Gender</th>
                            <th style={{ padding: '10px' }}>Departemen</th>
                            <th style={{ padding: '10px' }}>Tanggal Bergabung</th>
                            <th style={{ padding: '10px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data karyawan</td></tr>
                        ) : (
                            employees.map((emp) => (
                                <tr key={emp.employee_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{emp.employee_id}</td>
                                    <td style={{ padding: '10px' }}>{emp.full_name}</td>
                                    <td style={{ padding: '10px' }}>{emp.gender || '-'}</td>
                                    <td style={{ padding: '10px' }}>{emp.department || '-'}</td>
                                    <td style={{ padding: '10px' }}>{emp.join_date ? new Date(emp.join_date).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ padding: '10px', color: emp.is_suspended ? '#ef4444' : '#198754', fontWeight: 'bold' }}>
                                        {emp.is_suspended ? 'Suspended' : 'Aktif'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default EmployeeListPage;
