// backend/tests/testServer.js
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { resolvers } = require('../resolvers/index.js');
const { verifyToken, getGraphQLUser } = require('../middleware/auth');

// GraphQL-Schema aus Datei laden (mit absolutem Pfad)
const typeDefs = fs.readFileSync(path.join(__dirname, '../scheme.graphql'), 'utf8');

async function startTestServer(dbName = 'todos_test') {
  // Mit eigener Test-Datenbank verbinden (jede Suite bekommt ihre eigene DB,
  // da Jest Testdateien standardmäßig parallel in getrennten Prozessen ausführt
  // und sich sonst mehrere Suiten dieselbe DB "wegräumen" würden)
  await mongoose.connect(`mongodb://root:root@localhost:27017/${dbName}`, {
    authSource: 'admin'
  });

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  return server;
}

async function stopTestServer(server) {
  await server.stop();
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}

// Hilfsfunktion damit Tests lesbarer werden.
// `user` simuliert den durch ein JWT authentifizierten Nutzer im GraphQL-Context.
async function execute(server, query, variables = {}, user = null) {
  const res = await server.executeOperation({ query, variables }, { contextValue: { user } });
  return res.body.singleResult;
}

/**
 * Baut eine vollständige Express-App (Auth-, GraphQL- und Datei-Routen) für
 * supertest-basierte Security-Tests. Nutzt eine eigene Test-Datenbank.
 */
async function buildTestApp(dbName = 'todos_test_security') {
  await mongoose.connect(`mongodb://root:root@localhost:27017/${dbName}`, {
    authSource: 'admin',
  });

  const apolloServer = new ApolloServer({ typeDefs, resolvers });
  await apolloServer.start();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(verifyToken);

  app.use('/auth', require('../routes/auth'));

  app.post(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ user: getGraphQLUser(req) }),
    })
  );

  app.use('/files', require('../routes/files'));

  return { app, apolloServer };
}

async function stopTestApp(apolloServer) {
  await apolloServer.stop();
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}

module.exports = { startTestServer, stopTestServer, execute, buildTestApp, stopTestApp };
