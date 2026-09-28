import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

// Hook Custom
import { useAuth } from '../../hooks/auth/useAuth';

function Login({ onLoginSuccess }) {
  const {
    isRegistering,
    errorMsg,
    successMsg,
    loading,
    setErrorMsg,
    handleLogin,
    handleRegister,
    switchToRegister,
    switchToLogin
  } = useAuth(onLoginSuccess);

  return (
    <div style={{
      maxWidth: '450px',
      margin: '40px auto',
      padding: '24px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      fontFamily: 'sans-serif',
      backgroundColor: '#fff'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        {isRegistering ? 'New User Registration' : 'User Login'}
      </h2>

      {errorMsg && (
        <div style={{
          color: '#721c24',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{
          color: '#0f5132',
          backgroundColor: '#d1e7dd',
          border: '1px solid #badbcc',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          {successMsg}
        </div>
      )}

      {!isRegistering ? (
        <LoginForm
          onSubmit={handleLogin}
          loading={loading}
          onSwitchToRegister={switchToRegister}
        />
      ) : (
        <RegisterForm
          onSubmit={handleRegister}
          loading={loading}
          setErrorMsg={setErrorMsg}
          onSwitchToLogin={switchToLogin}
        />
      )}
    </div>
  );
}

export default Login;
