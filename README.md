<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=180&section=header&text=Pok%C3%A9mon%20Stadium%20API&fontSize=36&fontColor=fff&animation=fadeIn&fontAlignY=32" />

<div align="center">

![Build](https://img.shields.io/github/actions/workflow/status/jarero321/pokemon-stadium-api/ci.yml?branch=develop&style=for-the-badge)
![License](https://img.shields.io/github/license/jarero321/pokemon-stadium-api?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)

**Real-time Pokémon battle backend with REST API, WebSocket events, and Clean Architecture.**

[Getting Started](#getting-started) •
[Architecture](#architecture) •
[API Reference](#api-reference) •
[WebSocket Events](#websocket-events) •
[Testing](#testing)

</div>

---

## Features

| Feature                 | Description                                                                                      |
| :---------------------- | :----------------------------------------------------------------------------------------------- |
| **Real-time Battles**   | Turn-based combat via Socket.IO with type effectiveness, forced switches, and damage calculation |
| **Clean Architecture**  | Domain → Application → Infrastructure with strict dependency rule enforcement                    |
| **Lobby System**        | State machine (WAITING → READY → BATTLING → FINISHED) with disconnect recovery                   |
| **Type Effectiveness**  | 15×15 type matchup matrix with super effective (1.5×), not effective (0.5×), and immune (0×)     |
| **JWT Authentication**  | Token-based auth for both REST and WebSocket connections                                         |
| **Idempotency**         | Request ID + MongoDB cache prevents duplicate attack processing                                  |
| **Concurrency Control** | In-memory mutex lock prevents race conditions on simultaneous turns                              |
| **Observability**       | Trace ID propagation across HTTP → WebSocket → DB with structured Pino logging                   |
| **API Documentation**   | Auto-generated Swagger/OpenAPI at `/docs`                                                        |

## Tech Stack

<div align="center">

**Languages & Frameworks**

<img src="https://skillicons.dev/icons?i=ts,nodejs&perline=8" alt="languages" />

**Infrastructure & Tools**

<img src="https://skillicons.dev/icons?i=mongodb,docker,githubactions,pnpm&perline=8" alt="infra" />

</div>

| Technology               | Purpose                                                |
| :----------------------- | :----------------------------------------------------- |
| **Fastify 5**            | HTTP server with rate limiting and Swagger             |
| **Socket.IO 4**          | Bidirectional real-time communication                  |
| **MongoDB / Mongoose 9** | Persistence with transactions and TTL indexes          |
| **Zod 4**                | Runtime validation for env vars and WebSocket payloads |
| **Pino**                 | Structured JSON logging with trace ID correlation      |
| **Vitest**               | Unit and E2E testing with in-memory fakes              |

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm
- MongoDB 7 with replica set (for transactions)

### Quick Start with Docker

```bash
# Start MongoDB + API
docker compose up -d

# API available at http://localhost:8080
# Swagger docs at http://localhost:8080/docs
```

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/jarero321/pokemon-stadium-api.git
cd pokemon-stadium-api
pnpm install

# 2. Start MongoDB with replica set
docker run -d --name pokemon-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec pokemon-mongo mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0,host:'localhost:27017'}]})"

# 3. Configure environment
cp .env.example .env

# 4. Start dev server
pnpm dev
```

The server starts at `http://0.0.0.0:8080`.

### Configuration

| Variable               | Description                                         | Default       |
| :--------------------- | :-------------------------------------------------- | :------------ |
| `PORT`                 | Server port                                         | `8080`        |
| `HOST`                 | Bind address                                        | `0.0.0.0`     |
| `MONGODB_URI`          | MongoDB connection string (requires replica set)    | _required_    |
| `POKEMON_API_BASE_URL` | External Pokémon catalog API                        | _required_    |
| `JWT_SECRET`           | JWT signing secret (min 32 chars)                   | _required_    |
| `NODE_ENV`             | Environment (`development` / `production` / `test`) | `development` |
| `CORS_ORIGIN`          | Allowed origins (`*` or comma-separated URLs)       | `*`           |

## Architecture

```
src/
├── core/                    # Domain — zero external dependencies
│   ├── entities/            # Pokemon, Player, Battle, Lobby
│   ├── operations/          # Pure functions: combat, lobby, player
│   ├── interfaces/          # Ports: ILobbyRepository, ITurnLock, etc.
│   ├── errors/              # Typed business errors (10 error types)
│   ├── events/              # Domain events (BattleFinished)
│   └── enums/               # LobbyStatus, PlayerStatus, PokemonType
├── application/             # Use cases & orchestration
│   ├── use-cases/           # RegisterPlayer, JoinLobby, ExecuteAttack...
│   ├── mappers/             # Entity → DTO transformations
│   ├── dtos/                # LobbyDTO, BattleDTO
│   └── listeners/           # Event handlers (UpdateLeaderboard)
├── infrastructure/          # Implementations
│   ├── database/mongo/      # Mongoose schemas + repositories
│   ├── http/                # Fastify server, routes, middlewares
│   ├── websocket/           # Socket.IO handlers + player registry
│   ├── external/            # Pokémon API client with SWR cache
│   ├── auth/                # JWT token service
│   ├── events/              # EventBus (EventEmitter wrapper)
│   ├── locks/               # InMemoryTurnLock (mutex)
│   └── logger/              # PinoLogger
├── config/env.ts            # Zod-validated environment
└── main.ts                  # Composition root (DI wiring)
```

**Dependency rule**: `core ← application ← infrastructure`. Inner layers never import from outer layers.

## API Reference

### REST Endpoints

| Endpoint                         | Method | Auth | Description                   |
| :------------------------------- | :----: | :--: | :---------------------------- |
| `/api/players/register`          |  POST  |  —   | Register trainer, receive JWT |
| `/api/pokemon`                   |  GET   |  —   | Pokémon catalog (cached 12h)  |
| `/api/leaderboard`               |  GET   |  —   | Top players by win rate       |
| `/api/players/:nickname/history` |  GET   | JWT  | Player battle history         |
| `/api/health`                    |  GET   |  —   | Health check + MongoDB status |

### Register Example

```bash
curl -X POST http://localhost:8080/api/players/register \
  -H "Content-Type: application/json" \
  -d '{"nickname": "Ash"}'
```

```json
{
  "success": true,
  "data": {
    "player": { "nickname": "Ash", "wins": 0, "losses": 0, "winRate": 0 },
    "isNewPlayer": true,
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

## WebSocket Events

Connect with `socket.io-client` using the JWT token:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  transports: ['websocket'],
  auth: { token: 'your-jwt-token' },
});
```

### Client → Server

| Event            | Payload                                        | Description                |
| :--------------- | :--------------------------------------------- | :------------------------- |
| `join_lobby`     | —                                              | Join or create lobby       |
| `assign_pokemon` | —                                              | Request 3 random Pokémon   |
| `ready`          | —                                              | Confirm team, mark ready   |
| `attack`         | `{ requestId: UUID }`                          | Attack with active Pokémon |
| `switch_pokemon` | `{ requestId: UUID, targetPokemonIndex: 0-2 }` | Switch active Pokémon      |

### Server → Client

| Event              | Description                               |
| :----------------- | :---------------------------------------- |
| `lobby_status`     | Full lobby state sync                     |
| `battle_start`     | Battle begins (both players ready)        |
| `turn_result`      | Damage dealt, HP updated, type multiplier |
| `pokemon_defeated` | A Pokémon fainted                         |
| `pokemon_switch`   | A Pokémon entered battle                  |
| `battle_end`       | Winner declared                           |
| `error`            | Error with code and message               |

### Battle Flow

```
Player 1                    Server                    Player 2
   │                          │                          │
   ├─ join_lobby ────────────►│◄──────────── join_lobby ─┤
   │◄─ lobby_status ─────────│──────── lobby_status ───►│
   ├─ assign_pokemon ────────►│◄───── assign_pokemon ───┤
   ├─ ready ─────────────────►│◄──────────── ready ─────┤
   │◄─ battle_start ─────────│──────── battle_start ───►│
   │                          │                          │
   ├─ attack ────────────────►│                          │
   │◄─ turn_result ──────────│──────── turn_result ────►│
   │◄─ lobby_status ─────────│──────── lobby_status ───►│
   │                          │                          │
   │                          │◄──────────── attack ────┤
   │◄─ turn_result ──────────│──────── turn_result ────►│
   │                          │                          │
   │◄─ battle_end ───────────│──────── battle_end ─────►│
```

## Testing

```bash
# Unit tests (57 tests)
pnpm test

# E2E tests (102 tests — requires Docker)
pnpm test:e2e

# Type checking
pnpm typecheck

# Lint
pnpm lint
```

### Test Coverage

| Suite             | Tests | Scope                                                   |
| :---------------- | ----: | :------------------------------------------------------ |
| Core Operations   |    24 | Damage calc, type effectiveness, lobby/player ops       |
| Battle Flow       |    25 | Full lifecycle with fakes: join → attack → switch → win |
| Register Player   |     8 | Validation, idempotency, edge cases                     |
| Auth E2E          |    14 | JWT flow, protected routes, WebSocket auth              |
| Game Flow E2E     |    26 | REST endpoints, full game lifecycle                     |
| Battle Sync E2E   |    27 | Turn sync, forced switch, reconnection, forfeit         |
| Disconnection E2E |    22 | Lobby/battle disconnect, reconnection, rapid cycling    |
| Idempotency E2E   |     9 | Duplicate request handling                              |
| Rate Limit E2E    |     4 | Endpoint throttling                                     |

## License

This project is licensed under the MIT License.

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=120&section=footer" />
