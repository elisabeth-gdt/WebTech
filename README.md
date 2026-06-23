# Todo-App - WebTech Projekt (Aufgabe 4 – MEAN)

## Gruppe Elmo

## Repository klonen

```bash
git clone https://github.com/elisabeth-gdt/WebTech.git
cd WebTech
git checkout Abgabe4_MEAN
```

Dies ist eine erweiterte Full-Stack Todo-Anwendung mit GraphQL API und MongoDB, entwickelt im Rahmen des Web-Technologie-Kurses. Sie besteht aus einem Node.js-Backend mit Express, Apollo Server und GraphQL, einer dokumentenbasierten MongoDB-Datenbank, sowie einem modernen React-Frontend mit Apollo Client, PWA-Funktionalität und Echtzeit-WebSocket-Chat. In Aufgabe 4 wurde die Anwendung um Authentifizierung, ein Autorisierungssystem und Nutzerverwaltung erweitert.

> Technische Dokumentation zu Authentifizierung, Rollen-/Rechtekonzept, Schnittstellenschutz und Zugangsdaten-Speicherung sowie eine Reflexion zum Thema Sicherheit findet sich in [SECURITY.md](SECURITY.md).

## Features

### Authentifizierung & Autorisierung

* **Login/Registrierung** per E-Mail & **Passkeys** (WebAuthn)
* **JWT-basierte Sessions** (Token im `localStorage`, `Authorization: Bearer`-Header)
* **Globale Rollen:** `admin` und `user`
* **Per-Todo-Berechtigungsmodell** (statt einer globalen Moderator-Rolle):
  * **Eigentümer** – volle Kontrolle über sein Todo (bearbeiten, löschen, Mitarbeiter verwalten)
  * **Todo-Moderatoren** – vom Eigentümer (oder Admin) für ein einzelnes Todo ernannt; dürfen zusätzlich zu den Mitarbeiter-Rechten Kommentare, Chat-Nachrichten löschen
  * **Mitarbeiter** – können kommentieren, Dateien hochladen und Checklisten bearbeiten
  * **Admin** – globaler Zugriff auf alle Todos und Nutzerverwaltung
* **Admin-Panel** zur Vergabe der globalen Rolle (`user`/`admin`) an andere Nutzer
* Zentrale Autorisierungslogik in `backend/middleware/authorization.js`

### Backend

* **GraphQL API** mit:
  * Queries für flexible Lesezugriffe
  * Mutations zum Erstellen, Ändern und Löschen von Todos, Kommentaren, Tags, Subtasks, Mitarbeitern und Moderatoren
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
  * Eigentümer, Mitarbeiter und Todo-Moderatoren
* **Multi-User-System** mit Echtzeit-Benachrichtigungen über Pub/Sub
* **Echtzeit-Zugriffsentzug:** Wird ein Nutzer aus einem Todo entfernt, verschwindet es sofort aus dessen Ansicht (inkl. Schließen offener Chat-Fenster)
* **Automatisierte Tests** für Queries, Mutations und Subscriptions

### Frontend

* **GraphQL-Integration** mit Apollo Client
* **Mehrere Ansichten:**
  * Übersicht mit Titel und Status
  * Detailansicht mit allen Informationen
  * Filteransicht (nach Tags, Priorität, etc.)
  * Admin-Panel zur Rollenverwaltung
* **Mitarbeiterverwaltung pro Todo:**
  * Live-Nutzersuche zum Hinzufügen von Mitarbeitern
  * Befördern/Degradieren zwischen Mitarbeiter und Todo-Moderator
  * Entfernen von Mitarbeitern/Moderatoren durch den Eigentümer
* **Echtzeit-Kommunikation:**
  * WebSocket-Chat mit Room-basierter Architektur und JWT-Authentifizierung
  * Nachrichtenhistorie beim Connect
  * Löschen von Chat-Nachrichten durch Eigentümer/Todo-Moderator/Admin
  * Offline-Fallback auf gecachte Nachrichten
* **PWA-Funktionalität:**
  * Service Worker mit App-Shell-Caching
  * Cache-Strategien: Cache-First (App-Shell), Network-First (Assets)
  * IndexedDB für Offline-Persistierung (Todos & Nachrichten)
  * Installierbar auf Desktop/Mobile
* **Funktionalität:**
  * Erstellen, Bearbeiten, Löschen von Todos
  * Kommentare und Checklisten-Items hinzufügen
  * Tags und Prioritäten verwalten
  * Fälligkeitsdaten setzen
  * Dateianhänge hochladen und löschen
  * Echtzeit-Chat pro Todo

---

## Installation & Start

### 1. Backend einrichten und starten

Das Backend verwendet Docker, um die Mongo-Datenbank zu starten.

```bash
# Ins Backend-Verzeichnis wechseln
cd backend

# Abhängigkeiten installieren
npm install

# Docker-Container für die Datenbank starten (-d für "detached mode")
docker compose up -d

# Backend-Server starten (stellt die API auf Port 4000 bereit)
node server.js
```

Der Server läuft nun auf `http://localhost:4000/graphql`.

### 2. Frontend starten

Das Frontend ist eine moderne Vite-basierte Anwendung mit Apollo Client zur GraphQL-Integration.

```bash
cd ../frontend

# Abhängigkeiten installieren
npm install

# Development Server starten
npm run dev
```

Die Seite ist nun erreichbar über `http://localhost:5173/`.

### 4. Admin-Account anlegen

Standardmäßig wird jeder neu registrierte Nutzer mit der Rolle `user` angelegt. Um den ersten Admin-Account zu erstellen, muss die Rolle direkt in der MongoDB gesetzt werden:

```bash
docker exec -it webtech-db-1 mongosh -u root -p root --authenticationDatabase admin

use todoapp
db.users.updateOne({ email: "deine@email.de" }, { $set: { role: "admin" } })
```

Anschließend kann dieser Admin über das **Admin-Panel** im Frontend weitere Nutzer befördern. Todo-Moderatoren werden hingegen nicht global, sondern direkt in der Detailansicht des jeweiligen Todos durch dessen Eigentümer ernannt.

---

## API-Dokumentation

Die API ist nach dem OpenAPI 3.0 Standard spezifiziert.

* **Spezifikations-Datei:** Die rohe YAML-Datei befindet sich unter `backend/docs/openapi.yaml`.
* **Interaktive Swagger-UI:** Nachdem das Backend gestartet wurde, können Sie die interaktive Dokumentation unter folgender URL aufrufen:
  * [http://localhost:3000/docs](http://localhost:3000/docs)

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

**Nur die Security-Tests ausführen:**

```bash
cd backend
npx jest tests/security.test.js
```

Diese Suite prüft u. a. `401` bei fehlendem/abgelaufenem/manipuliertem Token, `403` bei
fehlender Rolle und den Schutz der Datei-Routen. Details siehe [SECURITY.md](SECURITY.md).

**PWA-Tests ausführen:**

1. Stellen Sie sicher, dass sie sich im `frontend`–Verzeichnis befinden.
2. Führen Sie den folgenden Befehl aus:

```bash
npm test
```
