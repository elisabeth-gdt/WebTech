import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import {
  TODO_DETAIL,
  ADD_COMMENT,
  ADD_CHECKLIST_ITEM,
  UPDATE_CHECKLIST_ITEM,
  DELETE_CHECKLIST_ITEM,
  ADD_ATTACHMENT,
  DELETE_ATTACHMENT,
} from '../graphql/todos'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function TodoDetailView({ todoId, onClose, onEdit }) {
  const { data, loading, error, refetch } = useQuery(TODO_DETAIL, {
    variables: { id: todoId },
    skip: !todoId,
  })

  const [addComment] = useMutation(ADD_COMMENT)
  const [addChecklistItem] = useMutation(ADD_CHECKLIST_ITEM)
  const [updateChecklistItem] = useMutation(UPDATE_CHECKLIST_ITEM)
  const [deleteChecklistItem] = useMutation(DELETE_CHECKLIST_ITEM)
  const [addAttachment] = useMutation(ADD_ATTACHMENT)
  const [deleteAttachment] = useMutation(DELETE_ATTACHMENT)

  const [commentForm, setCommentForm] = useState({ author: '', text: '' })
  const [checklistForm, setChecklistForm] = useState({ label: '', description: '' })

  if (!todoId) return null
  if (loading) return <div className="detail-panel"><p>Lade Details...</p></div>
  if (error) return <div className="detail-panel"><p>Fehler beim Laden: {error.message}</p></div>
  if (!data?.todo) return <div className="detail-panel"><p>To-Do nicht gefunden.</p></div>

  const todo = data.todo

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
    } catch (error) {
      console.error('Fehler beim Kommentar:', error)
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
    } catch (error) {
      console.error('Fehler beim Checklistenpunkt:', error)
    }
  }

  const handleToggleChecklist = async (itemId, checked) => {
    try {
      await updateChecklistItem({ variables: { todoId, itemId, checked: !checked } })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Update:', error)
    }
  }

  const handleDeleteChecklistItem = async (itemId) => {
    try {
      await deleteChecklistItem({ variables: { todoId, itemId } })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await fetch(`http://localhost:4000/files/upload/${todoId}`, {
        method: 'POST',
        body: formData,
      })
      const { filename, originalname, url } = await response.json()
      await addAttachment({ variables: { todoId, filename, originalname, url } })
      await refetch()
    } catch (error) {
      console.error('Upload-Fehler:', error)
    }
  }

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment({ variables: { todoId, attachmentId } })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{todo.title}</h2>
        <button
          onClick={() => onEdit(todo)}
          style={{ background: '#3b82f6', color: 'white', padding: '8px 14px', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
        >
          Bearbeiten
        </button>
      </div>
      <p><strong>Status:</strong> {todo.status}</p>
      <p><strong>Priorität:</strong> {todo.priority}</p>
      <p><strong>Fällig:</strong> {formatDate(todo.dueDate)}</p>
      <p><strong>Tags:</strong> {todo.tags?.length ? todo.tags.join(', ') : '-'}</p>

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
            <li key={comment.id} style={{ background: 'rgba(255,255,255,0.6)', padding: '10px', borderRadius: '10px', marginBottom: '8px', listStyle: 'none' }}>
              <strong>{comment.author || 'Anonym'}:</strong> {comment.text}
              <small style={{ display: 'block', marginTop: '4px', color: '#999' }}>
                {formatDate(comment.createdAt)}
              </small>
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
