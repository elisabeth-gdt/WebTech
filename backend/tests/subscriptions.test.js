const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const { pubsub, EVENTS } = require('../pubsub');
const Todo = require('../models/Todo.js');
const mongoose = require('mongoose');

let server;
const ownerId = new mongoose.Types.ObjectId().toString();
const user = { id: ownerId, email: 'owner@test.de', role: 'user' };

beforeAll(async () => { server = await startTestServer('todos_test_subscriptions'); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); });

test('todoCreated-Subscription feuert wenn createTodo aufgerufen wird', async () => {
  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_CREATED]);

  // Mutation ausführen
  const mutationPromise = execute(server, `
    mutation { createTodo(input: { title: "Subscription Test" }) { id } }
  `, {}, user);

  // Auf Event warten (mit Timeout)
  const { value } = await Promise.race([
    iterator.next(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Event nicht empfangen')), 1000)
    )
  ]);

  await mutationPromise;

  expect(value.todoCreated.title).toBe('Subscription Test');
  expect(value.todoCreated.status).toBe('OPEN');
}, 10000);

test('todoUpdated-Subscription feuert bei Statusänderung', async () => {
  const todo = await Todo.create({ title: 'Todo für Subscription', ownerId });

  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_UPDATED]);

  const [{ value }] = await Promise.all([
    Promise.race([
      iterator.next(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Event nicht empfangen')), 2000)
      )
    ]),
    execute(server, `
      mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
        updateTodo(id: $id, input: $input) { id }
      }
    `, { id: todo._id.toString(), input: { status: 'DONE' } }, user)
  ]);

  expect(value.todoUpdated.status).toBe('DONE');
}, 10000);

test('todoDeleted-Subscription liefert die ID des gelöschten Todos', async () => {
  const todo = await Todo.create({ title: 'Zu löschendes Todo', ownerId });

  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_DELETED]);

  const mutationPromise = execute(server, `
    mutation DeleteTodo($id: ID!) { deleteTodo(id: $id) }
  `, { id: todo._id.toString() }, user);

  const { value } = await Promise.race([
    iterator.next(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Event nicht empfangen')), 1000)
    )
  ]);

  await mutationPromise;

  expect(value.todoDeleted).toBe(todo._id.toString());
}, 10000);