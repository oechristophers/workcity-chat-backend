# Workcity Chat Backend

Express.js + TypeScript + MongoDB + JWT Auth (Access + Refresh Tokens) + Real-time Chat (Socket.IO)

## Features

- Auth: registration, login, refresh, logout
- JWT access (15m) & refresh (7d) tokens
- Stored refresh tokens (revocation supported)
- Role-based middleware
- Real-time chat (Socket.IO) with rooms per conversation
- Conversations & messages persisted in MongoDB
- Per-user unread counts (aggregated on demand)
- Mark-as-read + typing indicators + last message preview
- Centralized error handling
- Swagger UI docs at `/api-docs`
- Strong TypeScript typings throughout

## Scripts

- `npm run dev` - start dev server (nodemon + ts-node ESM loader)
- `npm run build` - compile TypeScript
- `npm start` - run compiled JS from `dist`

## Environment Variables (.env)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/workcity_chat
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
```

## Core REST Endpoints (Auth + Chat)

| Method | Path                             | Description                            |
| ------ | -------------------------------- | -------------------------------------- |
| POST   | /auth/register                   | Create user                            |
| POST   | /auth/login                      | Login & get tokens                     |
| POST   | /auth/refresh                    | Get new access token                   |
| POST   | /auth/logout                     | Revoke refresh token                   |
| GET    | /chat/conversations              | List user conversations (unread count) |
| GET    | /chat/conversations/unread/total | Total unread messages                  |
| POST   | /chat/conversations              | Create conversation                    |
| GET    | /chat/conversations/:id/messages | Fetch messages in conversation         |
| POST   | /chat/messages                   | Send message (HTTP)                    |
| POST   | /chat/messages/read              | Mark conversation messages as read     |

Detailed schemas & responses: visit `/api-docs` (Swagger UI).

## Project Structure

See source for modular layout.

## Socket.IO Events

Namespace: (default)

| Event               | Direction       | Payload Example                         | Description                  |
| ------------------- | --------------- | --------------------------------------- | ---------------------------- | ------------------- |
| `join_conversation` | client->server  | `conversationId`                        | Join a conversation room     |
| `send_message`      | client->server  | `{ conversationId, content }`           | Create + broadcast a message |
| `message:new`       | server->clients | `{ message }`                           | New message in conversation  |
| `mark_read`         | client->server  | `{ conversationId }`                    | Mark all as read             |
| `message:read`      | server->clients | `{ conversationId, userId }`            | A user read messages         |
| `typing`            | both ways       | `{ conversationId, typing }`            | Typing indicator             |
| `unread:update`     | server->clients | `{ conversationId, userId, unreadDelta? | unreadCount? }`              | Unread badge update |

Auth: provide access token via `auth: { token: '<ACCESS_TOKEN>' }` when connecting or `Authorization: Bearer <token>` header.

### Client Example

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { auth: { token: ACCESS_TOKEN } });
socket.emit("join_conversation", conversationId);
socket.emit("send_message", { conversationId, content: "Hello" });
socket.on("message:new", ({ message }) => console.log(message));
```

## Development

Install deps:

```
npm install
```

Run dev:

```
npm run dev
```

## Architecture Notes

- Mongoose models: `User`, `Conversation`, `Message`
- Conversations store `lastMessage` for fast inbox listing
- Unread counts are computed via aggregation (no denormalized counters yet)
- Indexes added for conversation sorting & message unread queries
- JWT auth reused for socket connections (handshake `auth.token`)

## Future Enhancements

- Denormalized unread counters for O(1) listing
- Message pagination (cursor or time-based)
- Delivery receipts separate from read
- Soft delete / edit message audit
- Rate limiting & WAF

## Notes

- Ensure MongoDB is running locally or update `MONGO_URI`.
- Replace placeholder JWT secrets before production.
- Consider hashing stored refresh tokens in production.
