import { AuthProvider } from './AuthContext';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import { TodoList } from './components/ToDoList.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <TodoList />
      </ProtectedRoute>
    </AuthProvider>
  );
}