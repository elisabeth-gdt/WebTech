const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const Todo = require('../models/Todo.js');
const mongoose = require('mongoose');

let server;
const ownerId = new mongoose.Types.ObjectId().toString();
const user = { id: ownerId, email: 'owner@test.de', role: 'user' };

beforeAll(async () => { server = await startTestServer('todos_test_queries'); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); }); // DB nach jedem Test leeren

test('todos gibt leere Liste zurück wenn keine Todos vorhanden', async () => {
  const { data, errors } = await execute(server, `
    query { todos { id title status } }
  `, {}, user);
  expect(errors).toBeUndefined();
  expect(data.todos).toEqual([]);
});

test('todos gibt alle vorhandenen Todos zurück', async () => {
  // Direkt in DB einfügen um den Test unabhängig von Mutations zu halten
  await Todo.create([
    { title: 'Erstes Todo', ownerId },
    { title: 'Zweites Todo', ownerId }
  ]);

  const { data } = await execute(server, `
    query { todos { id title status } }
  `, {}, user);
  expect(data.todos).toHaveLength(2);
});

test('todos kann nach Status gefiltert werden', async () => {
  await Todo.create([
    { title: 'Offenes Todo', status: 'OPEN', ownerId },
    { title: 'Erledigtes Todo', status: 'DONE', ownerId }
  ]);

  const { data } = await execute(server, `
    query GetTodos($status: TodoStatus) {
      todos(status: $status) { id title status }
    }
  `, { status: 'OPEN' }, user);

  expect(data.todos).toHaveLength(1);
  expect(data.todos[0].title).toBe('Offenes Todo');
});

test('todos kann nach Tag gefiltert werden', async () => {
  await Todo.create([
    { title: 'Todo mit Tag', tags: ['arbeit'], ownerId },
    { title: 'Todo ohne Tag', ownerId }
  ]);

  const { data } = await execute(server, `
    query { todos(tag: "arbeit") { id title tags } }
  `, {}, user);
  expect(data.todos).toHaveLength(1);
  expect(data.todos[0].tags).toContain('arbeit');
});

test('todo gibt einzelnes Todo per ID zurück', async () => {
  const created = await Todo.create({ title: 'Einzelnes Todo', ownerId });

  const { data } = await execute(server, `
    query GetTodo($id: ID!) { todo(id: $id) { id title status } }
  `, { id: created._id.toString() }, user);

  expect(data.todo.title).toBe('Einzelnes Todo');
});

test('todo gibt null zurück bei unbekannter ID', async () => {
  const { data } = await execute(server, `
    query { todo(id: "000000000000000000000000") { id title } }
  `, {}, user);
  expect(data.todo).toBeNull();
});