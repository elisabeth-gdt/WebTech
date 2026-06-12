import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import './UserMenu.css';

const ROLE_COLORS = {
  admin:     '#c0392b',
  moderator: '#8e44ad',
  user:      '#27ae60',
};

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const initials = (user.displayName || user.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-avatar-btn" onClick={() => setOpen((v) => !v)} aria-label="User menu">
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt={user.displayName} className="user-avatar-img" />
          : <span className="user-avatar-initials">{initials}</span>
        }
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-info">
            <strong>{user.displayName || user.email}</strong>
            <span className="user-email">{user.email}</span>
            <span
              className="user-role-badge"
              style={{ background: ROLE_COLORS[user.role] || '#666' }}
            >{user.role}</span>
          </div>
          <hr />
          <button className="user-logout-btn" onClick={logout}>Sign out</button>
        </div>
      )}
    </div>
  );
}