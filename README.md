<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=180&section=header&text=Pokemon%20Stadium%20Lite&fontSize=36&fontColor=fff&animation=fadeIn&fontAlignY=32" />

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/node-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

</div>

---

## Hola dev, ¿cómo estás?

Si estás leyendo esto, probablemente estás revisando el code challenge — así que antes de sumergirte en el código, quiero darte contexto de **por qué** las cosas están donde están y **qué decisiones** se tomaron.

Este proyecto es una **API backend en tiempo real** para batallas Pokémon 1v1. Dos jugadores se conectan, reciben equipos aleatorios, y se enfrentan por turnos con efectividad de tipos incluida. Todo persiste en MongoDB y el flujo de batalla corre sobre WebSockets.

Lo que más me importó al construirlo fue que **el código se lea como el negocio**: las variables dicen qué representan, los errores son tipados por dominio, y la arquitectura permite cambiar cualquier pieza de infraestructura sin tocar una sola línea de lógica.

Espero que sea una lectura agradable. Cualquier duda, con gusto la platicamos.

[Inicio Rápido](#-inicio-rápido) •
[Arquitectura](#-arquitectura) •
[API REST](#-api-rest) •
[WebSocket](#-eventos-websocket) •
[ADR](#-architecture-decision-records) •
[Docker](#-docker)

---

## Características

| Característica                | Descripción                                                         |
| :---------------------------- | :------------------------------------------------------------------ |
| **Batallas en tiempo real**   | Sistema de turnos 1v1 vía WebSocket con Socket.IO                   |
| **Efectividad de tipos**      | Cálculo de daño basado en la tabla oficial de tipos Pokémon         |
| **Lobby automático**          | Matchmaking: el primer jugador crea el lobby, el segundo se une     |
| **Equipo aleatorio**          | Asignación de 3 Pokémon aleatorios sin repetición entre jugadores   |
| **Leaderboard**               | Ranking de jugadores por win rate con historial de batallas         |
| **Swagger UI**                | Documentación interactiva de la API REST en `/docs`                 |
| **Trace ID**                  | Trazabilidad end-to-end en cada request HTTP y conexión WebSocket   |
| **Validación en profundidad** | Mongoose valida tipos, rangos y constraints a nivel de persistencia |
| **Docker ready**              | Un solo `docker compose up` levanta API + MongoDB                   |

## Tech Stack

<div align="center">

**Lenguajes & Frameworks**

<img src="https://skillicons.dev/icons?i=ts,nodejs,fastify&perline=8" alt="languages" />

**Infraestructura & Herramientas**

<img src="https://skillicons.dev/icons?i=mongodb,docker,pnpm,vitest&perline=8" alt="infra" />

</div>

| Dependencia   | Versión | Propósito                                      |
| :------------ | :-----: | :--------------------------------------------- |
| **Fastify**   |   5.8   | Servidor HTTP (REST API + Swagger)             |
| **Socket.IO** |   4.8   | Comunicación bidireccional en tiempo real      |
| **Mongoose**  |   9.3   | ODM para MongoDB con validación a nivel schema |
| **Pino**      |  10.3   | Logging estructurado de alta performance       |
| **Zod**       |   4.3   | Validación de variables de entorno             |
| **Vitest**    |   4.0   | Testing unitario y de integración              |

---

## Inicio Rápido

### Prerequisitos

- Node.js >= 22
- pnpm >= 10
- MongoDB 7+ (o usar Docker)

### Instalación local

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

| Variable               | Descripción                                   | Default       | Requerida |
| :--------------------- | :-------------------------------------------- | :------------ | :-------: |
| `PORT`                 | Puerto del servidor                           | `8080`        |    No     |
| `HOST`                 | Host de escucha                               | `0.0.0.0`     |    No     |
| `MONGODB_URI`          | URI de conexión a MongoDB                     | —             |    Sí     |
| `POKEMON_API_BASE_URL` | URL base de la Pokémon API externa            | —             |    Sí     |
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

Cero dependencias externas. Define **qué** hace el sistema:

- **Entities** — Estructuras de datos del negocio (`Lobby`, `Player`, `Pokemon`, `Battle`, `PlayerStats`)
- **Interfaces** — Contratos que la infraestructura debe implementar (`ILobbyRepository`, `IBattleRepository`, `IPokemonApiService`, `ITurnLock`)
- **Errors** — Errores de negocio tipados (`LobbyFullError`, `NotYourTurnError`, `BattleFinishedError`)
- **Events** — Eventos de dominio (`BattleFinishedEvent`) para comunicación desacoplada entre capas
- **typeEffectiveness** — Tabla de efectividad de tipos Pokémon (fuego > planta, agua > fuego, etc.)

### Application (Casos de Uso)

Orquesta la lógica de negocio. Define **cómo** se ejecutan las operaciones:

| Use Case            | Responsabilidad                                                   |
| :------------------ | :---------------------------------------------------------------- |
| `JoinLobby`         | Crear lobby o unir segundo jugador, máximo 2 por lobby            |
| `AssignPokemon`     | Asignar 3 Pokémon aleatorios sin repetición entre jugadores       |
| `PlayerReady`       | Marcar jugador listo, iniciar batalla cuando ambos están ready    |
| `ExecuteAttack`     | Calcular daño con efectividad de tipos, turno alternado con mutex |
| `SwitchPokemon`     | Cambiar Pokémon activo (consume turno)                            |
| `GetPokemonCatalog` | Obtener catálogo de Pokémon desde API externa                     |
| `GetLeaderboard`    | Ranking de jugadores ordenado por win rate                        |
| `GetPlayerHistory`  | Stats y batallas de un jugador específico                         |

**Listeners** (reaccionan a eventos de dominio):

- `ResetLobby` — Limpia el lobby cuando una batalla termina
- `UpdateLeaderboard` — Actualiza wins/losses del ganador y perdedor

### Infrastructure (Implementaciones)

Adaptadores concretos. Define **con qué** se conecta el sistema:

- **MongoDB** — Mongoose schemas con validación + índices, y 3 repositorios
- **HTTP** — Fastify server con Swagger, middleware de traceId, errorHandler estandarizado
- **WebSocket** — Socket.IO con `PlayerConnectionRegistry`, handlers por dominio, `withErrorBoundary`
- **External** — `PokemonApiService` consume la PokeAPI para catálogo y stats
- **Logger** — `PinoLogger` con child loggers contextuales (traceId, socketId)
- **Locks** — `InMemoryTurnLock` para prevenir race conditions en turnos simultáneos

---

## Persistencia: Validación e Índices

La lógica de negocio valida todo antes de llegar al repositorio, pero Mongoose actúa como **defensa en profundidad** — si algo inesperado pasa, la base de datos rechaza el documento en lugar de corromper los datos.

### Validaciones a nivel schema

| Schema          | Campo                              | Validación                          | Por qué                                        |
| :-------------- | :--------------------------------- | :---------------------------------- | :--------------------------------------------- |
| **Pokemon**     | `hp`, `attack`, `defense`, `speed` | `min: 0`                            | Ningún stat puede ser negativo                 |
| **Pokemon**     | `maxHp`                            | `min: 1`                            | Un Pokémon siempre tiene al menos 1 HP máximo  |
| **Pokemon**     | `type`                             | `validate: length > 0`              | Todo Pokémon tiene al menos un tipo            |
| **Pokemon**     | `id`                               | `min: 1`                            | IDs de la PokéAPI empiezan en 1                |
| **Player**      | `nickname`                         | `minlength: 1, maxlength: 20, trim` | Evita nicknames vacíos o exageradamente largos |
| **Player**      | `team`                             | `validate: length <= 3`             | Máximo 3 Pokémon por equipo                    |
| **Player**      | `activePokemonIndex`               | `min: 0, max: 2`                    | Índice válido dentro del equipo de 3           |
| **Lobby**       | `players`                          | `validate: length <= 2`             | Máximo 2 jugadores por lobby                   |
| **Lobby**       | `currentTurnIndex`                 | `min: 0, max: 1`                    | Solo hay 2 jugadores (índice 0 o 1)            |
| **Battle**      | `status`                           | `enum: ['in_progress', 'finished']` | Solo estados válidos                           |
| **Battle**      | `damage`                           | `min: 0`                            | El daño nunca es negativo                      |
| **PlayerStats** | `winRate`                          | `min: 0, max: 1`                    | El win rate es un porcentaje entre 0 y 1       |
| **PlayerStats** | `wins`, `losses`, `totalBattles`   | `min: 0`                            | Contadores no pueden ser negativos             |

### Índices

| Collection    | Índice                           | Tipo      | Justificación                                                                                              |
| :------------ | :------------------------------- | :-------- | :--------------------------------------------------------------------------------------------------------- |
| `lobbies`     | `status`                         | Simple    | `findActive()` busca por `status ≠ FINISHED` en **cada acción de batalla** — sin índice es collection scan |
| `battles`     | `players.nickname` + `startedAt` | Compuesto | `findByPlayer()` busca por nickname y ordena por fecha — optimiza historial de jugador                     |
| `battles`     | `status`                         | Simple    | Consulta de batallas activas                                                                               |
| `battles`     | `startedAt`                      | Simple    | Ordenamiento por fecha en queries de historial                                                             |
| `playerstats` | `nickname`                       | Unique    | Lookup por nickname + garantía de unicidad                                                                 |
| `playerstats` | `winRate` + `wins`               | Compuesto | `getLeaderboard()` ordena por win rate descendente — evita sort en memoria                                 |

---

## Reglas de Dominio

- **Lobby**: máximo 2 jugadores, máquina de estados: `WAITING` → `READY` → `BATTLING` → `FINISHED`
- **Player**: máquina de estados: `JOINED` → `TEAM_ASSIGNED` → `READY` → `BATTLING`
- **Race conditions**: Mutex in-memory (`ITurnLock`) bloquea durante procesamiento de turno
- **Efectividad de tipos**: 15 tipos, multiplicadores 1.5x (super efectivo) / 0.5x (no efectivo) / 0x (inmune)
- **Fórmula de daño**: `floor((ATK - DEF) * typeMultiplier)`, mínimo 1, HP nunca baja de 0
- **Auto-switch**: Cuando un Pokémon cae, el siguiente vivo se activa automáticamente
- **Trazabilidad**: Cada turno se persiste en la entidad `Battle` con datos completos de ataque/defensa/daño
- **Desconexión**: Si un jugador se desconecta durante batalla, el oponente gana por forfeit

---

## Estructura del Proyecto

```
src/
├── core/                              # Dominio puro (sin dependencias)
│   ├── entities/                      #   Lobby, Player, Pokemon, Battle, PlayerStats
│   ├── enums/                         #   LobbyStatus, PlayerStatus, PokemonType
│   ├── errors/                        #   BusinessError + errores específicos
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
│   ├── database/mongo/                #   Schemas (con validación) + Repositories
│   ├── http/                          #   Fastify server, rutas, middlewares
│   │   ├── middlewares/               #     traceId, errorHandler
│   │   ├── routes/                    #     pokemonRoutes (REST endpoints)
│   │   ├── ApiResponse.ts            #     Formato estándar de respuesta
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
│   └── env.ts                         # Validación con Zod
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

Todas las respuestas siguen un formato estándar con trazabilidad:

```json
{
  "success": true,
  "data": { "..." },
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

| Método | Endpoint                         | Descripción                             |
| :----: | :------------------------------- | :-------------------------------------- |
| `GET`  | `/api/pokemon`                   | Catálogo de Pokémon disponibles (Gen 1) |
| `GET`  | `/api/leaderboard?limit=10`      | Ranking de jugadores por win rate       |
| `GET`  | `/api/players/:nickname/history` | Stats y batallas de un jugador          |
| `GET`  | `/api/health`                    | Health check del servidor               |
| `GET`  | `/docs`                          | Swagger UI interactivo                  |

### Trazabilidad (Trace ID)

Cada request HTTP recibe un `traceId` único (UUID v4):

- Si el cliente envía el header `X-Trace-Id`, se reutiliza (trazabilidad end-to-end desde frontend)
- Si no viene, el servidor genera uno automáticamente
- Se incluye en el response header `X-Trace-Id` y en el body
- Todos los logs del request incluyen el `traceId` para correlación

---

## Eventos WebSocket

La conexión WebSocket se establece en `ws://localhost:8080` vía Socket.IO.

### Flujo de Batalla

```
Cliente                          Servidor
  │                                │
  │─── join_lobby {nickname} ────>│  Crear/unir lobby
  │<── lobby_status ──────────────│
  │                                │
  │─── assign_pokemon ───────────>│  Asignar 3 Pokémon aleatorios
  │<── lobby_status ──────────────│
  │                                │
  │─── ready ────────────────────>│  Marcar jugador listo
  │<── lobby_status ──────────────│
  │<── battle_start ──────────────│  (cuando ambos están ready)
  │                                │
  │─── attack ───────────────────>│  Ejecutar ataque
  │<── turn_result ───────────────│  Resultado del turno
  │<── pokemon_defeated ──────────│  (si Pokémon fue derrotado)
  │<── pokemon_switch ────────────│  (cambio automático al siguiente)
  │<── lobby_status ──────────────│
  │                                │
  │─── switch_pokemon {index} ───>│  Cambiar Pokémon activo (consume turno)
  │<── lobby_status ──────────────│
  │                                │
  │<── battle_end ────────────────│  (equipo completo derrotado)
```

### Eventos del Cliente → Servidor

| Evento           | Payload                          | Descripción                        |
| :--------------- | :------------------------------- | :--------------------------------- |
| `join_lobby`     | `{ nickname: string }`           | Unirse al lobby activo             |
| `assign_pokemon` | —                                | Solicitar asignación de equipo     |
| `ready`          | —                                | Marcar jugador como listo          |
| `attack`         | —                                | Ejecutar ataque con Pokémon activo |
| `switch_pokemon` | `{ targetPokemonIndex: number }` | Cambiar Pokémon activo             |

### Eventos del Servidor → Cliente

| Evento             | Payload                       | Descripción                      |
| :----------------- | :---------------------------- | :------------------------------- |
| `lobby_status`     | `LobbyDTO`                    | Estado actual del lobby          |
| `battle_start`     | `LobbyDTO`                    | La batalla inició                |
| `turn_result`      | `TurnResultDTO`               | Resultado de un turno            |
| `pokemon_defeated` | `PokemonDefeatedDTO`          | Un Pokémon fue derrotado         |
| `pokemon_switch`   | `PokemonSwitchDTO`            | Cambio al siguiente Pokémon vivo |
| `battle_end`       | `{ winner, loser, battleId }` | La batalla terminó               |
| `error`            | `{ code, message }`           | Error de negocio o inesperado    |

### Manejo de Desconexión

Si un jugador se desconecta durante una batalla activa:

1. El oponente gana automáticamente por forfeit
2. Se emite `battle_end` con `reason: "opponent_disconnected"`
3. El lobby se marca como `FINISHED`
4. El registro de conexiones se limpia

---

## Architecture Decision Records

### ADR-001: Socket.IO para batallas en tiempo real

**Contexto**: Las batallas son interacciones bidireccionales de baja latencia donde ambos jugadores necesitan ver los resultados instantáneamente.

**Decisión**: Usar Socket.IO sobre WebSockets nativos.

**Razones**:

- Reconexión automática con backoff exponencial
- Rooms nativos para broadcasting selectivo (solo jugadores del lobby reciben eventos)
- Fallback a long-polling si WebSocket no está disponible
- Protocolo de heartbeat (`pingInterval: 10s`, `pingTimeout: 5s`) para detección rápida de desconexiones
- `PlayerConnectionRegistry` como capa de abstracción que mapea `socketId ↔ nickname` y gestiona membership al room `active-lobby`

### ADR-002: REST para consultas stateless

**Contexto**: El catálogo de Pokémon, leaderboard e historial son consultas de solo lectura sin estado de sesión.

**Decisión**: Separar estas operaciones en endpoints REST (Fastify) en lugar de canalizarlas por WebSocket.

**Razones**:

- Cacheables por HTTP (ETags, Cache-Control)
- Consumibles por cualquier cliente sin establecer conexión WebSocket
- Documentables vía Swagger/OpenAPI con schemas tipados
- Cada request es independiente — no requiere estado de conexión
- Fastify comparte el mismo servidor HTTP con Socket.IO (puerto único)

### ADR-003: Mongoose con validación sin migraciones

**Contexto**: MongoDB es schemaless por naturaleza. La lógica de negocio valida en los use cases, pero necesitamos una segunda línea de defensa a nivel de persistencia.

**Decisión**: Definir validaciones estrictas en los Mongoose schemas (min/max, enums, constraints) e índices optimizados para las queries críticas. No usar sistema de migraciones.

**Razones**:

- **Defensa en profundidad**: si un bug en la app deja pasar datos inválidos, Mongoose los rechaza antes de que lleguen a MongoDB
- Las collections se crean automáticamente al primer `create()`
- Los índices se sincronizan vía `autoIndex` de Mongoose al conectar
- El proyecto inicia con base de datos vacía — no hay datos previos que migrar
- Los subdocumentos embebidos (Pokémon dentro de Player, turns dentro de Battle) no requieren relaciones ni joins

### ADR-004: Trace ID como middleware

**Contexto**: En un sistema con múltiples capas (HTTP → Use Case → Repository → DB), correlacionar logs de una misma operación es crítico para debugging en producción.

**Decisión**: Implementar middleware que genera o propaga un `traceId` (UUID v4) por cada request HTTP, y un traceId por conexión WebSocket.

**Razones**:

- Permite buscar todos los logs de un request con un solo filtro (`traceId: "abc-123"`)
- El cliente puede enviar su propio `X-Trace-Id` para trazabilidad end-to-end (frontend → backend → DB)
- El traceId viaja en el response body y header, facilitando soporte al usuario ("dame tu traceId")
- En WebSocket, cada conexión recibe un traceId que se propaga a todos los logs vía `logger.child({ traceId })`
- Compatible con herramientas de observabilidad (Datadog, CloudWatch, Grafana Loki)

### ADR-005: tsc-alias para resolución de path aliases

**Contexto**: Los path aliases de TypeScript (`@core/*`, `@infrastructure/*`) mejoran la legibilidad de imports, pero `tsc` no los resuelve en el JavaScript compilado.

**Decisión**: Usar `tsc-alias` como paso post-compilación para reescribir los aliases a rutas relativas.

**Razones**:

- En desarrollo: `tsx` (hot-reload) y `vitest` (vía `vite-tsconfig-paths`) resuelven los aliases automáticamente
- En producción: `node dist/main.js` necesita rutas relativas reales (`@core/entities/index` → `./core/entities/index`)
- El build es: `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json`
- Alternativas evaluadas y descartadas:
  - `tsconfig-paths/register` — overhead en runtime, dependencia adicional en producción
  - `moduleResolution: NodeNext` — requiere extensiones `.js` en todos los imports, afecta DX
  - Subpath imports (`#core/*`) — sintaxis no estándar, pobre soporte en tooling

### ADR-006: Multi-stage Docker build

**Contexto**: La imagen de producción debe ser lo más ligera posible, sin devDependencies, código fuente TypeScript, ni herramientas de desarrollo.

**Decisión**: Dockerfile con dos stages — `build` (compila) y `production` (solo runtime).

**Razones**:

- **Stage build**: instala todas las deps, ejecuta `tsc` + `tsc-alias`, genera `dist/`
- **Stage production**: instala solo deps de producción (`pnpm install --frozen-lockfile --prod`), copia `dist/`
- Imagen final no contiene: TypeScript, tests, ESLint, Prettier, Husky, ni source maps
- Base `node:22-alpine` minimiza el tamaño (~180MB vs ~1GB con node:22)
- `docker-compose.yml` orquesta API + MongoDB 7 con healthcheck y volumen persistente

---

## Docker

### Servicios

| Servicio | Imagen                    | Puerto | Descripción                                   |
| :------- | :------------------------ | :----: | :-------------------------------------------- |
| `api`    | Build local (multi-stage) |  8080  | Pokémon Stadium API (Fastify + Socket.IO)     |
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

| Comando           | Descripción                                       |
| :---------------- | :------------------------------------------------ |
| `pnpm dev`        | Servidor de desarrollo con hot-reload (tsx watch) |
| `pnpm build`      | Compilar TypeScript + resolver path aliases       |
| `pnpm start`      | Ejecutar build de producción                      |
| `pnpm test`       | Ejecutar 25 tests con Vitest                      |
| `pnpm test:watch` | Tests en modo watch                               |
| `pnpm typecheck`  | Verificación de tipos sin emitir                  |
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
  ✓ asigna 3 Pokémon aleatorios al jugador
  ✓ no repite Pokémon entre jugadores

PlayerReady
  ✓ marca jugador como ready
  ✓ inicia batalla cuando ambos están ready
  ✓ velocidad del Pokémon activo determina primer turno

ExecuteAttack
  ✓ calcula daño con efectividad de tipos
  ✓ alterna turnos correctamente
  ✓ rechaza ataque fuera de turno
  ✓ aplica daño mínimo de 1
  ✓ genera PokemonDefeatedDTO cuando HP llega a 0
  ✓ genera PokemonSwitchDTO al activar siguiente Pokémon
  ✓ termina batalla cuando equipo completo es derrotado
  ✓ emite BattleFinishedEvent al terminar
  ✓ marca lobby como FINISHED
  ✓ HP nunca baja de 0

SwitchPokemon
  ✓ cambia Pokémon activo exitosamente
  ✓ consume el turno del jugador
  ✓ rechaza cambio al mismo Pokémon activo
  ✓ rechaza cambio fuera de turno
  ✓ rechaza índice de Pokémon inválido

Full Game Integration
  ✓ flujo completo: join → assign → ready → battle → winner
```

---

## Licencia

Este proyecto está bajo la licencia MIT — ver el archivo [LICENSE](LICENSE) para más detalles.

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=120&section=footer" />
