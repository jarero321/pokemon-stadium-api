# Pokemon Stadium Lite - API

Technical test: **Sr. Fullstack Developer** (7-day deadline).

Real-time Pokemon battle system with WebSocket lobby, turn-based combat, type effectiveness, and full battle traceability.

## Tech Stack

| Layer           | Technology                                                       |
| --------------- | ---------------------------------------------------------------- |
| Runtime         | Node.js + TypeScript (ESM)                                       |
| HTTP            | Fastify 5                                                        |
| WebSocket       | Socket.IO 4                                                      |
| Database        | MongoDB (Mongoose 9)                                             |
| Validation      | Zod 4                                                            |
| Logger          | Pino                                                             |
| Package Manager | pnpm                                                             |
| Quality         | Husky + lint-staged (Prettier + ESLint pre-commit, tsc pre-push) |

## Architecture

Clean Architecture with 3 layers. Core has **zero** external dependencies.

```
src/
├── core/                  # Domain layer (entities, enums, errors, interfaces, events)
├── application/           # Use cases, listeners, DTOs
├── infrastructure/        # Adapters (DB, HTTP, WebSocket, external APIs)
├── config/                # Env validation (Zod)
└── main.ts                # Composition root (not implemented)
```

**Path aliases** via Node.js native subpath imports: `#core/*`, `#application/*`, `#infrastructure/*`, `#config/*`

## Game Flow

```
Player joins lobby (JoinLobby)
  └─ Status: JOINED
     └─ Random 3 Pokemon assigned (AssignPokemon)
        └─ Status: TEAM_ASSIGNED
           └─ Player marks ready (PlayerReady)
              └─ Status: READY
                 └─ Both ready → Battle starts (fastest Pokemon goes first)
                    └─ Status: BATTLING
                       ├─ ExecuteAttack (damage = floor((ATK - DEF) * typeMultiplier), min 1)
                       └─ SwitchPokemon (consumes turn)
                          └─ All opponent Pokemon defeated → BattleFinishedEvent
                             ├─ UpdateLeaderboard (winner +1 win, loser +1 loss)
                             └─ ResetLobby (auto-reset for next game)
```

## Domain Rules

- **Lobby**: max 2 players, status machine: WAITING → READY → BATTLING → FINISHED
- **Player**: status machine: JOINED → TEAM_ASSIGNED → READY → BATTLING (prevents invalid actions)
- **Race conditions**: In-memory mutex (`ITurnLock`) locks per lobby during turn processing
- **Type effectiveness**: 15 types, multipliers 1.5x (super effective) / 0.5x (not effective) / 0x (immune)
- **Damage formula**: `floor((ATK - DEF) * typeMultiplier)`, minimum 1, HP never below 0
- **Auto-switch**: When a Pokemon faints, next alive Pokemon activates automatically
- **Traceability**: Every turn persisted in `Battle` entity with full attack/defense/damage data

## Core Entities

| Entity        | Purpose                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `Pokemon`     | id, name, type[], hp, maxHp, attack, defense, speed, sprite, defeated   |
| `Player`      | nickname, socketId, status (enum), team (Pokemon[]), activePokemonIndex |
| `Lobby`       | status, players[], currentTurnIndex, battleId, winner                   |
| `Battle`      | players + teams snapshot, turns[] (full history), winner, timestamps    |
| `PlayerStats` | nickname, wins, losses, totalBattles, winRate, battleHistory[]          |
| `BattleTurn`  | attacker, defender, damage, typeMultiplier, defeated, nextPokemon       |

## Interfaces (Ports)

| Interface            | Methods                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `ILobbyRepository`   | findActive, create, update, reset                                    |
| `IBattleRepository`  | create, findById, addTurn (assigns turnNumber), finish, findByPlayer |
| `IPlayerRepository`  | findByNickname, upsert, addWin, addLoss, getLeaderboard              |
| `IPokemonApiService` | getList, getById, getByIds                                           |
| `ITurnLock`          | acquire(lobbyId) → release()                                         |
| `IEventBus`          | emit(event), on(eventName, handler)                                  |
| `ILogger`            | info, warn, error, debug, child                                      |

## Use Cases

| Use Case            | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| `JoinLobby`         | Create/join lobby, validate status + max players                                   |
| `AssignPokemon`     | Fetch catalog, random 3 (excluding opponent's), set TEAM_ASSIGNED                  |
| `PlayerReady`       | Mark ready, when both ready: create Battle, determine first turn by speed          |
| `ExecuteAttack`     | Mutex lock, validate turn, calc damage + type multiplier, handle defeat/switch/end |
| `SwitchPokemon`     | Mutex lock, validate target not defeated/same, consumes turn                       |
| `GetPokemonCatalog` | Fetch full catalog                                                                 |
| `GetLeaderboard`    | Top N players by wins                                                              |
| `GetPlayerHistory`  | Player stats + battle list                                                         |

## Event-Driven

`BattleFinishedEvent` triggers:

1. `UpdateLeaderboard` — addWin/addLoss to PlayerStats
2. `ResetLobby` — lobbyRepository.reset() for next game

## Error Classes (by domain)

- **Lobby**: LobbyFullError, LobbyNotFoundError, LobbyNotInStateError
- **Battle**: NotYourTurnError, BattleNotActiveError, BattleNotFoundError, InvalidSwitchError
- **Player**: PlayerNotInLobbyError, PlayerAlreadyInLobbyError, InvalidPlayerStatusError, PlayerNotFoundError
- **Pokemon**: PokemonAlreadyDefeatedError, InsufficientPokemonError

All extend `BusinessError` (code + message + statusCode).

## WebSocket Events

**Client → Server:**

- `JOIN_LOBBY` — join/create lobby
- `ASSIGN_POKEMON` — request random team
- `READY` — mark player ready
- `ATTACK` — execute attack
- `SWITCH_POKEMON` — switch active Pokemon

**Server → Client:**

- `LOBBY_STATUS` — lobby state update
- `BATTLE_START` — battle begins
- `TURN_RESULT` — turn outcome
- `POKEMON_DEFEATED` — Pokemon fainted
- `POKEMON_SWITCH` — Pokemon switched
- `BATTLE_END` — battle finished
- `ERROR` — error notification

## What's Done

- [x] Clean Architecture scaffolding (core, application, infrastructure stubs)
- [x] Domain entities, enums, error classes
- [x] All 8 use cases implemented
- [x] Event system (DomainEvent, BattleFinishedEvent, EventBus)
- [x] 2 event listeners (UpdateLeaderboard, ResetLobby)
- [x] Type effectiveness table (15 types)
- [x] Race condition prevention (ITurnLock / InMemoryTurnLock)
- [x] PlayerStatus state machine
- [x] DTOs (LobbyDTO, TurnResultDTO, BattleEndDTO)
- [x] Logger (PinoLogger with pino-pretty)
- [x] Env validation with Zod (formatted error box)
- [x] Husky + lint-staged (pre-commit: Prettier + ESLint, pre-push: tsc)
- [x] SOLID review passed

## Next Steps (Infrastructure Layer)

Priority order for implementation:

### 1. MongoDB Connection + Schemas

- `connection.ts` — Mongoose connect with retry logic
- `LobbySchema.ts` — Lobby model
- `BattleSchema.ts` — Battle model with embedded turns
- `PlayerSchema.ts` — PlayerStats model with indexes on nickname/wins

### 2. Repository Implementations

- `MongoLobbyRepository.ts` — implements ILobbyRepository
- `MongoBattleRepository.ts` — implements IBattleRepository (addTurn assigns turnNumber via `$push` + array length)
- `MongoPlayerRepository.ts` — implements IPlayerRepository

### 3. External API

- `PokemonApiService.ts` — implements IPokemonApiService
- Lazy cache: fetch catalog once, cache in memory (2000+ Pokemon in PokeAPI)
- Base URL: `https://pokemon-api-92034153384.us-central1.run.app`

### 4. HTTP Layer (Fastify)

- `server.ts` — Fastify instance setup
- `pokemonRoutes.ts` — GET /pokemon (catalog), GET /leaderboard, GET /players/:nickname/history
- `errorHandler.ts` — BusinessError → JSON response with code/message/statusCode

### 5. WebSocket Layer (Socket.IO)

- `socketServer.ts` — Socket.IO attached to Fastify
- `lobbyHandler.ts` — JOIN_LOBBY, ASSIGN_POKEMON, READY events
- `battleHandler.ts` — ATTACK, SWITCH_POKEMON events
- Disconnection handling (player leaves mid-battle)

### 6. Composition Root

- `main.ts` — Wire all dependencies, start server

### 7. Frontend (not started)

- React Web or Flutter (TBD)

### Bonus Features

- [x] Type effectiveness multipliers
- [x] Pokemon switching during battle
- [x] Leaderboard
- [x] Battle history traceability
- [ ] Lazy Pokemon cache
- [ ] Disconnection handling
- [ ] Cloud deployment (MongoDB Atlas free tier)

## Commands

```bash
pnpm dev          # Development with hot reload (tsx watch)
pnpm build        # TypeScript compilation
pnpm start        # Production (node dist/main.js)
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm typecheck    # tsc --noEmit
```

## Environment Variables

```env
PORT=8080
HOST=0.0.0.0
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/pokemon-stadium
POKEMON_API_BASE_URL=https://pokemon-api-92034153384.us-central1.run.app
NODE_ENV=development
```
