import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { saveTodos, loadTodos } from './db.js';
import { TodoCard } from './components/ToDoCard.jsx';
import { ChatWindow } from './components/ChatWindow.jsx';

import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import UserMenu from './auth/UserMenu.jsx';

const TODOS_QUERY = gql`
  query {
    todos {
      id title status priority
    }
  }
`;

// Deine bestehende App-Logik — in eigene Komponente ausgelagert
function AppContent() {
  const [todos, setTodos] = useState([]);
  const [selectedTodoId, setSelectedTodoId] = useState(null);
  const { data, loading } = useQuery(TODOS_QUERY);

  useEffect(() => {
    if (data?.todos) {
      setTodos(data.todos);
      saveTodos(data.todos);
    }
  }, [data]);

  useEffect(() => {
    if (loading) return;
    loadTodos().then(setTodos);
  }, [loading]);

  return (
    <div style={{ padding: '20px' }}>
      {/* NEU: User-Menü rechts oben */}
      {/* NEU: User-Menü rechts oben */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Todos</h1>
        <UserMenu />
      </div>

      {/* Dein bestehender Inhalt — unverändert */}
      <div id="todo-list">
        {todos.map(todo => (
          <TodoCard
            key={todo.id}
            todo={todo}
            onOpenChat={() => setSelectedTodoId(todo.id)}
          />
        ))}
      </div>
      {selectedTodoId && (
        <ChatWindow todoId={selectedTodoId} onClose={() => setSelectedTodoId(null)} />
      )}
    </div>
  );
}

// NEU: AuthProvider und ProtectedRoute wrappen alles
export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}