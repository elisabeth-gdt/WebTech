/**
 * Centralized authorization logic.
 * All business-rule access decisions go here — never scattered across resolvers.
 *
 * Roles: 'admin' | 'moderator' | 'user'
 * Ownership: todo.ownerId === user.id
 * Collaboration: todo.collaborators contains user.id
 */

function isAdmin(user) {
  return user?.role === 'admin';
}

function isModerator(user) {
  return user?.role === 'moderator' || user?.role === 'admin';
}

function isOwner(user, todo) {
  return String(todo.ownerId) === String(user?.id);
}

function isCollaborator(user, todo) {
  if (!todo.collaborators) return false;
  return todo.collaborators.some((c) => String(c) === String(user?.id));
}

// ── Todo permissions ─────────────────────────────────────────────────────────

function canReadTodo(user, todo) {
  if (!user) return false;
  if (todo.isPublic) return true;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo);
}

function canUpdateTodo(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo);
}

function canDeleteTodo(user, todo) {
  if (!user) return false;
  // Only owner or admin may delete
  return isAdmin(user) || isOwner(user, todo);
}

// ── Attachment permissions ────────────────────────────────────────────────────

function canUploadAttachment(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo);
}

function canDownloadAttachment(user, todo) {
  return canReadTodo(user, todo);
}

// ── Comment permissions ───────────────────────────────────────────────────────

function canAddComment(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo);
}

function canDeleteComment(user, comment, todo) {
  if (!user) return false;
  const isCommentOwner = String(comment.authorId) === String(user.id);
  return isAdmin(user) || isModerator(user) || isCommentOwner || isOwner(user, todo);
}

// ── Collaboration management ──────────────────────────────────────────────────

function canManageCollaborators(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo);
}

// ── User/admin management ─────────────────────────────────────────────────────

function canManageUsers(user) {
  return isAdmin(user);
}

module.exports = {
  canReadTodo,
  canUpdateTodo,
  canDeleteTodo,
  canUploadAttachment,
  canDownloadAttachment,
  canAddComment,
  canDeleteComment,
  canManageCollaborators,
  canManageUsers,
  isAdmin,
  isModerator,
  isOwner,
  isCollaborator,
};