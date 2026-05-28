# Todo-App - WebTech Projekt (Aufgabe 2)

## Gruppe Elmo

Dies ist eine erweiterte Full-Stack Todo-Anwendung mit GraphQL API und MongoDB, entwickelt im Rahmen des Web-Technologie-Kurses. Sie besteht aus einem Node.js-Backend mit GraphQL und einer dokumentenbasierten MongoDB-Datenbank, ergänzt um ein modernes Frontend mit Apollo Client.

## Features

### Backend

* **GraphQL API** mit:
  * Queries für flexible Lesezugriffe
  * Mutations zum Erstellen, Ändern und Löschen von Todos, Kommentaren, Tags und Subtasks
  * Subscriptions für Echtzeit-Aktualisierungen (Multi-User-Support)
* **MongoDB** als dokumentenbasierte Datenbank mit verschachtelten Datenstrukturen
* **Erweiterte Todo-Struktur:**
  * Tags
  * Subtasks
  * Kommentare
  * Priorität
  * Fälligkeitsdatum
  * Bearbeitungsverlauf
  * Checklisten
* **Multi-User-System** mit Echtzeit-Benachrichtigungen über Pub/Sub
* **Automatisierte Tests** für Queries, Mutations und Subscriptions

### Frontend

* **GraphQL-Integration** mit Apollo Client
* **Mehrere Ansichten:**
  * Übersicht mit Titel und Status
  * Detailansicht mit allen Informationen
  * Filteransicht (nach Tags, Priorität, etc.)
* **Echtzeit-Updates** über GraphQL Subscriptions
* **Funktionalität:**
  * Erstellen, Bearbeiten, Löschen von Todos
  * Kommentare und Subtasks hinzufügen
  * Tags und Prioritäten verwalten
  * Fälligkeitsdaten setzen
  * Live-Suche und Filterung

---

## Installation & Start

### 1. Repository klonen

```bash
git clone https://github.com/elisabeth-gdt/WebTech.git
cd WebTech
git checkout Aufgabe2
```

### 2. Backend einrichten und starten

Das Backend verwendet Docker, um die Mongo-Datenbank zu starten.

```bash
# Ins Backend-Verzeichnis wechseln
cd backend

# Abhängigkeiten installieren
npm install

# Docker-Container für die Datenbank starten (-d für "detached mode")
docker compose up -d

# Backend-Server starten (stellt die API auf Port 4000 bereit)
noder server.js
```

Der Server läuft nun auf `http://localhost:4000/graphql`.

### 3. Frontend starten

Das Frontend ist eine moderne Vite-basierte Anwendung mit Apollo Client zur GraphQL-Integration.

```bash
cd ../frontend

# Abhängigkeiten installieren
npm install

# Development Server starten
npm run dev
```

Die Seite ist nun erreichbar über `http://localhost:5173/`.

---

## Testen

Die Backend-API ist mit automatisierten Tests abgedeckt.

* **Test-Datei:** Die Test-Datei befindet sich unter `backend/tests/test.js`.

**Tests ausführen:**

1. Stellen Sie sicher, dass Sie sich im `backend`-Verzeichnis befinden.
2. Führen Sie den folgenden Befehl aus:

```bash
npm test
```

Jest wird alle Test-Suites ausführen und einen Bericht über die erfolgreichen und fehlgeschlagenen Tests ausgeben.
