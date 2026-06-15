import { useAuth } from '../AuthContext';

export function TodoCard({ todo, onOpenChat }) {
  const { user } = useAuth();

  // Berechtigungen — spiegeln die Backend-Logik wider (nur für UI-Sichtbarkeit)
  const isOwner      = user?.id === todo.ownerId;
  const isAdmin      = user?.role === 'admin';
  const isCollaborator = todo.collaborators?.includes(user?.id);

  const canEdit    = isOwner || isAdmin;
  const canComment = isOwner || isAdmin || isCollaborator;

  const colors = { OPEN: '#3b82f6', IN_PROGRESS: '#f59e0b', DONE: '#10b981' };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
      {/* Dein bestehender Inhalt — unverändert */}
      <strong>{todo.title}</strong>
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        color: 'white',
        fontSize: '12px',
        background: colors[todo.status]
      }}>
        {todo.status}
      </span>
      {todo.priority && (
        <span style={{ fontSize: '12px', color: '#6b7280' }}>[{todo.priority}]</span>
      )}

      {/* Chat-Button — nur für Kommentarberechtigte sichtbar */}
      {canComment && (
        <button onClick={() => onOpenChat(todo.id)}>Chat öffnen</button>
      )}

      {/* NEU: Bearbeiten/Löschen — nur für Eigentümer und Admins */}
      {canEdit && (
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
          ✏️ Eigentümer
        </span>
      )}
    </div>
  );
}