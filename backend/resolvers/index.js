const { GraphQLError } = require("graphql");
const Todo = require("../models/Todo");
const User = require("../models/User");
const { todoService } = require("../services/todoService");
const { pubsub, EVENTS } = require("../pubsub");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/authorization");

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function requireUser(context) {
  if (!context.user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.user;
}

function forbidden(msg = "Forbidden") {
  throw new GraphQLError(msg, { extensions: { code: "FORBIDDEN" } });
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

const resolvers = {
  Query: {
    todos: async (_, { status, tag, priority }, context) => {
      const user = requireUser(context);
      const filter = {};
      if (status) filter.status = status;
      if (tag) filter.tags = tag;
      if (priority) filter.priority = priority;
      const all = await Todo.find(filter);
      return all.filter((todo) => auth.canReadTodo(user, todo));
    },

    todo: async (_, { id }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(id);
      if (!todo) return null;
      if (!auth.canReadTodo(user, todo)) return null;
      return todo;
    },

    me: (_, __, context) => {
      const user = requireUser(context);
      return User.findById(user.id).exec();
    },

    users: (_, __, context) => {
      requireUser(context);
      return User.find().exec();
    },
  },

  Mutation: {
    createTodo: (_, { input }, context) => {
      const user = requireUser(context);
      return todoService.create({ ...input, ownerId: user.id });
    },

    updateTodo: async (_, { id, input }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(id);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canUpdateTodo(user, todo)) forbidden("Nur der Eigentümer kann dieses Todo bearbeiten");
      return todoService.update(id, input);
    },

    deleteTodo: async (_, { id }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(id);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canDeleteTodo(user, todo)) forbidden("Nur der Eigentümer kann dieses Todo löschen");
      return todoService.delete(id);
    },

    addComment: async (_, { todoId, text, author }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canAddComment(user, todo)) forbidden("Kein Kommentarzugriff auf dieses Todo");
      return todoService.addComment(todoId, { text, author: author ?? user.displayName });
    },

    addChecklistItem: async (_, { todoId, label, description }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canEditChecklist(user, todo)) forbidden();
      return todoService.addChecklistItem(todoId, { label, description });
    },

    updateChecklistItem: async (_, { todoId, itemId, label, description, checked }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canEditChecklist(user, todo)) forbidden();
      return todoService.updateChecklistItem(todoId, itemId, { label, description, checked });
    },

    deleteChecklistItem: async (_, { todoId, itemId }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canUpdateTodo(user, todo)) forbidden("Nur der Eigentümer kann Checklistenpunkte löschen");
      return todoService.deleteChecklistItem(todoId, itemId);
    },

    addAttachment: async (_, { todoId, filename, originalname, url }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canUploadAttachment(user, todo)) forbidden("Kein Upload-Zugriff auf dieses Todo");
      const updated = await Todo.findByIdAndUpdate(
        todoId,
        { $push: { attachments: { filename, originalname, url } } },
        { returnDocument: "after" }
      );
      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: updated });
      return updated;
    },

    addCollaborator: async (_, { todoId, userId }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canManageCollaborators(user, todo)) forbidden("Nur der Eigentümer kann Mitarbeiter hinzufügen");
      const target = await User.findById(userId);
      if (!target) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      const updated = await Todo.findByIdAndUpdate(
        todoId,
        { $addToSet: { collaborators: userId } },
        { returnDocument: "after" }
      );
      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: updated });
      return updated;
    },

    removeCollaborator: async (_, { todoId, userId }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canManageCollaborators(user, todo)) forbidden("Nur der Eigentümer kann Mitarbeiter entfernen");
      const updated = await Todo.findByIdAndUpdate(
        todoId,
        { $pull: { collaborators: userId } },
        { returnDocument: "after" }
      );
      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: updated });
      return updated;
    },

    setUserRole: async (_, { userId, role }, context) => {
      const user = requireUser(context);
      if (!auth.canManageUsers(user)) forbidden("Nur Admins können Rollen vergeben");
      const target = await User.findByIdAndUpdate(
        userId,
        { role },
        { returnDocument: "after" }
      );
      if (!target) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
      return target;
    },

    deleteAttachment: async (_, { todoId, attachmentId }, context) => {
      const user = requireUser(context);
      const todo = await Todo.findById(todoId);
      if (!todo) throw new GraphQLError("Todo not found", { extensions: { code: "NOT_FOUND" } });
      if (!auth.canDeleteTodo(user, todo)) forbidden("Nur der Eigentümer kann Anhänge löschen");
      const attachment = todo.attachments.id(attachmentId);
      if (attachment) {
        const filePath = path.join(__dirname, "../uploads", attachment.filename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (error) {
          console.error("Fehler beim Löschen der Datei:", error);
        }
      }
      const updatedTodo = await Todo.findByIdAndUpdate(
        todoId,
        { $pull: { attachments: { _id: attachmentId } } },
        { returnDocument: "after" }
      );
      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: updatedTodo });
      return updatedTodo;
    },
  },

  Subscription: {
    todoCreated: {
      subscribe: (_, __, context) => {
        if (!context.user) throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
        return pubsub.asyncIterableIterator([EVENTS.TODO_CREATED]);
      },
    },
    todoUpdated: {
      subscribe: (_, __, context) => {
        if (!context.user) throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
        return pubsub.asyncIterableIterator([EVENTS.TODO_UPDATED]);
      },
    },
    todoDeleted: {
      subscribe: (_, __, context) => {
        if (!context.user) throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
        return pubsub.asyncIterableIterator([EVENTS.TODO_DELETED]);
      },
    },
  },

  User: {
    id: (user) => user._id.toString(),
  },
  Todo: {
    id: (todo) => todo._id.toString(),
    dueDate: (todo) => todo.dueDate?.toISOString() ?? null,
    createdAt: (todo) => todo.createdAt.toISOString(),
    updatedAt: (todo) => todo.updatedAt.toISOString(),
  },
  ChecklistItem: {
    id: (item) => item._id.toString(),
  },
};

module.exports = { resolvers };