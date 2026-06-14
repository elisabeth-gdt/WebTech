import { gql } from '@apollo/client'

export const GET_TODOS = gql`
  query GetTodos($status: TodoStatus, $tag: String, $priority: Priority) {
    todos(status: $status, tag: $tag, priority: $priority) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

export const TODO_DETAIL = gql`
  query TodoDetail($id: ID!) {
    todo(id: $id) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
      attachments {
        id: id
        filename
        originalname
        url
        uploadedAt
      }
      comments {
        id
        text
        author
        createdAt
      }
      checklistItems {
        id
        label
        description
        checked
      }
      history {
        changedAt
        field
        oldValue
        newValue
      }
    }
  }
`

export const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_TODO = gql`
  mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

export const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id)
  }
`

export const ADD_COMMENT = gql`
  mutation AddComment($todoId: ID!, $text: String!, $author: String) {
    addComment(todoId: $todoId, text: $text, author: $author) {
      id
      comments {
        id
        text
        author
        createdAt
      }
    }
  }
`

export const ADD_CHECKLIST_ITEM = gql`
  mutation AddChecklistItem($todoId: ID!, $label: String!, $description: String) {
    addChecklistItem(todoId: $todoId, label: $label, description: $description) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

export const UPDATE_CHECKLIST_ITEM = gql`
  mutation UpdateChecklistItem($todoId: ID!, $itemId: ID!, $label: String, $description: String, $checked: Boolean) {
    updateChecklistItem(todoId: $todoId, itemId: $itemId, label: $label, description: $description, checked: $checked) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

export const DELETE_CHECKLIST_ITEM = gql`
  mutation DeleteChecklistItem($todoId: ID!, $itemId: ID!) {
    deleteChecklistItem(todoId: $todoId, itemId: $itemId) {
      id
      checklistItems {
        id
        label
        description
        checked
      }
    }
  }
`

export const ADD_ATTACHMENT = gql`
  mutation AddAttachment($todoId: ID!, $filename: String!, $originalname: String!, $url: String!) {
    addAttachment(todoId: $todoId, filename: $filename, originalname: $originalname, url: $url) {
      id
      attachments {
        id: id
        filename
        originalname
        url
        uploadedAt
      }
    }
  }
`

export const DELETE_ATTACHMENT = gql`
  mutation DeleteAttachment($todoId: ID!, $attachmentId: ID!) {
    deleteAttachment(todoId: $todoId, attachmentId: $attachmentId) {
      id
      attachments {
        id: id
        filename
        originalname
        url
      }
    }
  }
`

export const TODO_CREATED = gql`
  subscription {
    todoCreated {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

export const TODO_UPDATED = gql`
  subscription {
    todoUpdated {
      id
      title
      status
      priority
      dueDate
      tags
      createdAt
      updatedAt
    }
  }
`

export const TODO_DELETED = gql`
  subscription {
    todoDeleted
  }
`
