import { useState } from 'react';

function LoginForm({ onSubmit, loading, onSwitchToRegister }) {
    const [roleType, setRoleType] = useState('CUSTOMER');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ username, password, roleType });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>User Type:</label>
                <select
                    value={roleType}
                    onChange={(e) => {
                        setRoleType(e.target.value);
                        setUsername('');
                        setPassword('');
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                    <option value="CUSTOMER">Customer</option>
                    <option value="EMPLOYEE">Campina</option>
                </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                    Username:
                </label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder={'Enter Username'}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>Password:</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter Password"
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
                {loading ? 'Logging in...' : 'Login'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                Don't have an account?{' '}
                <button
                    type="button"
                    onClick={onSwitchToRegister}
                    style={{ border: 'none', background: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                >
                    Register Now
                </button>
            </div>
        </form>
    );
}

export default LoginForm;
