<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=180&section=header&text=Pok%C3%A9mon%20Stadium%20API&fontSize=36&fontColor=fff&animation=fadeIn&fontAlignY=32" />

<div align="center">

![Build](https://img.shields.io/github/actions/workflow/status/jarero321/pokemon-stadium-api/ci.yml?branch=develop&style=for-the-badge)
![License](https://img.shields.io/github/license/jarero321/pokemon-stadium-api?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)

**Backend de batallas Pokémon en tiempo real con API REST, WebSocket y Clean Architecture.**

[Inicio Rápido](#inicio-rápido) •
[Reglas de Negocio](#reglas-de-negocio) •
[Arquitectura](#arquitectura) •
[API REST](#api-rest) •
[Eventos WebSocket](#eventos-websocket) •
[Testing](#testing)

</div>

---

## Hola! 👋

Soy Carlos, y este es el backend de mi prueba técnica para **Sr. Fullstack Developer**.

### Lo que pedia el spec

Una app fullstack: catalogo de Pokémon, equipo aleatorio de 3, lobby con nickname, batalla en tiempo real, y un ganador.

### Lo que yo construi

Tome esos requisitos y los lleve mas alla:

- **Efectividad de tipos** con una matriz 15x15 completa (super efectivo, no muy efectivo, inmune) con multiplicadores acumulados para tipos duales
- **Sistema de matchmaking** sin necesidad de cuentas, solo un nickname y listo
- **Idempotencia real** con request IDs y cache MongoDB para prevenir ataques duplicados
- **Control de concurrencia** con mutex locks para que dos jugadores atacando "al mismo tiempo" nunca generen inconsistencias
- **Forfeit por desconexión** porque en un juego real, si alguien se va, el otro deberia ganar
- **Leaderboard persistente** con historial de batallas por jugador
- **Trace ID propagado** desde HTTP hasta WebSocket hasta MongoDB, porque debuggear en producción sin esto es una pesadilla

### Mi enfoque

No busque entregar algo pixel-perfect. Busque construir un **sistema que escala sin dolor**. La clave fue Clean Architecture: entender el dominio primero, modelar las entidades y operaciones como funciones puras, y despues implementar la infraestructura. Esto nos dio tests de integracion y flujos E2E reales usando Docker para desarrollo local y AWS (ECS Fargate + ALB) para producción.

Los commits son muchos, si. Pero usamos **atomic commits con GitFlow** para un historial 100% entendible. Funciones descriptivas, sin abstracciones innecesarias, codigo legible.

**Contacto**: jareroluis@gmail.com | +52 476 150 9858

---

## Contexto del Proyecto

Prueba técnica **Sr. Fullstack Developer** — construir una aplicación fullstack que permita:

1. Consultar un catalogo de Pokémon desde una API externa
2. Selecciónar un equipo de 3 Pokémon aleatorios
3. Ingresar a un lobby con un nickname
4. Enfrentar una batalla en tiempo real contra otro jugador
5. Determinar un ganador basado en reglas de combate

### API Externa de Pokémon

| Endpoint                                                       | Método | Respuesta                                                    |
| :------------------------------------------------------------- | :----: | :----------------------------------------------------------- |
| `https://pokemon-api-92034153384.us-central1.run.app/list`     |  GET   | `[{ id, name }]`                                             |
| `https://pokemon-api-92034153384.us-central1.run.app/list/:id` |  GET   | `[{ id, name, type[], hp, attack, defense, speed, sprite }]` |

---

## Decisiónes Técnicas

No es solo "que tecnologias use", sino **por que** cada una esta ahi.

| Decisión                                                    | Por que                                                                                                                                                                                                                                                              |
| :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fastify sobre Express**                                   | Fastify 5 es mas rápido, tiene validación de schemas nativa, y el plugin de Swagger genera docs automaticamente. Express es un clasico, pero para un proyecto nuevo no hay razon para no usar algo mejor.                                                            |
| **Socket.IO sobre WebSockets nativos**                      | Reconexión automatica, fallback a polling, rooms para lobbies, heartbeat. Implementar todo eso a mano con `ws` es reinventar la rueda.                                                                                                                               |
| **MongoDB con transacciónes**                               | Las batallas necesitan atomicidad: aplicar daño + actualizar turno + verificar si alguien murio, todo en una transacción. Sin esto, un crash a la mitad deja estado inconsistente. Por eso se requiere replica set.                                                  |
| **Mongoose con validación estricta**                        | Defensa en profundidad. Si por algun motivo el dominio no atrapa un dato invalido, Mongoose lo atrapa en la capa de persistencia. Doble red de seguridad.                                                                                                            |
| **Clean Architecture (Dominio/Aplicacion/Infraestructura)** | El dominio no sabe que existe MongoDB, ni Fastify, ni Socket.IO. Las operaciones de combate son funciones puras que reciben datos y devuelven resultados. Esto hace que los tests unitarios no necesiten mocks complejos y que cambiar la base de datos sea trivial. |
| **Mutex lock para turnos**                                  | Dos jugadores pueden enviar `attack` en el mismo milisegundo. Sin mutex, ambos se procesan y el juego se rompe. Con el lock, el segundo ataque espera a que el primero termine. Zero race conditions.                                                                |
| **Idempotency keys con TTL**                                | El cliente puede reintentar un ataque (timeout de red, etc). Sin idempotencia, el mismo ataque se aplica dos veces. Con request IDs cacheados en MongoDB, el segundo intento devuelve el resultado del primero sin re-ejecutar.                                      |
| **JWT stateless**                                           | No necesitamos sesiones en servidor. El token viaja en REST y en WebSocket, expira en 24h, y no requiere cuentas ni passwords. Simple y funcional.                                                                                                                   |
| **Trace ID propagado**                                      | Cada request HTTP genera un UUID que se propaga a WebSocket y a las queries de MongoDB. Cuando algo falla en producción, puedo rastrear todo el flujo con un solo ID.                                                                                                |
| **Cache SWR para el catalogo**                              | El catalogo de Pokémon no cambia. Cachearlo 12h con revalidación en background evita 500 requests a la API externa por nada.                                                                                                                                         |
| **MongoDB Atlas (Free Tier) + AWS**                         | Atlas da un cluster gratis con replica set (necesario para transacciónes). ECS Fargate + ALB para el backend, Amplify para el frontend. Infraestructura como codigo con CDK.                                                                                         |

---

## Más allá del spec

Cosas que no estaban en los requisitos pero que hacen la diferencia entre "cumple" y "funciona de verdad":

- **Efectividad de tipos**: Matriz 15x15 con super efectivo (1.5x), no muy efectivo (0.5x), inmune (0x), y multiplicadores acumulados para tipos duales. No es solo ATK - DEF.
- **Matchmaking sin cuentas**: Solo un nickname. Sin formularios de registro, sin passwords. Entras, juegas, te vas.
- **Forfeit automatico**: Si un jugador se desconecta durante batalla, el oponente gana. Porque esperar infinitamente no es una opcion.
- **Leaderboard con historial**: Top jugadores por win rate, historial de batallas por nickname.
- **Cache SWR**: El catalogo de Pokémon se cachea 12h con revalidación en background. No tiene sentido hacer 500 requests por los mismos datos.

---

## Reglas de Negocio

### Selección de Equipo

- Cada jugador recibe **3 Pokémon aleatorios** del catalogo
- **No se repiten** Pokémon entre jugadores
- La asignación es aleatoria cada vez (Fisher-Yates shuffle)

### Flujo de Batalla

```
WAITING → READY → BATTLING → FINISHED
```

- El lobby espera hasta que ambos jugadores esten marcados como **ready**
- El primer turno se asigna al jugador cuyo Pokémon activo tenga mayor **Speed**
- Los turnos son **estrictamente secuenciales** — solo un ataque a la vez
- Los ataques se procesan **atomicamente** en el servidor antes de permitir el siguiente turno

### Cálculo de Daño

```
Daño = floor((Ataque_atacante - Defensa_defensor) x Multiplicador_tipo)
```

- Si el resultado es menor a 1, el daño minimo es **1** (por spec)
- El HP del defensor se actualiza: `HP_actual = HP_actual - Daño`
- El HP **nunca baja de 0**

### Efectividad de Tipos

Matriz 15x15 de matchups con multiplicadores:

| Relacion        | Multiplicador |
| :-------------- | :------------ |
| Super efectivo  | 1.5x          |
| No muy efectivo | 0.5x          |
| Inmune          | 0x            |
| Neutral         | 1x            |

Los multiplicadores se **acumulan** para defensores de tipo dual.

### Derrota y Victoria

- Cuando el HP de un Pokémon llega a **0**, se considera derrotado
- Si el defensor tiene Pokémon disponibles, el siguiente **entra automaticamente**
- Si no quedan Pokémon, la batalla termina y se declara un **ganador**

### Notificaciones del Sistema

El servidor notifica a los jugadores cuando:

- La batalla inicia
- Se resuelve un turno (daño, HP restante, multiplicador)
- Un Pokémon es derrotado
- Un nuevo Pokémon entra en batalla
- La batalla termina y se declara ganador

### Estados del Lobby

| Estado     | Descripción                                    |
| :--------- | :--------------------------------------------- |
| `waiting`  | 2 jugadores conectados, esperando confirmación |
| `ready`    | Ambos jugadores confirmaron su equipo          |
| `battling` | Batalla en curso                               |
| `finished` | Hay un ganador, batalla terminada              |

---

## Que se implemento

| Caracteristica              | Descripción                                                                   |
| :-------------------------- | :---------------------------------------------------------------------------- |
| **Batallas en Tiempo Real** | Combate por turnos via Socket.IO con efectividad de tipos y switches forzados |
| **Clean Architecture**      | Dominio → Aplicacion → Infraestructura con regla de dependencia estricta      |
| **Sistema de Lobby**        | Maquina de estados con recuperacion ante desconexión                          |
| **Efectividad de Tipos**    | Matriz 15x15 con super efectivo, no efectivo, e inmune                        |
| **Autenticación JWT**       | Token para REST y WebSocket con expiración de 24h                             |
| **Idempotencia**            | Request ID + cache MongoDB previene ataques duplicados                        |
| **Control de Concurrencia** | Mutex lock previene race conditions en turnos simultaneos                     |
| **Observabilidad**          | Trace ID propagado HTTP → WebSocket → DB con Pino structured logging          |
| **Documentación API**       | Swagger/OpenAPI auto-generado en `/docs`                                      |
| **Cache SWR**               | Catalogo Pokémon cacheado 12h con revalidación en background                  |
| **Rate Limiting**           | 100 req/min global, 30 req/min en registro                                    |
| **Graceful Shutdown**       | Cierre limpio de conexiónes HTTP, WebSocket y MongoDB                         |
| **Forfeit por Desconexión** | Si un jugador se desconecta durante batalla, el oponente gana                 |

## Tech Stack

<div align="center">

**Lenguajes y Frameworks**

<img src="https://skillicons.dev/icons?i=ts,nodejs&perline=8" alt="languages" />

**Infraestructura y Herramientas**

<img src="https://skillicons.dev/icons?i=mongodb,docker,githubactions,pnpm&perline=8" alt="infra" />

</div>

| Tecnología               | Propósito                                             |
| :----------------------- | :---------------------------------------------------- |
| **Fastify 5**            | Servidor HTTP con rate limiting y Swagger             |
| **Socket.IO 4**          | Comunicación bidireccional en tiempo real             |
| **MongoDB / Mongoose 9** | Persistencia con transacciónes y TTL indexes          |
| **Zod 4**                | Validación runtime de env vars y payloads WebSocket   |
| **Pino**                 | Logging estructurado JSON con correlación de trace ID |
| **JWT**                  | Autenticación stateless con jsonwebtoken              |
| **Vitest**               | Testing unitario y E2E con fakes in-memory            |
| **Husky + lint-staged**  | Pre-commit hooks (prettier + eslint)                  |

## Inicio Rápido

### Prerequisitos

- Node.js >= 22
- pnpm
- MongoDB 7 con replica set (requerido para transacciónes)
- Docker (opcional, para setup rápido)

### Con Docker (recomendado)

```bash
# Levantar MongoDB + API
docker compose up -d

# API disponible en http://localhost:8080
# Swagger docs en http://localhost:8080/docs
```

### Desarrollo Local

```bash
# 1. Clonar e instalar
git clone https://github.com/jarero321/pokemon-stadium-api.git
cd pokemon-stadium-api
pnpm install

# 2. Levantar MongoDB con replica set
docker run -d --name pokemon-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec pokemon-mongo mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0,host:'localhost:27017'}]})"

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Iniciar servidor de desarrollo
pnpm dev
```

El servidor inicia en `http://0.0.0.0:8080`.

### Variables de Entorno

| Variable               | Descripción                                         | Default       |
| :--------------------- | :-------------------------------------------------- | :------------ |
| `PORT`                 | Puerto del servidor                                 | `8080`        |
| `HOST`                 | Direccion de bind                                   | `0.0.0.0`     |
| `MONGODB_URI`          | Cadena de conexión MongoDB (requiere replica set)   | _requerido_   |
| `POKEMON_API_BASE_URL` | URL de la API externa de Pokémon                    | _requerido_   |
| `JWT_SECRET`           | Secreto para firmar JWT (minimo 32 caracteres)      | _requerido_   |
| `NODE_ENV`             | Entorno (`development` / `production` / `test`)     | `development` |
| `CORS_ORIGIN`          | Origenes permitidos (`*` o URLs separadas por coma) | `*`           |

## Arquitectura

```
src/
├── core/                    # Dominio — cero dependencias externas
│   ├── entities/            # Pokémon, Player, Battle, Lobby (interfaces inmutables)
│   ├── operations/          # Funciones puras: combat, lobby, player
│   ├── interfaces/          # Puertos: ILobbyRepository, ITurnLock, IEventBus...
│   ├── errors/              # 10 errores de negocio tipados con HTTP status
│   ├── events/              # Eventos de dominio (BattleFinished)
│   ├── enums/               # LobbyStatus, PlayerStatus, PokémonType
│   └── typeEffectiveness.ts # Matriz de efectividad de tipos 15×15
├── application/             # Casos de uso y orquestación
│   ├── use-cases/           # 9 use cases (RegisterPlayer, JoinLobby, ExecuteAttack...)
│   ├── mappers/             # Transformaciones Entity → DTO
│   ├── dtos/                # LobbyDTO, BattleDTO
│   └── listeners/           # Handlers de eventos (UpdateLeaderboard)
├── infrastructure/          # Implementaciones concretas
│   ├── database/mongo/      # Schemas Mongoose + 3 repositorios + OperationRunner
│   ├── http/                # Servidor Fastify, rutas REST, middlewares
│   ├── websocket/           # Handlers Socket.IO + PlayerConnectionRegistry
│   ├── external/            # Cliente API Pokémon con cache SWR
│   ├── auth/                # Servicio JWT
│   ├── events/              # EventBus (wrapper de EventEmitter)
│   ├── locks/               # InMemoryTurnLock (mutex)
│   └── logger/              # PinoLogger
├── config/env.ts            # Validación de entorno con Zod
└── main.ts                  # Composition root (inyección de dependencias)
```

**Regla de dependencia**: `core ← application ← infrastructure`. Las capas internas **nunca** importan de capas externas.

### Decisiónes Arquitectonicas

| Decisión                           | Razón                                                                      |
| :--------------------------------- | :------------------------------------------------------------------------- |
| Socket.IO sobre WebSockets nativos | Reconexión automatica, fallbacks, rooms, heartbeat                         |
| REST para consultas stateless      | Cache-friendly, documentable con Swagger, no requiere conexión persistente |
| Mongoose con validación estricta   | Defensa en profundidad — validación en schema ademas de en dominio         |
| Trace ID propagado                 | Observabilidad end-to-end para debugging en producción                     |
| Transacciones MongoDB              | Atomicidad en escrituras criticas (ataques, fin de batalla)                |
| Idempotency keys con TTL           | Prevención de efectos duplicados por reintentos del cliente                |

## API REST

| Endpoint                         | Método | Auth | Descripción                       |
| :------------------------------- | :----: | :--: | :-------------------------------- |
| `/api/players/register`          |  POST  |  —   | Registrar entrenador, recibir JWT |
| `/api/pokemon`                   |  GET   |  —   | Catalogo Pokémon (cache 12h)      |
| `/api/leaderboard`               |  GET   |  —   | Top jugadores por win rate        |
| `/api/players/:nickname/history` |  GET   | JWT  | Historial de batallas del jugador |
| `/api/health`                    |  GET   |  —   | Health check + estado de MongoDB  |

### Ejemplo de Registro

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
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-15T10:30:00.000Z"
}
```

### Formato de Respuesta Estándar

Todas las respuestas siguen este formato:

```json
{
  "success": true | false,
  "data": { ... } | null,
  "error": { "code": "ERROR_CODE", "message": "..." } | null,
  "traceId": "uuid",
  "timestamp": "ISO 8601"
}
```

## Eventos WebSocket

Conexión con `socket.io-client` usando el JWT:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  transports: ['websocket'],
  auth: { token: 'tu-jwt-token' },
});
```

### Cliente → Servidor

| Evento           | Payload                                        | Descripción                    |
| :--------------- | :--------------------------------------------- | :----------------------------- |
| `join_lobby`     | —                                              | Unirse o crear lobby           |
| `assign_pokemon` | —                                              | Solicitar 3 Pokémon aleatorios |
| `ready`          | —                                              | Confirmar equipo, marcar listo |
| `attack`         | `{ requestId: UUID }`                          | Atacar con Pokémon activo      |
| `switch_pokemon` | `{ requestId: UUID, targetPokémonIndex: 0-2 }` | Cambiar Pokémon activo         |

### Servidor → Cliente

| Evento             | Descripción                                              |
| :----------------- | :------------------------------------------------------- |
| `lobby_status`     | Sincronización completa del estado del lobby             |
| `battle_start`     | La batalla inicia (ambos jugadores listos)               |
| `turn_result`      | Resultado del turno: daño, HP actualizado, multiplicador |
| `pokemon_defeated` | Un Pokémon fue derrotado                                 |
| `pokemon_switch`   | Un Pokémon entro en batalla                              |
| `battle_end`       | Ganador declarado                                        |
| `error`            | Error con codigo y mensaje                               |

### Flujo de Batalla

```
Jugador 1                   Servidor                  Jugador 2
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

## Persistencia

Todos los datos de batalla se persisten en MongoDB:

| Coleccion        | Datos                                                                 |
| :--------------- | :-------------------------------------------------------------------- |
| **PlayerStats**  | nickname, wins, losses, totalBattles, winRate, battleHistory          |
| **Lobby**        | status, players[], currentTurnIndex, battleId, winner, timestamps     |
| **Battle**       | players[], turns[] (audit trail completo), winner, status, timestamps |
| **PokémonCache** | Catalogo cacheado con TTL de 24h                                      |
| **Idempotency**  | Resultados de operaciones cacheados con TTL de 1h                     |

## Testing

```bash
# Tests unitarios (57 tests — dominio + casos de uso)
pnpm test

# Tests E2E (102 tests — requiere Docker)
pnpm test:e2e

# Type checking
pnpm typecheck

# Lint + format
pnpm lint && pnpm format
```

### Cobertura de Tests

| Suite             | Tests | Alcance                                                         |
| :---------------- | ----: | :-------------------------------------------------------------- |
| Core Operations   |    24 | Cálculo de daño, efectividad de tipos, operaciones lobby/player |
| Battle Flow       |    25 | Ciclo completo con fakes: join → attack → switch → win          |
| Register Player   |     8 | Validación, idempotencia, edge cases                            |
| Auth E2E          |    14 | Flujo JWT, rutas protegidas, auth WebSocket                     |
| Game Flow E2E     |    26 | Endpoints REST, ciclo de vida completo                          |
| Battle Sync E2E   |    27 | Sincronización de turnos, switch forzado, reconexión, forfeit   |
| Disconnection E2E |    22 | Desconexión en lobby/batalla, reconexión, ciclos rápidos        |
| Idempotency E2E   |     9 | Manejo de requests duplicados                                   |
| Rate Limit E2E    |     4 | Throttling de endpoints                                         |

**Total: 159 tests** (57 unitarios + 102 E2E)

## Scripts

| Comando          | Descripción                                         |
| :--------------- | :-------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo con hot reload               |
| `pnpm build`     | Build de producción (TypeScript + alias resolution) |
| `pnpm start`     | Iniciar servidor de producción                      |
| `pnpm test`      | Ejecutar tests unitarios                            |
| `pnpm test:e2e`  | Ejecutar tests E2E (Docker)                         |
| `pnpm typecheck` | Verificación de tipos TypeScript                    |
| `pnpm lint`      | ESLint                                              |
| `pnpm format`    | Prettier                                            |

## Deployment (AWS)

La infraestructura se define como codigo con **AWS CDK** en `/infra`. Un solo `cdk deploy --all` levanta ambos stacks.

### Arquitectura Cloud

```
                    ┌─────────────────────────┐
                    │     AWS Amplify          │
                    │  (Next.js SSR Frontend)  │
                    │  Auto-deploy from main   │
                    └───────────┬──────────────┘
                                │ NEXT_PUBLIC_API_URL
                                ▼
┌───────────────────────────────────────────────────┐
│                    ALB (public)                    │
│              idle_timeout: 3600s (WS)             │
│              health: /api/health                   │
└───────────────────────┬───────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────┐
│               ECS Fargate Service                  │
│          cpu: 256  |  memory: 512 MiB              │
│          image: ECR (Docker from repo)             │
│          port: 8080                                │
│                                                    │
│   env:                                             │
│     MONGODB_URI     ← Secrets Manager              │
│     JWT_SECRET      ← Secrets Manager (auto-gen)   │
│     POKEMON_API_URL ← hardcoded                    │
│     CORS_ORIGIN     ← configurable                 │
└────────────────────────────────────────────────────┘
                        │
                  MongoDB Atlas
              (connection string en
               Secrets Manager)
```

### Stacks

| Stack                    | Recursos                                                                  | Descripción             |
| :----------------------- | :------------------------------------------------------------------------ | :---------------------- |
| `PokémonStadiumApi`      | VPC, ECS Cluster, Fargate Service, ALB, Secrets Manager, GitHub OIDC Role | Backend API + WebSocket |
| `PokémonStadiumFrontend` | Amplify App, Branch (main, auto-build)                                    | Frontend Next.js SSR    |

### Deployment desde cero

```bash
# 1. Configurar contexto (owner de GitHub)
cd infra
sed -i 's/GITHUB_OWNER/tu-usuario-github/' cdk.json

# 2. Crear secreto de MongoDB Atlas (una sola vez)
aws secretsmanager create-secret \
  --name pokemon-stadium/mongodb-uri \
  --secret-string "mongodb+srv://user:pass@cluster.mongodb.net/pokemon-stadium"

# 3. Crear GitHub PAT para Amplify (una sola vez)
aws secretsmanager create-secret \
  --name pokemon-stadium/github-token \
  --secret-string "ghp_xxxxxxxxxxxx"

# 4. Instalar dependencias CDK
npm ci

# 5. Deploy (primera vez necesita bootstrap)
npx cdk bootstrap
npx cdk deploy --all
```

### CI/CD

| Trigger                  | Pipeline               | Acciones                               |
| :----------------------- | :--------------------- | :------------------------------------- |
| Push a `develop` (API)   | GitHub Actions CI      | Typecheck, Lint, Unit Tests, E2E Tests |
| Push a `main` (API)      | GitHub Actions Deploy  | CDK diff + deploy a ECS Fargate        |
| Push a `main` (Frontend) | AWS Amplify Auto-build | Build Next.js + deploy SSR             |

**GitHub OIDC**: El deploy usa `AssumeRoleWithWebIdentity` — sin access keys de larga duración. El rol `pokemon-stadium-deploy` se crea automaticamente por CDK.

### Costos estimados

| Recurso                            | Costo aprox. (us-east-1) |
| :--------------------------------- | :----------------------- |
| Fargate (256 CPU, 512 MiB, 1 task) | ~$9/mes                  |
| ALB                                | ~$16/mes                 |
| Amplify Hosting (SSR)              | ~$0-5/mes (free tier)    |
| Secrets Manager (3 secrets)        | ~$1.20/mes               |
| **Total**                          | **~$26-31/mes**          |

## Known Limitations / Future Improvements

| Limitación            | Contexto                                              | Mejora futura                                            |
| :-------------------- | :---------------------------------------------------- | :------------------------------------------------------- |
| Single lobby          | Por spec: "a single one that handles an unique match" | Multiplex con rooms de Socket.IO                         |
| Mutex in-memory       | Funciona para single instance                         | Redis distributed lock para horizontal scaling           |
| No horizontal scaling | Un solo Fargate task                                  | Auto-scaling group + Redis para state compartido         |
| Sin cuenta de usuario | Solo nickname, sin password                           | OAuth / magic link si se requiere persistencia de sesion |
| CORS abierto en dev   | `*` en desarrollo local                               | Restringido a dominio de Amplify en producción           |

## Licencia

Este proyecto esta licenciado bajo la Licencia MIT.

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,5,30&height=120&section=footer" />
