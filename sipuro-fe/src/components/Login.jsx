import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [roleType, setRoleType] = useState('CUSTOMER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role_type: roleType
        })
      });

      const result = await response.json();

      if (result.success) {
        onLoginSuccess(result.data);
      } else {
        setErrorMsg(result.message || 'Login gagal.');
      }
    } catch (err) {
      console.error('Error logging in:', err);
      setErrorMsg('Gagal terhubung ke server backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '24px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Login System SIPURO</h2>
      
      {errorMsg && (
        <div style={{ color: 'red', backgroundColor: '#fbeae8', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Tipe User:</label>
          <select 
            value={roleType} 
            onChange={(e) => { setRoleType(e.target.value); setUsername(''); setPassword(''); }}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="CUSTOMER">Customer</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            {roleType === 'CUSTOMER' ? 'Customer Code:' : 'Employee ID:'}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder={roleType === 'CUSTOMER' ? 'Masukkan Kode Customer' : 'Masukkan ID Karyawan'}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Masukkan Password"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
