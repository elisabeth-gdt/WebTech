import { saveMessages, loadMessages } from './db.js';

export class ChatClient {
  constructor(todoId, onMessage, onMessageDeleted) {
    this.todoId = todoId;
    this.onMessage = onMessage;
    this.onMessageDeleted = onMessageDeleted;
    this.ws = null;
    this.connect();
  }

  connect() {
    const token = localStorage.getItem('auth_token') ?? '';
    const wsUrl = `ws://localhost:4000/chat?todoId=${this.todoId}&token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'HISTORY') {
        await saveMessages(data.messages);
        data.messages.forEach(msg => this.onMessage(msg));
      }

      if (data.type === 'NEW_MESSAGE') {
        await saveMessages([data.message]);
        this.onMessage(data.message);
      }

      if (data.type === 'MESSAGE_DELETED') {
        this.onMessageDeleted?.(data.messageId);
      }
    };

    this.ws.onerror = async () => {
      console.warn('WebSocket nicht erreichbar, lade lokale Nachrichten');
      const cached = await loadMessages(this.todoId);
      cached.forEach(msg => this.onMessage(msg));
    };
  }

  send(author, text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ author, text }));
    }
  }

  deleteMessage(messageId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'DELETE_MESSAGE', messageId }));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
