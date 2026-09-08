import { useState } from 'react';

function RegisterForm({ onSubmit, loading, onSwitchToLogin, setErrorMsg }) {
    const [regUserType, setRegUserType] = useState('CUSTOMER');

    // State Employee
    const [empCode, setEmpCode] = useState('');
    const [empName, setEmpName] = useState('');
    const [empGender, setEmpGender] = useState('M');
    const [empBirthDate, setEmpBirthDate] = useState('');
    const [empDept, setEmpDept] = useState('Pilih');
    const [empPassword, setEmpPassword] = useState('');
    const [empConfirmPassword, setEmpConfirmPassword] = useState('');

    // State Customer User
    const [custCode, setCustCode] = useState('');
    const [custUserCode, setCustUserCode] = useState('');
    const [custUserName, setCustUserName] = useState('');
    const [custUserEmail, setCustUserEmail] = useState('');
    const [custPassword, setCustPassword] = useState('');
    const [custConfirmPassword, setCustConfirmPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrorMsg('');

        let payload = { user_type: regUserType };

        if (regUserType === 'EMPLOYEE') {
            if (empCode.trim().length !== 5) {
                return setErrorMsg('Employee Username / Code must be exactly 5 characters.');
            }
            if (empDept === 'Pilih') {
                return setErrorMsg('Please select a department.');
            }
            if (empPassword !== empConfirmPassword) {
                return setErrorMsg('Password confirmation does not match.');
            }
            payload = {
                ...payload,
                employee_code: empCode.trim(),
                full_name: empName,
                gender: empGender,
                birth_date: empBirthDate,
                department: empDept,
                password: empPassword,
                confirm_password: empConfirmPassword
            };
        } else {
            if (custPassword !== custConfirmPassword) {
                return setErrorMsg('Password confirmation does not match.');
            }
            payload = {
                ...payload,
                customer_code: custCode.trim().toUpperCase(),
                customer_user_code: custUserCode.trim(),
                full_name: custUserName,
                email: custUserEmail,
                password: custPassword,
                confirm_password: custConfirmPassword
            };
        }

        onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>Register As:</label>
                <select
                    value={regUserType}
                    onChange={(e) => {
                        setRegUserType(e.target.value);
                        setErrorMsg('');
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    <option value="CUSTOMER">Customer User</option>
                    <option value="EMPLOYEE">Campina Employee</option>
                </select>
            </div>

            {regUserType === 'EMPLOYEE' ? (
                <>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Username (5 Chars):</label>
                        <input
                            type="text"
                            value={empCode}
                            onChange={(e) => setEmpCode(e.target.value)}
                            maxLength={5}
                            required
                            placeholder="e.g. EMP01"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Full Name:</label>
                        <input
                            type="text"
                            value={empName}
                            onChange={(e) => setEmpName(e.target.value)}
                            required
                            placeholder="Full Name"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Gender:</label>
                        <select
                            value={empGender}
                            onChange={(e) => setEmpGender(e.target.value)}
                            style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        >
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Birth Date:</label>
                        <input
                            type="date"
                            value={empBirthDate}
                            onChange={(e) => setEmpBirthDate(e.target.value)}
                            required
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Department:</label>
                        <select
                            value={empDept}
                            onChange={(e) => setEmpDept(e.target.value)}
                            style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        >
                            <option value="Pilih">-- Select Department --</option>
                            <option value="PPIC">PPIC</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Password:</label>
                        <input
                            type="password"
                            value={empPassword}
                            onChange={(e) => setEmpPassword(e.target.value)}
                            required
                            placeholder="Enter Password"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Confirm Password:</label>
                        <input
                            type="password"
                            value={empConfirmPassword}
                            onChange={(e) => setEmpConfirmPassword(e.target.value)}
                            required
                            placeholder="Re-enter Password"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Company Code:</label>
                        <input
                            type="text"
                            value={custCode}
                            onChange={(e) => setCustCode(e.target.value.toUpperCase())}
                            required
                            placeholder="Enter Registered Company Code"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Username:</label>
                        <input
                            type="text"
                            value={custUserCode}
                            onChange={(e) => setCustUserCode(e.target.value)}
                            required
                            placeholder="Enter Username"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Full Name:</label>
                        <input
                            type="text"
                            value={custUserName}
                            onChange={(e) => setCustUserName(e.target.value)}
                            required
                            placeholder="Enter Full Name"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Email:</label>
                        <input
                            type="email"
                            value={custUserEmail}
                            onChange={(e) => setCustUserEmail(e.target.value)}
                            required
                            placeholder="user@company.com"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Password:</label>
                        <input
                            type="password"
                            value={custPassword}
                            onChange={(e) => setCustPassword(e.target.value)}
                            required
                            placeholder="Enter Password"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Confirm Password:</label>
                        <input
                            type="password"
                            value={custConfirmPassword}
                            onChange={(e) => setCustConfirmPassword(e.target.value)}
                            required
                            placeholder="Re-enter Password"
                            style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                        />
                    </div>
                </>
            )}

            <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
                {loading ? 'Processing Registration...' : 'Register User'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                Already have an account?{' '}
                <button
                    type="button"
                    onClick={onSwitchToLogin}
                    style={{ border: 'none', background: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                >
                    Back to Login
                </button>
            </div>
        </form>
    );
}

export default RegisterForm;
