import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../AuthContext';
import './UserMenu.css';

const ROLE_COLORS = {
  admin:     '#c0392b',
  moderator: '#8e44ad',
  user:      '#27ae60',
};

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    function handler(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  }

  if (!user) return null;

  const label = user.displayName || user.email || '?';
  const initials = label.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <>
      <button className="user-avatar-btn" ref={btnRef} onClick={handleOpen} aria-label="User menu">
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt={user.displayName} className="user-avatar-img" />
          : <span className="user-avatar-initials">{initials}</span>
        }
      </button>

      {open && createPortal(
        <div
          className="user-dropdown"
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right }}
        >
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
        </div>,
        document.body
      )}
    </>
  );
}
