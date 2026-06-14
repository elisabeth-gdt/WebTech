import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useSubscription } from '@apollo/client/react'
import { ChatWindow } from './ChatWindow'
import { TodoDetailView } from './TodoDetailView'
import { EditView } from './EditView'
import UserMenu from '../auth/UserMenu'
import {
  GET_TODOS,
  CREATE_TODO,
  UPDATE_TODO,
  DELETE_TODO,
  TODO_CREATED,
  TODO_UPDATED,
  TODO_DELETED,
} from '../graphql/todos'

function emptyTodoForm() {
  return { title: '', priority: 'MEDIUM', dueDate: '', tags: '', status: 'OPEN' }
}

export function TodoList() {
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [priority, setPriority] = useState('')
  const [createForm, setCreateForm] = useState(emptyTodoForm())
  const [detailTodoId, setDetailTodoId] = useState(null)
  const [editingTodo, setEditingTodo] = useState(null)
  const [openChats, setOpenChats] = useState(new Set())
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [errorMessage, setErrorMessage] = useState('')

  const { data, loading, error, refetch } = useQuery(GET_TODOS, {
    variables: { status: status || null, tag: tag || null, priority: priority || null },
    fetchPolicy: 'cache-and-network',
  })

  const todos = useMemo(() => data?.todos || [], [data])

  const [createTodo] = useMutation(CREATE_TODO)
  const [updateTodo] = useMutation(UPDATE_TODO)
  const [deleteTodo] = useMutation(DELETE_TODO)

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setErrorMessage('') }
    const handleOffline = () => { setIsOnline(false); setErrorMessage('Du bist offline - einige Funktionen sind nicht verfügbar') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  const checkOnline = async () => {
    if (!isOnline) {
      setErrorMessage('⚠️ Du bist offline - diese Aktion ist nicht möglich')
      setTimeout(() => setErrorMessage(''), 4000)
      return false
    }
    return true
  }

  useSubscription(TODO_CREATED, { onData: () => refetch() })
  useSubscription(TODO_UPDATED, { onData: () => refetch() })
  useSubscription(TODO_DELETED, { onData: () => { refetch(); setDetailTodoId(null) } })

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!await checkOnline()) return
    try {
      await createTodo({
        variables: {
          input: {
            title: createForm.title,
            priority: createForm.priority || 'MEDIUM',
            dueDate: createForm.dueDate || null,
            tags: createForm.tags ? createForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          },
        },
      })
      setCreateForm(emptyTodoForm())
      await refetch()
    } catch (error) {
      console.error('Fehler beim Erstellen:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Wirklich löschen?')) return
    if (!await checkOnline()) return
    try {
      await deleteTodo({ variables: { id } })
      await refetch()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  const handleUpdate = async (input) => {
    if (!await checkOnline()) return
    try {
      await updateTodo({ variables: { id: editingTodo.id, input: { ...input, priority: input.priority || 'MEDIUM' } } })
      await refetch()
      setDetailTodoId(editingTodo.id)
      setEditingTodo(null)
    } catch (error) {
      console.error('Fehler beim Update:', error)
    }
  }

  return (
    <div className="page">
      {errorMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '0 0 8px 8px', borderBottom: '2px solid #dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>To-Do Übersicht</h1>
          <p>GraphQL-Frontend mit Live-Updates</p>
        </div>
        <UserMenu />
      </header>

      <section className="todo-form-panel">
        <h2>Neues To-Do</h2>
        <form onSubmit={handleCreateSubmit} className="todo-form">
          <label>
            Titel
            <input value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titel eingeben" required />
          </label>
          <label>
            Priorität
            <select value={createForm.priority} onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </label>
          <label>
            Fälligkeitsdatum
            <input type="date" value={createForm.dueDate} onChange={(e) => setCreateForm((p) => ({ ...p, dueDate: e.target.value }))} />
          </label>
          <label>
            Tags
            <input value={createForm.tags} onChange={(e) => setCreateForm((p) => ({ ...p, tags: e.target.value }))} placeholder="tag1, tag2, tag3" />
          </label>
          <button type="submit">To-Do erstellen</button>
        </form>
      </section>

      <section className="filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        </label>
        <label>
          Tag
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="z. B. uni" />
        </label>
        <label>
          Priorität
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Alle</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
      </section>

      <section className="todo-list-section">
        <h2>Übersicht</h2>
        {loading && <p>Lade To-Dos...</p>}
        {error && <p>Fehler beim Laden: {error.message}</p>}
        {!loading && !error && todos.length === 0 && <p>Keine To-Dos gefunden.</p>}
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className="todo-item">
              <div className="todo-info" onClick={() => { setDetailTodoId(todo.id); setEditingTodo(null) }}>
                <strong>{todo.title}</strong>
                <span className="status">{todo.status}</span>
                {todo.priority && <small className="priority">{todo.priority}</small>}
              </div>
              <div className="todo-actions">
                <button onClick={(e) => { e.stopPropagation(); setEditingTodo(todo) }} style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', border: 'none', cursor: 'pointer', marginRight: '5px', borderRadius: '8px', fontSize: '0.9rem' }}>Bearbeiten</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(todo.id) }} style={{ background: '#dc2626', color: 'white', padding: '6px 12px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem' }}>Löschen</button>
                <button onClick={(e) => { e.stopPropagation(); setOpenChats((prev) => new Set([...prev, todo.id])) }} style={{ background: '#8b5cf6', color: 'white', padding: '6px 12px', border: 'none', cursor: 'pointer', marginLeft: '5px', borderRadius: '8px', fontSize: '0.9rem' }}>Chat</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {editingTodo && (
        <EditView todo={editingTodo} onSave={handleUpdate} onCancel={() => setEditingTodo(null)} />
      )}

      {detailTodoId && !editingTodo && (
        <TodoDetailView todoId={detailTodoId} onEdit={(todo) => setEditingTodo(todo)} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginTop: '16px' }}>
        {Array.from(openChats).map((todoId) => {
          const todo = todos.find((t) => t.id === todoId)
          return (
            <div key={todoId} style={{ border: '2px solid #8b5cf6', borderRadius: '8px', padding: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0' }}>💬 Chat: {todo?.title}</h3>
              <ChatWindow todoId={todoId} onClose={() => setOpenChats((prev) => { const next = new Set(prev); next.delete(todoId); return next })} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
