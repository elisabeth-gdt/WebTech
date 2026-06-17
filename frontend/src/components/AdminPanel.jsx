import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { GET_USERS, SET_USER_ROLE } from '../graphql/todos'
import { useAuth } from '../AuthContext'

const ROLE_STYLE = {
  admin:     { background: '#fef2f2', color: '#b91c1c' },
  moderator: { background: '#faf5ff', color: '#7e22ce' }, // legacy, kann noch existieren
  user:      { background: '#f0fdf4', color: '#15803d' },
}

export function AdminPanel({ onClose }) {
  const { user: currentUser } = useAuth()
  const { data, loading, error, refetch } = useQuery(GET_USERS, { fetchPolicy: 'no-cache' })
  const [setUserRole] = useMutation(SET_USER_ROLE)

  // lokale Kopie der Rollen { userId: role }
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // pending initialisieren sobald User geladen
  useEffect(() => {
    if (data?.users) {
      const init = {}
      data.users.forEach((u) => { init[u.id] = u.role })
      setPending(init)
    }
  }, [data])

  const hasChanges = data?.users?.some((u) => pending[u.id] && pending[u.id] !== u.role)

  const handleSaveAll = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const toUpdate = (data?.users ?? []).filter(
        (u) => pending[u.id] && pending[u.id] !== u.role
      )
      await Promise.all(
        toUpdate.map((u) => setUserRole({ variables: { userId: u.id, role: pending[u.id] } }))
      )
      await refetch()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Nutzerverwaltung</h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#374151' }}>✕</button>
        </div>

        {/* Feedback */}
        {saveError && (
          <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem', flexShrink: 0 }}>
            Fehler: {saveError}
          </div>
        )}
        {saveSuccess && (
          <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '0.85rem', flexShrink: 0 }}>
            Änderungen gespeichert.
          </div>
        )}

        {/* Tabellen-Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', gap: '0', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          {['Nutzer', 'Aktuelle Rolle', 'Neue Rolle'].map((h) => (
            <div key={h} style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
          ))}
        </div>

        {/* Zeilen */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ padding: '20px 24px', color: '#6b7280', margin: 0 }}>Lade Nutzer...</p>}
          {error && <p style={{ padding: '20px 24px', color: '#dc2626', margin: 0 }}>Fehler: {error.message}</p>}

          {data?.users?.map((u) => {
            const isSelf = u.id === currentUser?.id
            const currentRole = u.role
            const selectedRole = pending[u.id] ?? currentRole
            const changed = selectedRole !== currentRole
            const rs = ROLE_STYLE[currentRole] ?? ROLE_STYLE.user

            return (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 130px 130px',
                alignItems: 'center', borderBottom: '1px solid #f3f4f6',
                background: changed ? '#eff6ff' : isSelf ? '#fafafa' : 'white',
              }}>
                {/* Name */}
                <div style={{ padding: '12px 16px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.displayName || u.email}
                    {isSelf && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>(du)</span>}
                  </div>
                  {u.displayName && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  )}
                </div>

                {/* Aktuelle Rolle */}
                <div style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, ...rs }}>
                    {currentRole}
                  </span>
                </div>

                {/* Dropdown */}
                <div style={{ padding: '12px 16px' }}>
                  <select
                    value={selectedRole}
                    disabled={isSelf}
                    onChange={(e) => setPending((p) => ({ ...p, [u.id]: e.target.value }))}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: '8px',
                      border: `1px solid ${changed ? '#3b82f6' : '#e5e7eb'}`,
                      fontSize: '0.85rem', cursor: isSelf ? 'not-allowed' : 'pointer',
                      background: isSelf ? '#f9fafb' : 'white', color: '#374151',
                    }}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}>
            Abbrechen
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!hasChanges || saving}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: hasChanges ? '#3b82f6' : '#e5e7eb',
              color: hasChanges ? 'white' : '#9ca3af',
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {saving ? 'Speichern...' : 'Alle Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
