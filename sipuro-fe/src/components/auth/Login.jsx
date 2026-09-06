import { useState } from 'react';
import { loginApi, registerApi } from '../../services/authApi';

function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);

  // State Login
  const [roleType, setRoleType] = useState('CUSTOMER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // State General Status
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // State Register Common
  const [regUserType, setRegUserType] = useState('CUSTOMER');

  // State Register Employee
  const [empCode, setEmpCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empGender, setEmpGender] = useState('M');
  const [empBirthDate, setEmpBirthDate] = useState('');
  const [empDept, setEmpDept] = useState('Pilih');
  const [empPassword, setEmpPassword] = useState('');
  const [empConfirmPassword, setEmpConfirmPassword] = useState('');

  // State Register Customer
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custDeliveryAddress, setCustDeliveryAddress] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custConfirmPassword, setCustConfirmPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await loginApi(username, password, roleType);

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

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    let payload = { user_type: regUserType };

    if (regUserType === 'EMPLOYEE') {
      if (empDept === 'Pilih') {
        return setErrorMsg('Silakan pilih Departemen terlebih dahulu.');
      }
      if (empPassword !== empConfirmPassword) {
        return setErrorMsg('Konfirmasi password tidak cocok.');
      }
      payload = {
        ...payload,
        employee_code: empCode,
        full_name: empName,
        gender: empGender,
        birth_date: empBirthDate,
        department: empDept,
        password: empPassword,
        confirm_password: empConfirmPassword
      };
    } else {
      const codeUpper = custCode.toUpperCase();
      if (codeUpper.length < 3 || codeUpper.length > 4) {
        return setErrorMsg('Kode Pelanggan harus berpanjang 3 sampai 4 karakter.');
      }
      if (custPassword !== custConfirmPassword) {
        return setErrorMsg('Konfirmasi password tidak cocok.');
      }
      payload = {
        ...payload,
        customer_code: codeUpper,
        company_name: custName,
        email: custEmail,
        phone: custPhone,
        address: custAddress,
        delivery_address: custDeliveryAddress,
        password: custPassword,
        confirm_password: custConfirmPassword
      };
    }

    setLoading(true);
    try {
      const result = await registerApi(payload);
      if (result.success) {
        setSuccessMsg(result.message);
        setIsRegistering(false);
        // Reset form
        setEmpCode(''); setEmpName(''); setEmpPassword(''); setEmpConfirmPassword('');
        setCustCode(''); setCustName(''); setCustEmail(''); setCustPhone(''); setCustAddress(''); setCustDeliveryAddress(''); setCustPassword(''); setCustConfirmPassword('');
      } else {
        setErrorMsg(result.message || 'Gagal mendaftar.');
      }
    } catch (err) {
      console.error('Error registering:', err);
      setErrorMsg('Gagal terhubung ke server backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '40px auto', padding: '24px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        {isRegistering ? 'Pendaftaran User Baru' : 'Login System SIPURO'}
      </h2>

      {errorMsg && (
        <div style={{ color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ color: '#0f5132', backgroundColor: '#d1e7dd', border: '1px solid #badbcc', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>
          {successMsg}
        </div>
      )}

      {!isRegistering ? (
        /* FORM LOGIN */
        <form onSubmit={handleLoginSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>Tipe User:</label>
            <select
              value={roleType}
              onChange={(e) => { setRoleType(e.target.value); setUsername(''); setPassword(''); }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="CUSTOMER">Pelanggan</option>
              <option value="EMPLOYEE">Karyawan</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
              {roleType === 'CUSTOMER' ? 'Kode Pelanggan:' : 'Kode Karyawan:'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={roleType === 'CUSTOMER' ? 'Masukkan Kode Customer' : 'Masukkan Kode Karyawan'}
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
              placeholder="Masukkan Password"
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
            Belum punya akun?{' '}
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setErrorMsg(''); setSuccessMsg(''); }}
              style={{ border: 'none', background: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              Daftar Sekarang
            </button>
          </div>
        </form>
      ) : (
        /* FORM REGISTER */
        <form onSubmit={handleRegisterSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>Daftar Sebagai:</label>
            <select
              value={regUserType}
              onChange={(e) => { setRegUserType(e.target.value); setErrorMsg(''); }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="CUSTOMER">Pelanggan</option>
              <option value="EMPLOYEE">Karyawan</option>
            </select>
          </div>

          {regUserType === 'EMPLOYEE' ? (
            /* FIELD KARYAWAN */
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Kode Karyawan:</label>
                <input
                  type="text"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  required
                  placeholder="Masukkan Kode Karyawan"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Nama Karyawan:</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                  placeholder="Nama Lengkap"
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
                  <option value="M">Laki-Laki</option>
                  <option value="F">Perempuan</option>
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Tanggal Lahir:</label>
                <input
                  type="date"
                  value={empBirthDate}
                  onChange={(e) => setEmpBirthDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Departemen:</label>
                <select
                  value={empDept}
                  onChange={(e) => setEmpDept(e.target.value)}
                  style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                >
                  <option value="Pilih">-- Pilih Departemen --</option>
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
                  placeholder="Masukkan Password"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Konfirmasi Password:</label>
                <input
                  type="password"
                  value={empConfirmPassword}
                  onChange={(e) => setEmpConfirmPassword(e.target.value)}
                  required
                  placeholder="Ketik Ulang Password"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>
            </>
          ) : (
            /* FIELD CUSTOMER */
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Kode Pelanggan (3-4 Karakter Kapital):</label>
                <input
                  type="text"
                  value={custCode}
                  onChange={(e) => setCustCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  required
                  placeholder="Contoh: ABC"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', textTransform: 'uppercase' }}
                />
                <span style={{ fontSize: '11px', color: '#6c757d' }}>* Kode pelanggan akan digunakan dalam penomoran kode PO.</span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Nama Perusahaan / Pelanggan:</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  placeholder="Nama Perusahaan / Toko"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Email:</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  required
                  placeholder="email@perusahaan.com"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Telepon:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '7px 10px', backgroundColor: '#e9ecef', border: '1px solid #ccc', borderRight: 'none', borderRadius: '4px 0 0 4px', fontSize: '13px', fontWeight: 'bold' }}>+62</span>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="8123456789"
                    style={{ flex: 1, padding: '7px', boxSizing: 'border-box', borderRadius: '0 4px 4px 0', border: '1px solid #ccc', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Alamat Lengkap:</label>
                <textarea
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  required
                  rows={2}
                  placeholder="Alamat kantor / utama"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Alamat Pengiriman:</label>
                <textarea
                  value={custDeliveryAddress}
                  onChange={(e) => setCustDeliveryAddress(e.target.value)}
                  required
                  rows={2}
                  placeholder="Alamat pengiriman / gudang"
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
                  placeholder="Masukkan Password"
                  style={{ width: '100%', padding: '7px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Konfirmasi Password:</label>
                <input
                  type="password"
                  value={custConfirmPassword}
                  onChange={(e) => setCustConfirmPassword(e.target.value)}
                  required
                  placeholder="Ketik Ulang Password"
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
            {loading ? 'Memproses Pendaftaran...' : 'Daftar Sekarang'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
            Sudah punya akun?{' '}
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setErrorMsg(''); setSuccessMsg(''); }}
              style={{ border: 'none', background: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              Kembali ke Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default Login;
