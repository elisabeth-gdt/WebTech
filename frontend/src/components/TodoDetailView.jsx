import { useState } from 'react'
import { useQuery, useMutation, useSubscription } from '@apollo/client/react'
import {
  TODO_DETAIL,
  GET_USERS,
  ADD_COMMENT,
  ADD_CHECKLIST_ITEM,
  UPDATE_CHECKLIST_ITEM,
  DELETE_CHECKLIST_ITEM,
  ADD_ATTACHMENT,
  DELETE_ATTACHMENT,
  ADD_COLLABORATOR,
  REMOVE_COLLABORATOR,
  ADD_TODO_MODERATOR,
  REMOVE_TODO_MODERATOR,
  DELETE_COMMENT,
  TODO_UPDATED,
  TODO_DELETED,
} from '../graphql/todos'
import { useAuth } from '../AuthContext'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function TodoDetailView({ todoId, onClose, onEdit }) {
  const { user: currentUser } = useAuth()

  const { data, loading, error, refetch } = useQuery(TODO_DETAIL, {
    variables: { id: todoId },
    skip: !todoId,
    fetchPolicy: 'network-only',
  })

  useSubscription(TODO_UPDATED, { onData: () => { if (todoId) refetch() } })
  useSubscription(TODO_DELETED, { onData: () => { if (todoId) refetch() } })

  const { data: usersData, error: usersError } = useQuery(GET_USERS, {
    skip: !todoId,
    fetchPolicy: 'network-only',
  })

  const [addComment] = useMutation(ADD_COMMENT)
  const [addChecklistItem] = useMutation(ADD_CHECKLIST_ITEM)
  const [updateChecklistItem] = useMutation(UPDATE_CHECKLIST_ITEM)
  const [deleteChecklistItem] = useMutation(DELETE_CHECKLIST_ITEM)
  const [addAttachment] = useMutation(ADD_ATTACHMENT)
  const [deleteAttachment] = useMutation(DELETE_ATTACHMENT)
  const [addCollaborator] = useMutation(ADD_COLLABORATOR)
  const [removeCollaborator] = useMutation(REMOVE_COLLABORATOR)
  const [addTodoModerator] = useMutation(ADD_TODO_MODERATOR)
  const [removeTodoModerator] = useMutation(REMOVE_TODO_MODERATOR)
  const [deleteComment] = useMutation(DELETE_COMMENT)

  const [commentForm, setCommentForm] = useState({ author: '', text: '' })
  const [checklistForm, setChecklistForm] = useState({ label: '', description: '' })
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [mutationError, setMutationError] = useState('')

  if (!todoId) return null
  if (loading) return <div className="detail-panel"><p>Lade Details...</p></div>
  if (error) return <div className="detail-panel"><p>Fehler beim Laden: {error.message}</p></div>
  if (!loading && data && !data.todo) return (
    <div className="detail-panel">
      <div style={{ padding: '20px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '10px', color: '#92400e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Kein Zugriff mehr</strong>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#92400e' }}>✕</button>
          )}
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>Du wurdest aus diesem To-Do entfernt oder es wurde gelöscht.</p>
      </div>
    </div>
  )

  const todo = data.todo
  const isOwner = currentUser && String(todo.ownerId) === String(currentUser.id)
  const moderatorIds = todo.moderators ?? []
  const isTodoModerator = currentUser && moderatorIds.some((m) => String(m) === String(currentUser.id))
  const canDeleteComments = isOwner || isTodoModerator || currentUser?.role === 'admin'
  const allUsers = usersData?.users ?? []
  const collaboratorIds = todo.collaborators ?? []
  const nonCollaborators = allUsers.filter(
    (u) => !collaboratorIds.includes(u.id) && u.id !== String(todo.ownerId)
  )
  const searchResults = userSearch.trim().length > 0
    ? nonCollaborators.filter((u) => {
        const q = userSearch.toLowerCase()
        return (u.displayName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      })
    : []

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentForm.text.trim()) return
    try {
      await addComment({
        variables: {
          todoId,
          text: commentForm.text.trim(),
          author: commentForm.author.trim() || null,
        },
      })
      setCommentForm({ author: '', text: '' })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleAddChecklistItem = async (e) => {
    e.preventDefault()
    if (!checklistForm.label.trim()) return
    try {
      await addChecklistItem({
        variables: {
          todoId,
          label: checklistForm.label.trim(),
          description: checklistForm.description.trim() || '',
        },
      })
      setChecklistForm({ label: '', description: '' })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleToggleChecklist = async (itemId, checked) => {
    try {
      await updateChecklistItem({ variables: { todoId, itemId, checked: !checked } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleDeleteChecklistItem = async (itemId) => {
    try {
      await deleteChecklistItem({ variables: { todoId, itemId } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`http://localhost:4000/files/upload/${todoId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Upload fehlgeschlagen (${response.status})`)
      }
      const { filename, originalname, url } = await response.json()
      await addAttachment({ variables: { todoId, filename, originalname, url } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment({ variables: { todoId, attachmentId } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleAddCollaborator = async () => {
    if (!selectedUserId) return
    try {
      await addCollaborator({ variables: { todoId, userId: selectedUserId } })
      setSelectedUserId('')
      setUserSearch('')
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleRemoveCollaborator = async (userId) => {
    try {
      await removeCollaborator({ variables: { todoId, userId } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleAddTodoModerator = async (userId) => {
    try {
      await addTodoModerator({ variables: { todoId, userId } })
      await refetch()
    } catch (err) { setMutationError(err.message) }
  }

  const handleRemoveTodoModerator = async (userId) => {
    try {
      await removeTodoModerator({ variables: { todoId, userId } })
      await refetch()
    } catch (err) { setMutationError(err.message) }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment({ variables: { todoId, commentId } })
      await refetch()
    } catch (err) {
      setMutationError(err.message)
    }
  }

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{todo.title}</h2>
        {isOwner && (
          <button
            onClick={() => onEdit(todo)}
            style={{ background: '#3b82f6', color: 'white', padding: '8px 14px', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
          >
            Bearbeiten
          </button>
        )}
      </div>
      {mutationError && (
        <div style={{ background: '#fee2e2', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: '#991b1b' }}>
          <span>Fehler: {mutationError}</span>
          <button onClick={() => setMutationError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#991b1b' }}>✕</button>
        </div>
      )}
      <p><strong>Status:</strong> {todo.status}</p>
      <p><strong>Priorität:</strong> {todo.priority}</p>
      <p><strong>Fällig:</strong> {formatDate(todo.dueDate)}</p>
      <p><strong>Tags:</strong> {todo.tags?.length ? todo.tags.join(', ') : '-'}</p>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Mitarbeiter</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {/* Owner */}
        {(() => {
          const owner = allUsers.find((x) => String(x.id) === String(todo.ownerId))
          return (
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px', marginBottom: '6px' }}>
              <span>
                {owner ? (owner.displayName || owner.email) : todo.ownerId}
                <span style={{ marginLeft: '8px', background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem' }}>Eigentümer</span>
              </span>
            </li>
          )
        })()}

        {/* Moderatoren */}
        {moderatorIds.map((uid) => {
          const u = allUsers.find((x) => String(x.id) === String(uid))
          return (
            <li key={`mod-${uid}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px', marginBottom: '6px' }}>
              <span>
                {u ? (u.displayName || u.email) : uid}
                <span style={{ marginLeft: '8px', background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem' }}>Moderator</span>
              </span>
              {isOwner && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleRemoveTodoModerator(uid)} style={{ background: '#6b7280', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem' }}>Degradieren</button>
                  <button onClick={() => handleRemoveCollaborator(uid)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem' }}>Entfernen</button>
                </div>
              )}
            </li>
          )
        })}

        {/* Collaboratoren (keine Moderatoren) */}
        {collaboratorIds.filter((uid) => !moderatorIds.some((m) => String(m) === String(uid))).map((uid) => {
          const u = allUsers.find((x) => String(x.id) === String(uid))
          return (
            <li key={`col-${uid}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px', marginBottom: '6px' }}>
              <span>{u ? (u.displayName || u.email) : uid}</span>
              {isOwner && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleAddTodoModerator(uid)} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem' }}>Moderator</button>
                  <button onClick={() => handleRemoveCollaborator(uid)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem' }}>Entfernen</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Nutzer hinzufügen */}
      {isOwner && (
        <div style={{ marginTop: '10px' }}>
          {usersError && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>Fehler beim Laden der Nutzer: {usersError.message}</p>}
          <input
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setSelectedUserId('') }}
            placeholder="Mitarbeiter suchen (Name oder E-Mail)..."
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
          {userSearch.trim().length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0 0', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              {searchResults.length === 0 && (
                <li style={{ padding: '10px', color: '#999', fontSize: '0.9rem' }}>Kein Nutzer gefunden</li>
              )}
              {searchResults.map((u) => (
                <li key={u.id} onClick={() => setSelectedUserId(u.id)} style={{ padding: '10px', cursor: 'pointer', background: selectedUserId === u.id ? '#dbeafe' : 'white', borderBottom: '1px solid #f3f4f6', fontSize: '0.9rem' }}>
                  <strong>{u.displayName || u.email}</strong>
                  {u.displayName && <span style={{ color: '#6b7280', marginLeft: '8px' }}>{u.email}</span>}
                </li>
              ))}
            </ul>
          )}
          {selectedUserId && (
            <button onClick={handleAddCollaborator} style={{ marginTop: '8px', background: '#10b981', color: 'white', border: 'none', padding: '8px 14px', cursor: 'pointer', borderRadius: '8px' }}>
              {(() => {
                const u = allUsers.find((x) => String(x.id) === String(selectedUserId))
                return `${u?.displayName || u?.email || 'Nutzer'} hinzufügen`
              })()}
            </button>
          )}
        </div>
      )}

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Dateien</h3>
      {todo.attachments?.length ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {todo.attachments.map((att) => (
            <li key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px', marginBottom: '8px' }}>
              <div>
                <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                  📎 {att.originalname}
                </a>
                <small style={{ display: 'block', color: '#999' }}>{formatDate(att.uploadedAt)}</small>
              </div>
              <button
                onClick={() => handleDeleteAttachment(att.id)}
                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999' }}>Keine Dateien</p>
      )}
      <form style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Datei hinzufügen</h4>
        <input type="file" onChange={handleFileUpload} style={{ flex: 1 }} />
      </form>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Checkliste</h3>
      {todo.checklistItems?.length ? (
        <ul>
          {todo.checklistItems.map((item) => (
            <li key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', padding: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '10px' }}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggleChecklist(item.id, item.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <strong style={{ textDecoration: item.checked ? 'line-through' : 'none' }}>{item.label}</strong>
                {item.description && <p style={{ fontSize: '0.9rem', margin: '4px 0 0 0' }}>{item.description}</p>}
              </div>
              <button onClick={() => handleDeleteChecklistItem(item.id)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999' }}>Keine Checklistenpunkte</p>
      )}
      <form onSubmit={handleAddChecklistItem} className="todo-form" style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Checklistenpunkt hinzufügen</h4>
        <label>
          Label
          <input
            value={checklistForm.label}
            onChange={(e) => setChecklistForm({ ...checklistForm, label: e.target.value })}
            placeholder="z.B. Einkaufen"
            required
          />
        </label>
        <label>
          Beschreibung (optional)
          <input
            value={checklistForm.description}
            onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
            placeholder="Details..."
          />
        </label>
        <button type="submit">Hinzufügen</button>
      </form>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />

      <h3>Kommentare</h3>
      {todo.comments?.length ? (
        <ul>
          {todo.comments.map((comment) => (
            <li key={comment.id} style={{ background: 'rgba(255,255,255,0.6)', padding: '10px', borderRadius: '10px', marginBottom: '8px', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>{comment.author || 'Anonym'}:</strong> {comment.text}
                <small style={{ display: 'block', marginTop: '4px', color: '#999' }}>
                  {formatDate(comment.createdAt)}
                </small>
              </div>
              {canDeleteComments && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  style={{ background: '#dc2626', color: 'white', border: 'none', padding: '3px 8px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', flexShrink: 0 }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999' }}>Keine Kommentare</p>
      )}
      <form onSubmit={handleAddComment} className="todo-form" style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '12px', borderRadius: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Kommentar hinzufügen</h4>
        <label>
          Autor
          <input
            value={commentForm.author}
            onChange={(e) => setCommentForm({ ...commentForm, author: e.target.value })}
            placeholder="Optional"
          />
        </label>
        <label>
          Kommentar
          <textarea
            value={commentForm.text}
            onChange={(e) => setCommentForm({ ...commentForm, text: e.target.value })}
            placeholder="Schreibe einen Kommentar..."
            rows={3}
            required
          />
        </label>
        <button type="submit">Kommentar hinzufügen</button>
      </form>

      <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }} />
    </div>
  )
}
