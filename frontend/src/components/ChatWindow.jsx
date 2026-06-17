import { useEffect, useState } from 'react';
import { ChatClient } from '../chat.js';
import { saveMessages } from '../db.js';
import { useAuth } from '../AuthContext';

export function ChatWindow({ todoId, ownerId, moderatorIds = [], onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [author, setAuthor] = useState('Anonym');
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const canDelete =
    user?.role === 'admin' ||
    (ownerId && String(ownerId) === String(user?.id)) ||
    moderatorIds.some((m) => String(m) === String(user?.id));

  useEffect(() => {
    let isMounted = true;

    const chatClient = new ChatClient(
      todoId,
      (msg) => {
        if (isMounted) {
          setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
          saveMessages([msg]);
        }
      },
      (messageId) => {
        if (isMounted) {
          setMessages(prev => prev.filter(m => String(m._id) !== String(messageId)));
        }
      }
    );

    chatClient.ws.onopen  = () => { if (isMounted) setIsConnected(true); };
    chatClient.ws.onclose = () => { if (isMounted) setIsConnected(false); };

    setClient(chatClient);
    return () => { isMounted = false; chatClient?.disconnect(); };
  }, [todoId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!isConnected) { alert('Nicht verbunden!'); return; }
    if (!input.trim()) return;
    client?.send(author || 'Anonym', input);
    setInput('');
  };

  const handleDelete = (messageId) => {
    client?.deleteMessage(messageId);
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginTop: '16px', backgroundColor: '#f9fafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? '🟢 Verbunden' : '🔴 Getrennt'}
        </div>
        <button onClick={onClose} style={{ background: '#6b7280', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      <ul style={{ listStyle: 'none', height: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', padding: '8px', marginBottom: '12px', backgroundColor: 'white', borderRadius: '6px' }}>
        {messages.map((msg, i) => (
          <li key={msg._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', gap: '8px' }}>
            <span><strong>{msg.author || 'Anonym'}:</strong> {msg.text}</span>
            {canDelete && (
              <button
                onClick={() => handleDelete(msg._id)}
                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '2px 7px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.75rem', flexShrink: 0 }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Dein Name..."
          maxLength={30}
          style={{ flex: 0.3, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nachricht..."
          style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
        />
        <button type="submit" style={{ background: '#3b82f6', color: 'white', padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          Senden
        </button>
      </form>
    </div>
  );
}
