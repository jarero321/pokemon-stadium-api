<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=180&section=header&text=Pokemon%20Stadium%20Lite&fontSize=36&fontColor=fff&animation=fadeIn&fontAlignY=32" />

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/node-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**API backend en tiempo real para batallas Pokemon 1v1 con WebSockets, Clean Architecture y persistencia en MongoDB.**

[Inicio Rapido](#-inicio-rapido) •
[Arquitectura](#-arquitectura) •
[API REST](#-api-rest) •
[WebSocket](#-eventos-websocket) •
[ADR](#-architecture-decision-records) •
[Docker](#-docker)

</div>

---

## Caracteristicas

| Caracteristica              | Descripcion                                                       |
| :-------------------------- | :---------------------------------------------------------------- |
| **Batallas en tiempo real** | Sistema de turnos 1v1 via WebSocket con Socket.IO                 |
| **Efectividad de tipos**    | Calculo de dano basado en la tabla oficial de tipos Pokemon       |
| **Lobby automatico**        | Matchmaking: el primer jugador crea el lobby, el segundo se une   |
| **Equipo aleatorio**        | Asignacion de 3 Pokemon aleatorios sin repeticion entre jugadores |
| **Leaderboard**             | Ranking de jugadores por win rate con historial de batallas       |
| **Swagger UI**              | Documentacion interactiva de la API REST en `/docs`               |
| **Trace ID**                | Trazabilidad end-to-end en cada request HTTP y conexion WebSocket |
| **Docker ready**            | Un solo `docker compose up` levanta API + MongoDB                 |

## Tech Stack

<div align="center">

**Lenguajes & Frameworks**

<img src="https://skillicons.dev/icons?i=ts,nodejs,fastify&perline=8" alt="languages" />

**Infraestructura & Herramientas**

<img src="https://skillicons.dev/icons?i=mongodb,docker,pnpm,vitest&perline=8" alt="infra" />

</div>

| Dependencia   | Version | Proposito                                 |
| :------------ | :-----: | :---------------------------------------- |
| **Fastify**   |   5.8   | Servidor HTTP (REST API + Swagger)        |
| **Socket.IO** |   4.8   | Comunicacion bidireccional en tiempo real |
| **Mongoose**  |   9.3   | ODM para MongoDB                          |
| **Pino**      |  10.3   | Logging estructurado de alta performance  |
| **Zod**       |   4.3   | Validacion de variables de entorno        |
| **Vitest**    |   4.0   | Testing unitario y de integracion         |

---

## Inicio Rapido

### Prerequisitos

- Node.js >= 22
- pnpm >= 10
- MongoDB 7+ (o usar Docker)

### Instalacion local

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd pokemon-stadium-api
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Desarrollo con hot-reload
pnpm dev

# Tests
pnpm test
```

### Con Docker (recomendado)

```bash
docker compose up --build
```

Levanta la API en `http://localhost:8080` y MongoDB en `localhost:27017`.

- **Swagger UI**: http://localhost:8080/docs
- **Health check**: http://localhost:8080/api/health

---

## Variables de Entorno

| Variable               | Descripcion                                   | Default       | Requerida |
| :--------------------- | :-------------------------------------------- | :------------ | :-------: |
| `PORT`                 | Puerto del servidor                           | `8080`        |    No     |
| `HOST`                 | Host de escucha                               | `0.0.0.0`     |    No     |
| `MONGODB_URI`          | URI de conexion a MongoDB                     | —             |    Si     |
| `POKEMON_API_BASE_URL` | URL base de la Pokemon API externa            | —             |    Si     |
| `NODE_ENV`             | Entorno (`development`, `production`, `test`) | `development` |    No     |

---

## Arquitectura

El proyecto sigue **Clean Architecture** con tres capas bien definidas. La regla de dependencia es estricta: las capas internas nunca conocen a las externas.

```
┌─────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                        │
│  HTTP (Fastify)  │  WebSocket (Socket.IO)  │  MongoDB   │
│  PokemonAPI      │  Pino Logger            │  EventBus  │
├─────────────────────────────────────────────────────────┤
│                      APPLICATION                         │
│  Use Cases: JoinLobby, AssignPokemon, ExecuteAttack...  │
│  DTOs: LobbyDTO, TurnResultDTO, BattleEndDTO           │
│  Listeners: ResetLobby, UpdateLeaderboard               │
├─────────────────────────────────────────────────────────┤
│                         CORE                             │
│  Entities: Lobby, Player, Pokemon, Battle, PlayerStats  │
│  Interfaces: ILobbyRepository, IBattleRepository...     │
│  Errors: BusinessError, LobbyErrors, BattleErrors       │
│  Events: BattleFinishedEvent, DomainEvent               │
│  Enums: LobbyStatus, PlayerStatus, PokemonType          │
│  typeEffectiveness (tabla de tipos)                      │
└─────────────────────────────────────────────────────────┘
```

### Core (Dominio)

Cero dependencias externas. Define **que** hace el sistema:

- **Entities** — Estructuras de datos del negocio (`Lobby`, `Player`, `Pokemon`, `Battle`, `PlayerStats`)
- **Interfaces** — Contratos que la infraestructura debe implementar (`ILobbyRepository`, `IBattleRepository`, `IPokemonApiService`, `ITurnLock`)
- **Errors** — Errores de negocio tipados (`LobbyFullError`, `NotYourTurnError`, `BattleFinishedError`)
- **Events** — Eventos de dominio (`BattleFinishedEvent`) para comunicacion desacoplada entre capas
- **typeEffectiveness** — Tabla de efectividad de tipos Pokemon (fuego > planta, agua > fuego, etc.)

### Application (Casos de Uso)

Orquesta la logica de negocio. Define **como** se ejecutan las operaciones:

| Use Case            | Responsabilidad                                                   |
| :------------------ | :---------------------------------------------------------------- |
| `JoinLobby`         | Crear lobby o unir segundo jugador, maximo 2 por lobby            |
| `AssignPokemon`     | Asignar 3 Pokemon aleatorios sin repeticion entre jugadores       |
| `PlayerReady`       | Marcar jugador listo, iniciar batalla cuando ambos estan ready    |
| `ExecuteAttack`     | Calcular dano con efectividad de tipos, turno alternado con mutex |
| `SwitchPokemon`     | Cambiar Pokemon activo (consume turno)                            |
| `GetPokemonCatalog` | Obtener catalogo de Pokemon desde API externa                     |
| `GetLeaderboard`    | Ranking de jugadores ordenado por win rate                        |
| `GetPlayerHistory`  | Stats y batallas de un jugador especifico                         |

**Listeners** (reaccionan a eventos de dominio):

- `ResetLobby` — Limpia el lobby cuando una batalla termina
- `UpdateLeaderboard` — Actualiza wins/losses del ganador y perdedor

### Infrastructure (Implementaciones)

Adaptadores concretos. Define **con que** se conecta el sistema:

- **MongoDB** — Mongoose schemas + repositorios (`MongoLobbyRepository`, `MongoBattleRepository`, `MongoPlayerRepository`)
- **HTTP** — Fastify server con Swagger, middleware de traceId, errorHandler estandarizado
- **WebSocket** — Socket.IO con `PlayerConnectionRegistry`, handlers por dominio, `withErrorBoundary`
- **External** — `PokemonApiService` consume la PokeAPI para catalogo y stats
- **Logger** — `PinoLogger` con child loggers contextuales (traceId, socketId)
- **Locks** — `InMemoryTurnLock` para prevenir race conditions en turnos simultaneos

---

## Reglas de Dominio

- **Lobby**: maximo 2 jugadores, maquina de estados: `WAITING` → `READY` → `BATTLING` → `FINISHED`
- **Player**: maquina de estados: `JOINED` → `TEAM_ASSIGNED` → `READY` → `BATTLING`
- **Race conditions**: Mutex in-memory (`ITurnLock`) bloquea durante procesamiento de turno
- **Efectividad de tipos**: 15 tipos, multiplicadores 1.5x (super efectivo) / 0.5x (no efectivo) / 0x (inmune)
- **Formula de dano**: `floor((ATK - DEF) * typeMultiplier)`, minimo 1, HP nunca baja de 0
- **Auto-switch**: Cuando un Pokemon cae, el siguiente vivo se activa automaticamente
- **Trazabilidad**: Cada turno se persiste en la entidad `Battle` con datos completos de ataque/defensa/dano
- **Desconexion**: Si un jugador se desconecta durante batalla, el oponente gana por forfeit

---

## Estructura del Proyecto

```
src/
├── core/                              # Dominio puro (sin dependencias)
│   ├── entities/                      #   Lobby, Player, Pokemon, Battle, PlayerStats
│   ├── enums/                         #   LobbyStatus, PlayerStatus, PokemonType
│   ├── errors/                        #   BusinessError + errores especificos
│   ├── events/                        #   DomainEvent, BattleFinishedEvent
│   ├── interfaces/                    #   Contratos: repositories, services, logger
│   └── typeEffectiveness.ts           #   Tabla de efectividad de tipos
│
├── application/                       # Casos de uso y DTOs
│   ├── use-cases/                     #   JoinLobby, ExecuteAttack, GetLeaderboard...
│   ├── dtos/                          #   LobbyDTO, TurnResultDTO, BattleEndDTO...
│   └── listeners/                     #   ResetLobby, UpdateLeaderboard
│
├── infrastructure/                    # Implementaciones concretas
│   ├── database/mongo/                #   Schemas + Repositories (Mongoose)
│   ├── http/                          #   Fastify server, rutas, middlewares
│   │   ├── middlewares/               #     traceId, errorHandler
│   │   ├── routes/                    #     pokemonRoutes (REST endpoints)
│   │   ├── ApiResponse.ts            #     Formato estandar de respuesta
│   │   └── server.ts                 #     Fastify + Swagger setup
│   ├── websocket/                     #   Socket.IO
│   │   ├── handlers/                  #     lobbyHandler, battleHandler
│   │   ├── PlayerConnectionRegistry.ts
│   │   ├── withErrorBoundary.ts       #     Error isolation por socket
│   │   ├── mapLobbyToDTO.ts           #     Entity → DTO mapper
│   │   └── socketServer.ts            #     Socket.IO server + disconnect
│   ├── external/                      #   PokemonApiService (PokeAPI client)
│   ├── events/                        #   EventBus (Node.js EventEmitter)
│   ├── locks/                         #   InMemoryTurnLock (mutex)
│   └── logger/                        #   PinoLogger
│
├── config/
│   └── env.ts                         # Validacion con Zod
│
└── main.ts                            # Composition root

tests/
├── fakes/                             # Implementaciones in-memory para testing
│   ├── FakeLobbyRepository.ts
│   ├── FakeBattleRepository.ts
│   ├── FakePokemonApiService.ts
│   ├── FakeEventBus.ts
│   ├── FakeTurnLock.ts
│   └── SilentLogger.ts
└── battle-flow.test.ts                # 25 tests funcionales
```

---

## API REST

Todas las respuestas siguen un formato estandar con trazabilidad:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-11T19:00:00.000Z"
}
```

En caso de error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PLAYER_NOT_FOUND",
    "message": "Player \"Ash\" not found"
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-11T19:00:00.000Z"
}
```

### Endpoints

| Metodo | Endpoint                         | Descripcion                             |
| :----: | :------------------------------- | :-------------------------------------- |
| `GET`  | `/api/pokemon`                   | Catalogo de Pokemon disponibles (Gen 1) |
| `GET`  | `/api/leaderboard?limit=10`      | Ranking de jugadores por win rate       |
| `GET`  | `/api/players/:nickname/history` | Stats y batallas de un jugador          |
| `GET`  | `/api/health`                    | Health check del servidor               |
| `GET`  | `/docs`                          | Swagger UI interactivo                  |

### Trazabilidad (Trace ID)

Cada request HTTP recibe un `traceId` unico (UUID v4):

- Si el cliente envia el header `X-Trace-Id`, se reutiliza (trazabilidad end-to-end desde frontend)
- Si no viene, el servidor genera uno automaticamente
- Se incluye en el response header `X-Trace-Id` y en el body
- Todos los logs del request incluyen el `traceId` para correlacion

---

## Eventos WebSocket

La conexion WebSocket se establece en `ws://localhost:8080` via Socket.IO.

### Flujo de Batalla

```
Cliente                          Servidor
  │                                │
  │─── join_lobby {nickname} ────>│  Crear/unir lobby
  │<── lobby_status ──────────────│
  │                                │
  │─── assign_pokemon ───────────>│  Asignar 3 Pokemon aleatorios
  │<── lobby_status ──────────────│
  │                                │
  │─── ready ────────────────────>│  Marcar jugador listo
  │<── lobby_status ──────────────│
  │<── battle_start ──────────────│  (cuando ambos estan ready)
  │                                │
  │─── attack ───────────────────>│  Ejecutar ataque
  │<── turn_result ───────────────│  Resultado del turno
  │<── pokemon_defeated ──────────│  (si Pokemon fue derrotado)
  │<── pokemon_switch ────────────│  (cambio automatico al siguiente)
  │<── lobby_status ──────────────│
  │                                │
  │─── switch_pokemon {index} ───>│  Cambiar Pokemon activo (consume turno)
  │<── lobby_status ──────────────│
  │                                │
  │<── battle_end ────────────────│  (equipo completo derrotado)
```

### Eventos del Cliente → Servidor

| Evento           | Payload                          | Descripcion                        |
| :--------------- | :------------------------------- | :--------------------------------- |
| `join_lobby`     | `{ nickname: string }`           | Unirse al lobby activo             |
| `assign_pokemon` | —                                | Solicitar asignacion de equipo     |
| `ready`          | —                                | Marcar jugador como listo          |
| `attack`         | —                                | Ejecutar ataque con Pokemon activo |
| `switch_pokemon` | `{ targetPokemonIndex: number }` | Cambiar Pokemon activo             |

### Eventos del Servidor → Cliente

| Evento             | Payload                       | Descripcion                      |
| :----------------- | :---------------------------- | :------------------------------- |
| `lobby_status`     | `LobbyDTO`                    | Estado actual del lobby          |
| `battle_start`     | `LobbyDTO`                    | La batalla inicio                |
| `turn_result`      | `TurnResultDTO`               | Resultado de un turno            |
| `pokemon_defeated` | `PokemonDefeatedDTO`          | Un Pokemon fue derrotado         |
| `pokemon_switch`   | `PokemonSwitchDTO`            | Cambio al siguiente Pokemon vivo |
| `battle_end`       | `{ winner, loser, battleId }` | La batalla termino               |
| `error`            | `{ code, message }`           | Error de negocio o inesperado    |

### Manejo de Desconexion

Si un jugador se desconecta durante una batalla activa:

1. El oponente gana automaticamente por forfeit
2. Se emite `battle_end` con `reason: "opponent_disconnected"`
3. El lobby se marca como `FINISHED`
4. El registro de conexiones se limpia

---

## Architecture Decision Records

### ADR-001: Socket.IO para batallas en tiempo real

**Contexto**: Las batallas son interacciones bidireccionales de baja latencia donde ambos jugadores necesitan ver los resultados instantaneamente.

**Decision**: Usar Socket.IO sobre WebSockets nativos.

**Razones**:

- Reconexion automatica con backoff exponencial
- Rooms nativos para broadcasting selectivo (solo jugadores del lobby reciben eventos)
- Fallback a long-polling si WebSocket no esta disponible
- Protocolo de heartbeat (`pingInterval: 10s`, `pingTimeout: 5s`) para deteccion rapida de desconexiones
- `PlayerConnectionRegistry` como capa de abstraccion que mapea `socketId ↔ nickname` y gestiona membership al room `active-lobby`

### ADR-002: REST para consultas stateless

**Contexto**: El catalogo de Pokemon, leaderboard e historial son consultas de solo lectura sin estado de sesion.

**Decision**: Separar estas operaciones en endpoints REST (Fastify) en lugar de canalizarlas por WebSocket.

**Razones**:

- Cacheables por HTTP (ETags, Cache-Control)
- Consumibles por cualquier cliente sin establecer conexion WebSocket
- Documentables via Swagger/OpenAPI con schemas tipados
- Cada request es independiente — no requiere estado de conexion
- Fastify comparte el mismo servidor HTTP con Socket.IO (puerto unico)

### ADR-003: Mongoose sin migraciones

**Contexto**: MongoDB es schemaless por naturaleza. Mongoose define la estructura a nivel de aplicacion, no de base de datos.

**Decision**: No usar sistema de migraciones. Los schemas de Mongoose definen la estructura y los indices se sincronizan automaticamente al conectar.

**Razones**:

- Las collections se crean automaticamente al primer `create()`
- Los indices (ej: `nickname: unique` en `PlayerStats`) se sincronizan via `autoIndex` de Mongoose
- El proyecto inicia con base de datos vacia — no hay datos previos que migrar
- Los subdocumentos embebidos (Pokemon dentro de Player, turns dentro de Battle) no requieren relaciones ni joins
- Si en futuro se requiere migrar datos existentes en produccion, se evaluaria `migrate-mongo`

### ADR-004: Trace ID como middleware

**Contexto**: En un sistema con multiples capas (HTTP → Use Case → Repository → DB), correlacionar logs de una misma operacion es critico para debugging en produccion.

**Decision**: Implementar middleware que genera o propaga un `traceId` (UUID v4) por cada request HTTP, y un traceId por conexion WebSocket.

**Razones**:

- Permite buscar todos los logs de un request con un solo filtro (`traceId: "abc-123"`)
- El cliente puede enviar su propio `X-Trace-Id` para trazabilidad end-to-end (frontend → backend → DB)
- El traceId viaja en el response body y header, facilitando soporte al usuario ("dame tu traceId")
- En WebSocket, cada conexion recibe un traceId que se propaga a todos los logs via `logger.child({ traceId })`
- Compatible con herramientas de observabilidad (Datadog, CloudWatch, Grafana Loki)

### ADR-005: tsc-alias para resolucion de path aliases

**Contexto**: Los path aliases de TypeScript (`@core/*`, `@infrastructure/*`) mejoran la legibilidad de imports, pero `tsc` no los resuelve en el JavaScript compilado.

**Decision**: Usar `tsc-alias` como paso post-compilacion para reescribir los aliases a rutas relativas.

**Razones**:

- En desarrollo: `tsx` (hot-reload) y `vitest` (via `vite-tsconfig-paths`) resuelven los aliases automaticamente
- En produccion: `node dist/main.js` necesita rutas relativas reales (`@core/entities/index` → `./core/entities/index`)
- El build es: `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json`
- Alternativas evaluadas y descartadas:
  - `tsconfig-paths/register` — overhead en runtime, dependencia adicional en produccion
  - `moduleResolution: NodeNext` — requiere extensiones `.js` en todos los imports, afecta DX
  - Subpath imports (`#core/*`) — sintaxis no estandar, pobre soporte en tooling

### ADR-006: Multi-stage Docker build

**Contexto**: La imagen de produccion debe ser lo mas ligera posible, sin devDependencies, codigo fuente TypeScript, ni herramientas de desarrollo.

**Decision**: Dockerfile con dos stages — `build` (compila) y `production` (solo runtime).

**Razones**:

- **Stage build**: instala todas las deps, ejecuta `tsc` + `tsc-alias`, genera `dist/`
- **Stage production**: instala solo deps de produccion (`pnpm install --frozen-lockfile --prod`), copia `dist/`
- Imagen final no contiene: TypeScript, tests, ESLint, Prettier, Husky, ni source maps
- Base `node:22-alpine` minimiza el tamano (~180MB vs ~1GB con node:22)
- `docker-compose.yml` orquesta API + MongoDB 7 con healthcheck y volumen persistente

---

## Docker

### Servicios

| Servicio | Imagen                    | Puerto | Descripcion                                   |
| :------- | :------------------------ | :----: | :-------------------------------------------- |
| `api`    | Build local (multi-stage) |  8080  | Pokemon Stadium API (Fastify + Socket.IO)     |
| `mongo`  | mongo:7                   | 27017  | MongoDB con healthcheck y volumen persistente |

### Comandos

```bash
# Levantar todo (API + MongoDB)
docker compose up --build

# Solo MongoDB (para desarrollo local con pnpm dev)
docker compose up mongo

# Detener servicios
docker compose down

# Detener y eliminar datos (reset completo)
docker compose down -v
```

---

## Scripts

| Comando           | Descripcion                                       |
| :---------------- | :------------------------------------------------ |
| `pnpm dev`        | Servidor de desarrollo con hot-reload (tsx watch) |
| `pnpm build`      | Compilar TypeScript + resolver path aliases       |
| `pnpm start`      | Ejecutar build de produccion                      |
| `pnpm test`       | Ejecutar 25 tests con Vitest                      |
| `pnpm test:watch` | Tests en modo watch                               |
| `pnpm typecheck`  | Verificacion de tipos sin emitir                  |
| `pnpm lint`       | Linting con ESLint                                |
| `pnpm format`     | Formatear con Prettier                            |

---

## Tests

El proyecto incluye **25 tests funcionales** que validan el flujo completo de batalla usando implementaciones in-memory (fakes), sin necesidad de MongoDB ni servicios externos:

```
JoinLobby
  ✓ crea lobby si no existe uno activo
  ✓ segundo jugador se une al lobby existente
  ✓ rechaza tercer jugador (MAX_PLAYERS_REACHED)
  ✓ rechaza nickname duplicado

AssignPokemon
  ✓ asigna 3 Pokemon aleatorios al jugador
  ✓ no repite Pokemon entre jugadores

PlayerReady
  ✓ marca jugador como ready
  ✓ inicia batalla cuando ambos estan ready
  ✓ velocidad del Pokemon activo determina primer turno

ExecuteAttack
  ✓ calcula dano con efectividad de tipos
  ✓ alterna turnos correctamente
  ✓ rechaza ataque fuera de turno
  ✓ aplica dano minimo de 1
  ✓ genera PokemonDefeatedDTO cuando HP llega a 0
  ✓ genera PokemonSwitchDTO al activar siguiente Pokemon
  ✓ termina batalla cuando equipo completo es derrotado
  ✓ emite BattleFinishedEvent al terminar
  ✓ marca lobby como FINISHED
  ✓ HP nunca baja de 0

SwitchPokemon
  ✓ cambia Pokemon activo exitosamente
  ✓ consume el turno del jugador
  ✓ rechaza cambio al mismo Pokemon activo
  ✓ rechaza cambio fuera de turno
  ✓ rechaza indice de Pokemon invalido

Full Game Integration
  ✓ flujo completo: join → assign → ready → battle → winner
```

---

## Licencia

Este proyecto esta bajo la licencia MIT — ver el archivo [LICENSE](LICENSE) para mas detalles.

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=120&section=footer" />
