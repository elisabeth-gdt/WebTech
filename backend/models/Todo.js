const mongoose = require("mongoose");

// implementieren der Datenstruktur aus scheme.graphql
const SubtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
});

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: String, default: "Anonymous" },
  createdAt: { type: Date, default: Date.now },
});

const ChecklistItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  description: { type: String, default: "" },
  checked: { type: Boolean, default: false },
});

const HistoryEntrySchema = new mongoose.Schema({
  changedAt: { type: Date, default: Date.now },
  field: { type: String, required: true },
  oldValue: String,
  newValue: String,
});

const AttachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const TodoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "DONE"],
      default: "OPEN",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
      default: "MEDIUM",
    },
    dueDate: { type: Date },
    tags: [String],
    comments: [CommentSchema],
    checklistItems: [ChecklistItemSchema],
    history: [HistoryEntrySchema],
    attachments: [AttachmentSchema],
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Todo", TodoSchema);
