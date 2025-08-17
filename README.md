# Workcity Chat Backend

Robust real‑time messaging service built with **Express + TypeScript + MongoDB + Socket.IO + JWT (access / refresh)**.

## Core Capabilities

### Authentication & Authorization

- Register, login, refresh, logout (refresh token rotation & revocation ready)
- Access tokens (default 15m) + Refresh tokens (default 7d)
- Role middleware (e.g. admin routes & audits)

### Messaging

- Conversations (1:1 & multi‑participant) with `lastMessage` denormalized for fast inbox ordering
- Messages with text + attachments (stored externally; URLs persisted)
- Optimistic client pipeline (client sends HTTP -> socket fan‑out) prevents duplicates
- Per‑message read receipts (updates emitted as `message:read`)
- Typing indicators (debounced on client; TTL purge loop)
- Unread counters with granular `unread:update` events (supports delta or absolute reset)

### Presence & Idle Detection

- True presence derived from live socket room membership (`u:<userId>` per user)
- Immediate online broadcast when first socket for a user connects
- Delayed (100ms) offline broadcast on disconnect (helps rapid reconnects / tab switches)
- Heartbeat + activity touch on message / typing / read events updates `_lastActiveAt`
- Idle sweeper marks users offline after configurable inactivity threshold (`CHAT_IDLE_THRESHOLD_MS`, default 5m) even if socket remains open but dormant
- Ad‑hoc presence backfill via `check_presence` request from clients after initial conversation load

### Delivery / Read Semantics

- Sender writes message via HTTP -> server persists -> socket broadcasts authoritative copy
- Client replaces any optimistic `temp-*` message by matching content + sender (media‑only fallback: pending attachments with `uploading` flag)
- Status transitions: `pending` (client only) → `sent` (broadcast) → `read` (all non‑sender participants in `readBy`)

### Observability & Safety

- Centralized error handler + structured JSON error shape
- Token verification reused in Socket.IO middleware (handshake `auth.token` or `Authorization` header)
- OpenAPI (Swagger) docs at `/api-docs`

## Tech Stack

| Concern  | Stack                        |
| -------- | ---------------------------- |
| Runtime  | Node.js / Express            |
| Language | TypeScript                   |
| DB       | MongoDB (Mongoose)           |
| Realtime | Socket.IO                    |
| Auth     | JWT (HS256) access + refresh |
| Docs     | Swagger (OpenAPI)            |

## Scripts

| Script          | Description                                     |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | start dev server (nodemon + ts-node ESM loader) |
| `npm run build` | compile TypeScript                              |
| `npm start`     | run compiled JS from `dist`                     |

## Environment Variables (.env)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/workcity_chat
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
FIREBASE_STORAGE_BUCKET=your-bucket-name.appspot.com
CHAT_IDLE_THRESHOLD_MS=300000
```

## Core REST Endpoints (Auth + Chat)

| Method | Path                             | Description                                 |
| ------ | -------------------------------- | ------------------------------------------- |
| POST   | /auth/register                   | Create user                                 |
| POST   | /auth/login                      | Login & get tokens                          |
| POST   | /auth/refresh                    | Get new access token                        |
| POST   | /auth/logout                     | Revoke refresh token                        |
| GET    | /chat/conversations              | List user conversations (unread count)      |
| GET    | /chat/conversations/unread/total | Total unread messages                       |
| POST   | /chat/conversations              | Create conversation                         |
| GET    | /chat/conversations/:id/messages | Fetch messages in conversation              |
| POST   | /chat/messages                   | Send message (HTTP)                         |
| POST   | /chat/messages/read              | Mark conversation messages as read          |
| POST   | /files/upload                    | Multipart single file upload (field `file`) |

Detailed schemas & responses: visit `/api-docs` (Swagger UI).

## Project Structure

See source for modular layout.

## Socket.IO Events

Namespace: (default)

| Event               | Direction       | Payload Example                         | Description                  |
| ------------------- | --------------- | --------------------------------------- | ---------------------------- | ------------------- |
| `join_conversation` | client->server  | `conversationId`                        | Join a conversation room     |
| `send_message`      | client->server  | `{ conversationId, content: string }`   | Create + broadcast a message |
| `message:new`       | server->clients | `{ message }`                           | New message in conversation  |
| `mark_read`         | client->server  | `{ conversationId }`                    | Mark all as read             |
| `message:read`      | server->clients | `{ conversationId, userId }`            | A user read messages         |
| `typing`            | both ways       | `{ conversationId, typing }`            | Typing indicator             |
| `unread:update`     | server->clients | `{ conversationId, userId, unreadDelta? | unreadCount? }`              | Unread badge update |

## Socket.IO Events (Default Namespace)

| Event                    | Dir | Payload                                         | Purpose                                               |
| ------------------------ | --- | ----------------------------------------------- | ----------------------------------------------------- |
| `join_conversation`      | C→S | `conversationId`                                | Join room for targeted events                         |
| `send_message`           | C→S | `{ conversationId, content }`                   | (Legacy) direct emit path (HTTP used for persistence) |
| `message:new`            | S→C | `{ message }`                                   | Broadcast newly persisted message                     |
| `mark_read`              | C→S | `{ conversationId}`                             | Mark all messages read + reset unread                 |
| `message:read`           | S→C | `{ conversationId, userId }`                    | Receipt update per reader                             |
| `typing`                 | ↔   | `{ conversationId, typing }`                    | Show / hide typing bubble                             |
| `unread:update`          | S→C | `{ conversationId, unreadDelta? unreadCount? }` | Adjust badges incrementally or absolutely             |
| `presence`               | S→C | `{ userId, online }`                            | Real‑time presence + idle/offline                     |
| `conversation:maybe_new` | S→C | `{ conversationId, lastMessage? }`              | Hint to append or re‑order conversation list          |
| `check_presence`         | C→S | `{ userIds[] }`                                 | Request current presence snapshot                     |
| `heartbeat`              | C→S | `()`                                            | Touch last active timestamp (optional)                |

### Client Example

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: ACCESS_TOKEN } });
socket.emit("join_conversation", conversationId);
socket.emit("send_message", { conversationId, content: "Hello" });
socket.on("message:new", ({ message }) => console.log(message));
```

## Architecture Notes

- **Presence accuracy**: Derived from server knowledge (socket room counts + idle timer) – no reliance on client timestamps alone.
- **Optimistic UI**: Frontend creates a temporary message with `temp-*` id; server authoritative message replaces it by content + sender matching.
- **Read vs Delivery**: Sent state is implicit after server broadcast; read state requires all non‑sender participants in `readBy`.
- **Unread propagation**: Broadcast both deltas and absolute resets enabling idempotent UI reconciliation.
- **Scalability**: Stateless JWT auth; horizontal scaling requires a shared Socket.IO adapter (e.g. Redis) + consistent presence (room counts move to adapter). Idle sweep would iterate adapter membership.

## Future Enhancements

- Redis adapter for horizontal real‑time scaling
- Denormalized unread counters for O(1) list queries
- Separate delivery receipts vs read receipts
- Message edit & soft delete with audit trail
- Rate limiting + anomaly detection
- Presence status tiers (online / idle / offline) surfaced distinctly

## Deployment & Security Notes

- Always set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- Use HTTPS (terminate TLS before Node or with a proxy)
- Configure CORS origins explicitly for production clients
- Consider hashing refresh tokens before persistence
- Implement a Redis / Memcached layer for rate limiting & presence scaling

## Presence Algorithm (Summary)

1. On connect: join personal room `u:<userId>` → if first socket -> broadcast `presence { online: true }`.
2. Activity hooks (`send_message`, `mark_read`, `typing`, `heartbeat`) update `_lastActiveAt`.
3. Disconnect: after 100ms grace check if room empty → broadcast `online: false`.
4. Idle sweep (interval): if `now - _lastActiveAt > threshold` while socket still present → emit `online: false` (idle/offline) to converge stale clients.
5. Clients may call `check_presence` with a userId list to backfill state after initial conversation load.

This ensures rapid transitions while suppressing flicker on brief reconnects and cleaning up zombie sessions.

## File / Attachment Uploads (Firebase Storage)

### Flow

1. Client selects file → POST `/files/upload` with multipart field `file` (<=10MB default).
2. Multer (memory) validates size & MIME; classifies `image | video | document`.
3. `uploadBufferToFirebase` writes to `uploads/YYYY-MM-DD/<uuid>-originalName` in the configured bucket.
4. File is made public; response returns `{ type, url, originalName, mimeType, size }` used for optimistic message rendering.

### Setup

1. Enable Firebase Storage & create a service account with Storage Admin.
2. Copy `firebase-service-account.example.json` → `firebase-service-account.json` (do NOT commit).
3. Add `FIREBASE_STORAGE_BUCKET=<your-bucket>.appspot.com` to `.env`.
4. (Optional) Adjust size limit or allowed MIME in `routes/fileRoutes.ts`.

### Fallback Behavior

If credentials or file missing, upload helper returns placeholder URLs so local dev remains unblocked (logs warn). Provide real credentials for production.

---

_End of document_
