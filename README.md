# Workcity Chat Backend

Express.js + TypeScript + MongoDB + JWT Auth (Access + Refresh Tokens)

## Features

- User registration & login
- Access (15m) & refresh (7d) tokens
- Refresh token persistence & revocation
- Role-based authorization
- Centralized error handling
- Strong TypeScript typings

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

## API Endpoints

| Method | Path           | Description          |
| ------ | -------------- | -------------------- |
| POST   | /auth/register | Create user          |
| POST   | /auth/login    | Login & get tokens   |
| POST   | /auth/refresh  | Get new access token |
| POST   | /auth/logout   | Revoke refresh token |

## Project Structure

See source for modular layout.

## Development

Install deps:

```
npm install
```

Run dev:

```
npm run dev
```

## Notes

- Ensure MongoDB is running locally or update `MONGO_URI`.
- Consider hashing refresh tokens before storing in production.
