import { useState, useEffect } from 'react'

function emptyTodoForm() {
  return {
    title: '',
    priority: 'MEDIUM',
    dueDate: '',
    tags: '',
    status: 'OPEN',
  }
}

export function EditView({ todo, onSave, onCancel }) {
  const [form, setForm] = useState(emptyTodoForm())

  useEffect(() => {
    if (todo) {
      setForm({
        title: todo.title || '',
        priority: todo.priority || 'MEDIUM',
        dueDate: todo.dueDate ? todo.dueDate.split('T')[0] : '',
        tags: Array.isArray(todo.tags) ? todo.tags.join(', ') : '',
        status: todo.status || 'OPEN',
      })
    }
  }, [todo])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      title: form.title || undefined,
      priority: form.priority || 'MEDIUM',
      dueDate: form.dueDate || null,
      tags: form.tags ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      status: form.status || 'OPEN',
    })
  }

  return (
    <div className="detail-panel">
      <h2>To-Do bearbeiten</h2>
      <form onSubmit={handleSubmit} className="todo-form">
        <label>
          Titel
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
        </label>

        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
        </label>

        <label>
          Priorität
          <select
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>

        <label>
          Fälligkeitsdatum
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
        </label>

        <label>
          Tags
          <input
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="tag1, tag2, tag3"
          />
        </label>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ background: '#16a34a' }}>Speichern</button>
          <button type="button" onClick={onCancel} style={{ background: '#6b7280' }}>Abbrechen</button>
        </div>
      </form>
    </div>
  )
}
