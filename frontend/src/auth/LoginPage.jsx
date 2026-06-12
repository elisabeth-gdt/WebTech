import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '../AuthContext';
import './LoginPage.css';

/**
 * LoginPage
 *
 * Three flows:
 *  1. Google Sign-In  (OIDC — uses Google Identity Services SDK loaded via index.html)
 *  2. Passkey login   (existing account)
 *  3. Passkey register (new account)
 */
export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [mode, setMode] = useState('login');   // 'login' | 'register'
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    function showError(msg) { setError(msg); setLoading(false); }

    // ── Google ────────────────────────────────────────────────────────────────

    async function handleGoogleResponse(credentialResponse) {
        setLoading(true); setError('');
        try {
            const res = await fetch('/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: credentialResponse.credential }),
            });
            const data = await res.json();
            if (!res.ok) return showError(data.error || 'Google login failed');
            login(data.token, data.user);
        } catch {
            showError('Network error during Google login');
        }
    }

    function initGoogleButton(el) {
        if (!el || !window.google) return;
        window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(el, {
            theme: 'outline', size: 'large', width: 320,
        });
    }

    // ── Passkey — Register ────────────────────────────────────────────────────

    async function handlePasskeyRegister() {
        if (!email) return showError('Please enter your e-mail address first');
        setLoading(true); setError('');
        try {
            // 1. Get options from server
            const optRes = await fetch('/auth/passkey/register/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const options = await optRes.json();
            if (!optRes.ok) return showError(options.error);

            // 2. Browser creates the passkey
            console.log('options:', options);
            const registrationResponse = await startRegistration(options);

            // 3. Send credential back to server
            const verRes = await fetch('/auth/passkey/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, registrationResponse }),
            });
            const data = await verRes.json();
            if (!verRes.ok) return showError(data.error);
            login(data.token, data.user);
        } catch (err) {
            console.error('startRegistration error:', err);
            showError(err.name === 'NotAllowedError' ? 'Passkey creation was cancelled' : err.message);
        }
    }

    // ── Passkey — Login ───────────────────────────────────────────────────────

    async function handlePasskeyLogin() {
        if (!email) return showError('Please enter your e-mail address first');
        setLoading(true); setError('');
        try {
            // 1. Get challenge
            const optRes = await fetch('/auth/passkey/login/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const options = await optRes.json();
            if (!optRes.ok) return showError(options.error);

            // 2. Browser signs the challenge
            const authenticationResponse = await startAuthentication(options);

            // 3. Verify on server
            const verRes = await fetch('/auth/passkey/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, authenticationResponse }),
            });
            const data = await verRes.json();
            if (!verRes.ok) return showError(data.error);
            login(data.token, data.user);
        } catch (err) {
            showError(err.name === 'NotAllowedError' ? 'Passkey sign-in was cancelled' : err.message);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <h1 className="login-title">TodoApp</h1>
                <p className="login-subtitle">Sign in to your account</p>

                {/* Email input */}
                <input
                    className="login-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                />

                {/* Mode tabs */}
                <div className="login-tabs">
                    <button
                        className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => setMode('login')}
                    >Sign in</button>
                    <button
                        className={`login-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => setMode('register')}
                    >Create account</button>
                </div>

                {mode === 'login' ? (
                    <button className="login-btn primary" onClick={handlePasskeyLogin} disabled={loading}>
                        {loading ? 'Signing in…' : '🔑 Sign in with Passkey'}
                    </button>
                ) : (
                    <button className="login-btn primary" onClick={handlePasskeyRegister} disabled={loading}>
                        {loading ? 'Creating…' : '🔑 Register Passkey'}
                    </button>
                )}

                {error && <p className="login-error">{error}</p>}
            </div>
        </div>
    );
}