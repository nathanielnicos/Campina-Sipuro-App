import { useState } from 'react';
import { loginApi, registerApi } from '../../services/authApi';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async ({ username, password, roleType }) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await loginApi(username, password, roleType);
      if (result.success) {
        onLoginSuccess(result.data);
      } else {
        setErrorMsg(result.message || 'Login failed.');
      }
    } catch (err) {
      console.error('Error logging in:', err);
      setErrorMsg('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await registerApi(payload);
      if (result.success) {
        setSuccessMsg(result.message);
        setIsRegistering(false);
      } else {
        setErrorMsg(result.message || 'Registration failed.');
      }
    } catch (err) {
      console.error('Error registering:', err);
      setErrorMsg('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '40px auto', padding: '24px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        {isRegistering ? 'New User Registration' : 'SIPURO System Login'}
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
        <LoginForm
          onSubmit={handleLogin}
          loading={loading}
          onSwitchToRegister={() => {
            setIsRegistering(true);
            setErrorMsg('');
            setSuccessMsg('');
          }}
        />
      ) : (
        <RegisterForm
          onSubmit={handleRegister}
          loading={loading}
          setErrorMsg={setErrorMsg}
          onSwitchToLogin={() => {
            setIsRegistering(false);
            setErrorMsg('');
            setSuccessMsg('');
          }}
        />
      )}
    </div>
  );
}

export default Login;
