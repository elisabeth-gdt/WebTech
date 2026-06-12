import { useAuth } from '../AuthContext';
import LoginPage from './LoginPage';

/**
 * Wraps any route that requires authentication.
 * Shows a loading spinner while the token is being verified,
 * then either renders children or the login page.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#f8f9fa',
      }}>
        <span style={{ color: '#888', fontSize: '1rem' }}>Loading…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return children;
}