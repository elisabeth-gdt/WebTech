require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express5");
const { ApolloServerPluginDrainHttpServer } = require("@apollo/server/plugin/drainHttpServer");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/use/ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { resolvers } = require("./resolvers/index.js");
const { setupChatHandler } = require("./websocket/chatServer");

const { verifyToken, getGraphQLUser } = require("./middleware/auth");

const chatHandler = setupChatHandler();
const typeDefs = fs.readFileSync(path.join(__dirname, "./scheme.graphql"), "utf8");

async function startServer() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://root:root@localhost:27017/todoapp",
    { authSource: "admin" }
  );
  console.log("MongoDB verbunden");

  const app = express();
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/graphql") {
      wsServer.handleUpgrade(req, socket, head, (ws) => {
        wsServer.emit("connection", ws, req);
      });
    } else if (url.pathname === "/chat") {
      chatHandler.handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  useServer(
    {
      schema,
      context: (ctx) => {
        const token = ctx.connectionParams?.authorization?.replace("Bearer ", "");
        if (!token) return { user: null };
        try {
          const jwt = require("jsonwebtoken");
          const user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-in-production");
          return { user };
        } catch {
          return { user: null };
        }
      },
      onConnect: () => console.log("✓ GraphQL WebSocket Client verbunden"),
      onDisconnect: () => console.log("✗ GraphQL WebSocket Client disconnected"),
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              wsServer.close();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(cors({ origin: process.env.ORIGIN || "http://localhost:5173", credentials: true }));
  app.use(express.json());

  app.use(verifyToken);

  const authRoutes = require("./routes/auth");
  app.use("/auth", authRoutes);

  app.post(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => ({ user: getGraphQLUser(req) }),
    })
  );

  const fileRoutes = require("./routes/files");
  app.use("/files", fileRoutes);
  app.use("/uploads", express.static("uploads"));

  httpServer.listen(4000, () => {
    console.log("✓ Server läuft auf http://localhost:4000");
    console.log("✓ GraphQL HTTP: http://localhost:4000/graphql (POST)");
    console.log("✓ GraphQL WebSocket: ws://localhost:4000/graphql");
    console.log("✓ Chat: ws://localhost:4000/chat");
  });
}

startServer().catch((err) => {
  console.error("Fehler beim Starten des Servers:", err);
  process.exit(1);
});