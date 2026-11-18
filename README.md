# DukaanFlow

Multi-tenant shop management application with a React admin portal, Expo mobile app, and Express API.

## Applications

- `admin/` — React + TypeScript platform administration portal
- `mobile/` — Expo + React Native shop-owner application
- `server/` — Express + TypeScript API foundation

## Run the admin portal

```bash
cd admin
npm run dev
```

## Run the mobile app

```bash
cd mobile
npm start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a specific platform.

## Run the API

Copy `server/.env.example` to `server/.env`, then:

```bash
cd server
npm run dev
```

The health endpoint is available at `GET /api/v1/health`.

## Verification

```bash
cd admin && npm run build && npm run lint
cd mobile && npx tsc --noEmit
cd server && npm run build
```
