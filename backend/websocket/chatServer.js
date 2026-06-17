// backend/websocket/chatServer.js
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Todo = require('../models/Todo');
const { JWT_SECRET } = require('../middleware/auth');

const rooms = new Map();

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

async function canDeleteMessage(user, todoId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const todo = await Todo.findById(todoId).select('ownerId moderators');
  if (!todo) return false;
  if (String(todo.ownerId) === String(user.id)) return true;
  return todo.moderators?.some((m) => String(m) === String(user.id));
}

function setupChatHandler() {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const todoId = url.searchParams.get('todoId');
    const token  = url.searchParams.get('token');
    const user   = verifyToken(token);

    if (!todoId) { ws.close(); return; }

    if (!rooms.has(todoId)) rooms.set(todoId, new Set());
    rooms.get(todoId).add(ws);

    Message.find({ todoId }).sort({ createdAt: 1 }).limit(50)
      .then(messages => {
        ws.send(JSON.stringify({ type: 'HISTORY', messages }));
      });

    ws.on('message', async (raw) => {
      const data = JSON.parse(raw);

      if (data.type === 'DELETE_MESSAGE') {
        if (!await canDeleteMessage(user, todoId)) return;
        await Message.findByIdAndDelete(data.messageId);
        const payload = JSON.stringify({ type: 'MESSAGE_DELETED', messageId: data.messageId });
        for (const client of rooms.get(todoId)) {
          if (client.readyState === 1) client.send(payload);
        }
        return;
      }

      // Standard: neue Nachricht senden
      const { author, text } = data;
      const msg = await Message.create({ todoId, author, text });
      const payload = JSON.stringify({ type: 'NEW_MESSAGE', message: msg });
      for (const client of rooms.get(todoId)) {
        if (client.readyState === 1) client.send(payload);
      }
    });

    ws.on('close', () => {
      rooms.get(todoId)?.delete(ws);
    });
  });

  return {
    handleUpgrade: (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  };
}

module.exports = { setupChatHandler };

// function setupChatServer(httpServer) {
//   // Server OHNE { server: httpServer } erstellen — kein auto-attach
//   const wss = new WebSocketServer({ noServer: true });

//   // Upgrade-Event manuell routen
//   httpServer.on('upgrade', (req, socket, head) => {
//     const url = new URL(req.url, 'http://localhost');

//     // Nur /chat abfangen, /graphql in Ruhe lassen
//     if (url.pathname === '/chat') {
//       wss.handleUpgrade(req, socket, head, (ws) => {
//         wss.emit('connection', ws, req);
//       });
//     }
//     // /graphql wird von graphql-ws selbst behandelt — hier nichts tun
//   });

//   wss.on('connection', (ws, req) => {
//     const url = new URL(req.url, 'http://localhost');
//     const todoId = url.searchParams.get('todoId');

//     if (!todoId) { ws.close(); return; }

//     if (!rooms.has(todoId)) rooms.set(todoId, new Set());
//     rooms.get(todoId).add(ws);

//     Message.find({ todoId }).sort({ createdAt: 1 }).limit(50)
//       .then(messages => {
//         ws.send(JSON.stringify({ type: 'HISTORY', messages }));
//       });

//     ws.on('message', async (data) => {
//       const { author, text } = JSON.parse(data);
//       const msg = await Message.create({ todoId, author, text });

//       const payload = JSON.stringify({ type: 'NEW_MESSAGE', message: msg });
//       for (const client of rooms.get(todoId)) {
//         if (client.readyState === 1) client.send(payload);
//       }
//     });

//     ws.on('close', () => {
//       rooms.get(todoId)?.delete(ws);
//     });
//   });
// }

// module.exports = { setupChatServer };