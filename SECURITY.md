# Security-Dokumentation (Aufgabe 4)

## 1. Authentifizierungsverfahren

Es gibt **kein klassisches Passwort-Login**. Stattdessen werden zwei passwortlose Verfahren angeboten:

* **Passkeys (WebAuthn)** über `@simplewebauthn/server` und `@simplewebauthn/browser`
  ([backend/routes/auth.js](backend/routes/auth.js)): Registrierung und Login laufen über
  Challenge/Response — der Server erzeugt eine Challenge (`generateRegistrationOptions` /
  `generateAuthenticationOptions`), der Browser löst sie über die Plattform-Authenticator-API
  (Fingerabdruck, Gesichtserkennung, Sicherheitsschlüssel) und schickt die signierte Antwort
  zurück, die der Server mit `verifyRegistrationResponse` / `verifyAuthenticationResponse`
  prüft. Es wird nie ein geheimer Schlüssel übertragen, nur die Signatur.
* **Google OIDC** (`/auth/google`): Der Client schickt ein von Google signiertes ID-Token, das
  Backend verifiziert es mit `google-auth-library` gegen die Google-Public-Keys und legt bei
  Erstanmeldung automatisch einen lokalen Nutzer an.

Nach erfolgreicher Anmeldung (egal über welches Verfahren) stellt das Backend ein **JWT** aus
(`signToken()` in `auth.js`), das Nutzer-ID, E-Mail, Rolle und Anzeigename enthält und 8 Stunden
gültig ist (`JWT_EXPIRES_IN`). Das Frontend speichert dieses Token im `localStorage` und sendet
es als `Authorization: Bearer <token>` bei jedem GraphQL-Request, REST-Aufruf und auch beim
WebSocket-Handshake (als Query-Parameter, da Browser bei WS keine Custom-Header erlauben).

**Warum diese Wahl:** Passwörter sind die häufigste Ursache für Account-Übernahmen
(Wiederverwendung, Phishing, schwache Passwörter). Passkeys sind kryptographisch an die Origin
gebunden und damit phishing-resistent; Google OIDC verschiebt das Credential-Management zu einem
Anbieter, der das professioneller absichert als wir es könnten.

## 2. Rollen- und Rechtekonzept

Es gibt zwei Ebenen von Berechtigungen, zentral implementiert in
[backend/middleware/authorization.js](backend/middleware/authorization.js):

**Globale Rolle** (`User.role`): `user` oder `admin`. Admins haben uneingeschränkten Zugriff auf
alle Todos und können über das Admin-Panel die Rolle anderer Nutzer ändern
(`setUserRole`-Mutation, serverseitig auf `isAdmin()` geprüft).

**Per-Todo-Rollen** (gespeichert auf dem Todo-Dokument, nicht global):
| Rolle | Vergeben durch | Rechte |
|---|---|---|
| Eigentümer (`ownerId`) | automatisch bei Erstellung | Todo bearbeiten/löschen, Mitarbeiter & Moderatoren verwalten |
| Todo-Moderator (`moderators[]`) | Eigentümer/Admin, pro Todo | wie Mitarbeiter + Kommentare/Chat-Nachrichten/Checklistenpunkte löschen |
| Mitarbeiter (`collaborators[]`) | Eigentümer/Admin | lesen, kommentieren, Datei-Upload, Checkliste bearbeiten |
| kein Eintrag | — | kein Zugriff (außer `isPublic: true`) |

Jede Mutation und jeder Query-Resolver ruft eine der `can*`-Funktionen
(`canReadTodo`, `canUpdateTodo`, `canDeleteComment`, `canManageTodoModerators`, …) auf, bevor sie
etwas verändert oder zurückgibt — die Entscheidung liegt also ausschließlich im Backend, das
Frontend blendet UI-Elemente nur aus Komfortgründen aus und ist keine Sicherheitsgrenze.

## 3. Schutz bestehender Schnittstellen

* **HTTP-Middleware-Reihenfolge** (`server.js`): `cors()` → `express.json()` →
  `verifyToken` (liest `Authorization`-Header, hängt `req.user` an oder lässt `null`) → erst
  danach werden `/auth`, `/graphql` und `/files` gemountet. `verifyToken` selbst lehnt nichts ab —
  das erlaubt z. B. `/auth/google` ohne Token, erzwingt aber, dass jede nachgelagerte Route
  selbst entscheidet, ob sie einen Nutzer braucht.
* **REST-Routen** (`/files/upload/*`, `/auth/me`) sind über `requireAuth` geschützt, das ohne
  gültigen Token mit `401` antwortet, bevor die eigentliche Handler-Logik läuft
  ([backend/middleware/auth.js](backend/middleware/auth.js)).
* **GraphQL** hat keinen globalen Auth-Guard auf Schema-Ebene, sondern jeder Resolver ruft zuerst
  `requireUser(context)` auf, das bei fehlendem Nutzer einen `UNAUTHENTICATED`-Fehler wirft.
  Danach folgen die fachlichen Berechtigungsprüfungen (`FORBIDDEN`), siehe oben.
* **WebSocket-Chat** (`/chat`): Token wird als Query-Parameter beim Verbindungsaufbau übergeben
  und mit `jwt.verify` geprüft; Löschrechte für Nachrichten werden bei jeder `DELETE_MESSAGE`-
  Nachricht erneut serverseitig gegen die aktuellen Todo-Daten (Owner/Moderator) geprüft, nicht
  nur einmal beim Connect.
* **CORS** ist auf eine einzige erlaubte Origin (`ORIGIN`-Env-Var, Default
  `http://localhost:5173`) eingeschränkt statt `*`.

## 4. Speicherung und Schutz von Zugangsdaten

Der größte Unterschied zu klassischen Logins: **es gibt keine Passwörter in der Datenbank**,
also auch kein Passwort-Hashing/Salting-Risiko.

* **Passkeys**: Nur der **öffentliche Schlüssel** (`credentialPublicKey`, base64url-kodiert) und
  ein Replay-Schutz-Zähler (`counter`) werden in `User.passkeys[]` gespeichert
  ([backend/models/User.js](backend/models/User.js)). Der private Schlüssel verlässt nie das
  Gerät des Nutzers. Ein Diebstahl der Datenbank liefert einem Angreifer also keine
  Login-Möglichkeit.
* **Google OIDC**: Es wird nur die `googleId` (Google-`sub`) gespeichert, kein Token und kein
  Passwort.
* **JWT-Secret**: `JWT_SECRET` kommt aus einer Umgebungsvariable; im Code liegt nur ein
  Default-Fallback (`dev-secret-change-in-production`) für die lokale Entwicklung. Für den
  produktiven Einsatz müsste dieser Default zwingend überschrieben und das Secret z. B. über ein
  Secret-Management-System verteilt werden.
* **Tokens selbst** werden nicht in der Datenbank gespeichert (stateless JWT) — `/auth/logout`
  entfernt das Token nur clientseitig aus dem `localStorage`. Ein gestohlenes Token bleibt bis
  zum Ablauf (8h) gültig; es gibt aktuell keine Server-seitige Blockliste/Revocation.

## 5. Testing

Die Sicherheitsfunktionen sind durch ausführbare Jest-Tests abgedeckt:
[backend/tests/security.test.js](backend/tests/security.test.js).

```bash
cd backend
npx jest tests/security.test.js
```

Abgedeckt werden:
* `401` bei fehlendem Token auf geschützten REST- und GraphQL-Endpunkten
* `401` bei abgelaufenem und bei manipuliertem (Signatur kaputt) JWT
* `403`/`FORBIDDEN` bei Zugriff ohne ausreichende Rolle (z. B. `users`-Query oder
  `setUserRole`-Mutation als normaler Nutzer)
* Datei-Upload ohne Token

---

## Reflexion

**Warum ist Sicherheit ein Querschnittsthema?**
Weil eine einzelne ungeschützte Stelle die Sicherheit aller anderen Maßnahmen entwerten kann.
In diesem Projekt zeigt sich das konkret: Selbst mit starker passwortloser Authentifizierung
wäre die App unsicher, wenn z. B. der WebSocket-Chat keinen Token-Check hätte oder ein
GraphQL-Resolver die Berechtigungsprüfung vergisst. Sicherheit lässt sich nicht als einzelnes
Feature "anbauen", sondern muss bei jeder neuen Mutation, jeder neuen Route und jeder neuen
Rolle erneut mitgedacht werden — was in der Praxis auch passiert ist: Mit der Einführung der
Mitarbeiter-/Moderator-Funktion mussten Checklisten-, Kommentar- und Chat-Berechtigungen
nachträglich an das neue Modell angepasst werden.

**Welche Herausforderungen entstanden bei der Integration in das bestehende System?**
Die ursprüngliche Anwendung kannte nur eine grobe, globale Unterscheidung zwischen normalen
Nutzern und privilegierten Nutzern. Als pro-Todo-Mitarbeit eingeführt wurde, reichte das nicht
mehr aus — eine global "moderator" Rolle hätte Zugriff auf *alle* Todos gegeben, nicht nur auf
die, an denen jemand mitarbeitet. Das erforderte einen Wechsel von einer rein
rollenbasierten (RBAC) zu einer zusätzlich ressourcenbezogenen Prüfung (im Kern ein einfaches
ABAC/ReBAC-Muster: Berechtigung hängt vom konkreten Todo-Dokument ab, nicht nur von der globalen
Rolle). Das betraf nicht nur das Backend (jede betroffene Mutation musste umgestellt werden),
sondern auch den WebSocket-Chat, der komplett unabhängig vom GraphQL-Layer läuft und seine
eigene Token-Prüfung sowie eigene Berechtigungslogik braucht — Konsistenz zwischen beiden Wegen
musste manuell sichergestellt werden, es gibt keine gemeinsame Middleware für beide.
Eine weitere Herausforderung war das Echtzeit-Verhalten: Wird einem Nutzer der Zugriff entzogen,
während er die Detailansicht oder den Chat offen hat, muss das sofort sichtbar werden, sonst
wirkt die Berechtigungsprüfung zwar serverseitig korrekt, aber für den Nutzer inkonsistent.

**Welche Grenzen hat die Lösung?**
* **Keine Token-Revocation**: Ein gestohlenes JWT bleibt bis zu 8 Stunden gültig, auch wenn der
  Nutzer "ausgeloggt" wird oder seine Rolle geändert wird — es gibt keine Sperrliste und keinen
  Token-Refresh-Mechanismus.
* **Rate-Limiting fehlt**: Login-Endpunkte (`/auth/passkey/login/options`, `/auth/google`) sind
  nicht gegen Brute-Force oder Enumeration-Angriffe (z. B. Ausprobieren existierender E-Mails)
  abgesichert.
* **Single JWT-Secret ohne Rotation**: Der Secret-Wert wird einmalig per Env-Var gesetzt; es gibt
  keinen Mechanismus, um ihn ohne Invalidierung aller Sessions zu rotieren.
* **Frontend-Prüfungen sind nur Komfort**: Buttons/Formulare werden im Client ausgeblendet, die
  eigentliche Durchsetzung liegt vollständig beim Server — das ist beabsichtigt, bedeutet aber,
  dass ein Bug im Backend (vergessener `can*`-Check) nicht durch das Frontend kompensiert wird.
* **WebSocket-Authentifizierung über Query-Parameter**: Der Token steht damit potenziell in
  Server-Logs oder Proxy-Logs, da URLs häufiger geloggt werden als Header. Für ein
  Lern-/Kursprojekt akzeptabel, für einen produktiven Einsatz wäre ein anderer Übergabeweg
  (z. B. erster WS-Frame) vorzuziehen.
* **Keine Audit-Logs**: Sicherheitsrelevante Aktionen (Rollenänderung, Moderator-Ernennung,
  Kommentar-/Nachrichtenlöschung durch Dritte) werden nicht protokolliert, was forensische
  Nachvollziehbarkeit im Streitfall einschränkt.
