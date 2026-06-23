const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const Todo = require('../models/Todo.js');
const mongoose = require('mongoose');

let server;
const ownerId = new mongoose.Types.ObjectId().toString();
const user = { id: ownerId, email: 'owner@test.de', role: 'user' };

beforeAll(async () => { server = await startTestServer('todos_test_mutations'); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); });

// --- createTodo ---

test('createTodo erstellt ein Todo mit Pflichtfeldern', async () => {
  const { data, errors } = await execute(server, `
    mutation {
      createTodo(input: { title: "Neues Todo" }) {
        id title status
      }
    }
  `, {}, user);
  expect(errors).toBeUndefined();
  expect(data.createTodo.title).toBe('Neues Todo');
  expect(data.createTodo.status).toBe('OPEN');   // Default-Wert
  expect(data.createTodo.id).toBeDefined();
});

test('createTodo speichert optionale Felder', async () => {
  const { data } = await execute(server, `
    mutation {
      createTodo(input: {
        title: "Todo mit Extras"
        priority: HIGH
        tags: ["arbeit", "dringend"]
      }) {
        id title priority tags
      }
    }
  `, {}, user);
  expect(data.createTodo.priority).toBe('HIGH');
  expect(data.createTodo.tags).toEqual(['arbeit', 'dringend']);
});

test('createTodo schlägt fehl wenn Titel fehlt', async () => {
  const { errors } = await execute(server, `
    mutation { createTodo(input: {}) { id } }
  `, {}, user);
  expect(errors).toBeDefined();
});

test('createTodo schlägt fehl ohne Authentifizierung', async () => {
  const { errors } = await execute(server, `
    mutation { createTodo(input: { title: "Hack" }) { id } }
  `);
  expect(errors).toBeDefined();
  expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
});

// --- updateTodo ---

test('updateTodo ändert Status eines Todos', async () => {
  const todo = await Todo.create({ title: 'Zu updatendes Todo', priority: 'MEDIUM', ownerId });

  const { data } = await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id status }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } }, user);

  expect(data.updateTodo.status).toBe('DONE');
});

test('updateTodo legt Bearbeitungsverlauf an', async () => {
  const todo = await Todo.create({ title: 'Todo', status: 'OPEN', priority: 'LOW', ownerId });

  await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } }, user);

  // Direkt in DB prüfen
  const updated = await Todo.findById(todo._id);
  expect(updated.history).toHaveLength(1);
  expect(updated.history[0].field).toBe('status');
  expect(updated.history[0].oldValue).toBe('OPEN');
  expect(updated.history[0].newValue).toBe('DONE');
});

test('updateTodo schlägt fehl für fremden Nutzer', async () => {
  const todo = await Todo.create({ title: 'Fremdes Todo', priority: 'LOW', ownerId });
  const otherUser = { id: new mongoose.Types.ObjectId().toString(), email: 'other@test.de', role: 'user' };

  const { errors } = await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } }, otherUser);

  expect(errors).toBeDefined();
  expect(errors[0].extensions.code).toBe('FORBIDDEN');
});

// --- deleteTodo ---

test('deleteTodo entfernt ein Todo aus der Datenbank', async () => {
  const todo = await Todo.create({ title: 'Zu löschendes Todo', ownerId });

  const { data } = await execute(server, `
    mutation DeleteTodo($id: ID!) { deleteTodo(id: $id) }
  `, { id: todo._id.toString() }, user);

  expect(data.deleteTodo).toBe(true);
  const found = await Todo.findById(todo._id);
  expect(found).toBeNull();
});

// --- addComment ---

test('addComment fügt Kommentar zu Todo hinzu', async () => {
  const todo = await Todo.create({ title: 'Todo mit Kommentar', ownerId });

  const { data } = await execute(server, `
    mutation AddComment($todoId: ID!, $text: String!) {
      addComment(todoId: $todoId, text: $text, author: "Alice") {
        id comments { id text author }
      }
    }
  `, { todoId: todo._id.toString(), text: 'Mein Kommentar' }, user);

  expect(data.addComment.comments).toHaveLength(1);
  expect(data.addComment.comments[0].text).toBe('Mein Kommentar');
  expect(data.addComment.comments[0].author).toBe('Alice');
});