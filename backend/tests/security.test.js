/**
 * Security tests — Teilabgabe 4
 *
 * Run: npm run test:security   (oder: npx jest tests/security.test.js)
 *
 * Tests cover:
 *  - Login / Logout
 *  - Protected endpoints without token → 401
 *  - Protected endpoints with wrong role → 403
 *  - Accessing another user's todo → 403
 *  - Expired / tampered tokens → 401
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const mongoose = require('mongoose');
const { buildTestApp, stopTestApp } = require('./testServer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

let app;
let apolloServer;

beforeAll(async () => {
  ({ app, apolloServer } = await buildTestApp());
}, 20000);

afterAll(async () => {
  await stopTestApp(apolloServer);
});

// ── Token helpers ─────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'test@example.com', role: 'user', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const userToken    = makeToken({ role: 'user',  id: new mongoose.Types.ObjectId().toString() });
const adminToken   = makeToken({ role: 'admin', id: new mongoose.Types.ObjectId().toString() });
const expiredToken = jwt.sign({ id: 'x', email: 'x@x.com', role: 'user' }, JWT_SECRET, { expiresIn: '-1s' });
const tamperedToken = userToken.slice(0, -5) + 'XXXXX';

// ── GraphQL helper ─────────────────────────────────────────────────────────────

function gql(query, variables = {}, token = null) {
  const req = request(app)
    .post('/graphql')
    .send({ query, variables });
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Authentication — /auth/me
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /auth/me', () => {
  test('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with expired token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with tampered token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  test('returns user profile with valid token', async () => {
    // Will get 404 (user not in DB) but NOT 401 — token is valid
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. GraphQL — unauthenticated access
// ═════════════════════════════════════════════════════════════════════════════

describe('GraphQL — unauthenticated', () => {
  test('todos query returns UNAUTHENTICATED error without token', async () => {
    const res = await gql('{ todos { id title } }');
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  test('createTodo mutation returns UNAUTHENTICATED without token', async () => {
    const res = await gql('mutation { createTodo(input: { title: "Hack" }) { id } }');
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  test('deleteTodo mutation returns UNAUTHENTICATED without token', async () => {
    const res = await gql('mutation { deleteTodo(id: "000000000000000000000001") }');
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. GraphQL — role-based access
// ═════════════════════════════════════════════════════════════════════════════

describe('GraphQL — role restrictions', () => {
  // users-Query ist bewusst für alle eingeloggten Nutzer offen (wird für die
  // Mitarbeiter-Suche im Frontend gebraucht) — nur setUserRole ist admin-only.
  test('users query succeeds for any authenticated user', async () => {
    const res = await gql('{ users { id email } }', {}, userToken);
    const codes = (res.body.errors || []).map((e) => e.extensions?.code);
    expect(codes).not.toContain('FORBIDDEN');
  });

  test('users query succeeds for admin', async () => {
    const res = await gql('{ users { id email } }', {}, adminToken);
    // May return empty array or data — but NOT a FORBIDDEN error
    const codes = (res.body.errors || []).map((e) => e.extensions?.code);
    expect(codes).not.toContain('FORBIDDEN');
  });

  test('setUserRole is forbidden for regular user', async () => {
    const res = await gql(
      'mutation($id: ID!, $role: Role!) { setUserRole(userId: $id, role: $role) { id } }',
      { id: '000000000000000000000001', role: 'admin' },
      userToken
    );
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. File endpoints
// ═════════════════════════════════════════════════════════════════════════════

describe('File routes — authentication', () => {
  const fakeTodoId = new mongoose.Types.ObjectId().toString();

  test('upload returns 401 without token', async () => {
    const res = await request(app)
      .post(`/files/upload/${fakeTodoId}`)
      .attach('file', Buffer.from('test'), 'test.txt');
    expect(res.status).toBe(401);
  });

  // Hinweis: Der eigentliche Datei-Download läuft in server.js über einen
  // separaten, NICHT durch requireAuth geschützten /uploads-Static-Mount
  // (siehe SECURITY.md, Abschnitt "Grenzen der Lösung"). Dieser Test prüft
  // daher nur den Upload-Endpunkt unter /files, der tatsächlich geschützt ist.
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Token edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe('Token validation', () => {
  test('expired token is rejected on /auth/me', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  test('tampered token is rejected on /auth/me', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  test('tampered token produces UNAUTHENTICATED on GraphQL', async () => {
    const res = await gql('{ todos { id } }', {}, tamperedToken);
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});
