/**
 * Centralized authorization logic.
 *
 * Global roles: 'admin' | 'moderator' | 'user'
 *   - admin: full access everywhere
 *   - moderator: global role kept for backwards compat, no special todo access
 *   - user: default
 *
 * Per-todo roles (stored on the todo document):
 *   - ownerId:      full control over the todo
 *   - collaborators: can read, comment, upload, edit checklist
 *   - moderators:   collaborator permissions + can delete comments & chat messages
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

function isTodoModerator(user, todo) {
  if (!todo.moderators) return false;
  return todo.moderators.some((m) => String(m) === String(user?.id));
}

// ── Todo permissions ─────────────────────────────────────────────────────────

function canReadTodo(user, todo) {
  if (!user) return false;
  if (todo.isPublic) return true;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo) || isTodoModerator(user, todo);
}

function canUpdateTodo(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo);
}

function canDeleteTodo(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo);
}

// ── Attachment permissions ────────────────────────────────────────────────────

function canUploadAttachment(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo) || isTodoModerator(user, todo);
}

function canDownloadAttachment(user, todo) {
  return canReadTodo(user, todo);
}

// ── Comment permissions ───────────────────────────────────────────────────────

function canAddComment(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo) || isTodoModerator(user, todo);
}

function canDeleteComment(user, comment, todo) {
  if (!user) return false;
  const isCommentOwner = String(comment.authorId) === String(user.id);
  return isAdmin(user) || isTodoModerator(user, todo) || isCommentOwner || isOwner(user, todo);
}

// ── Checklist permissions ─────────────────────────────────────────────────────

function canEditChecklist(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isCollaborator(user, todo) || isTodoModerator(user, todo);
}

function canDeleteChecklistItem(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo) || isTodoModerator(user, todo);
}

// ── Collaboration management ──────────────────────────────────────────────────

function canManageCollaborators(user, todo) {
  if (!user) return false;
  return isAdmin(user) || isOwner(user, todo);
}

function canManageTodoModerators(user, todo) {
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
  canEditChecklist,
  canDeleteChecklistItem,
  canManageCollaborators,
  canManageTodoModerators,
  canManageUsers,
  isAdmin,
  isModerator,
  isOwner,
  isCollaborator,
  isTodoModerator,
};
