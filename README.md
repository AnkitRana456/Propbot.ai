# PropBot Pro

> Production-grade, multi-tenant AI conversion platform (chatbot + CRM + lead delivery) for real estate agencies, developers and brokers.

---

## Architecture Overview

PropBot Pro is structured as a high-performance **pnpm monorepo**:

- **`apps/api`**: Modular monolith Express backend (ES modules) with dual entry points:
  - `src/server.ts` (API Web Service)
  - `src/worker.ts` (Background Worker daemon)
- **`apps/web`**: Single Page Application dashboard powered by React 18, Vite, TypeScript, and Tailwind.
- **`packages/shared`**: Shared Zod schemas and inferred static TypeScript types (`z.infer`) acting as the single source of truth across all modules (domain events, guarded actions, workflows, auth).
- **`packages/widget`**: Framework-free vanilla TypeScript chat widget compiled to a standalone bundle (<60 KB) with Shadow DOM isolation.

---

## Prerequisites

- **Node.js**: `v20.x` or higher (`v22.x` recommended)
- **pnpm**: `v9.x`
- **Docker & Docker Compose** (for PostgreSQL + pgvector and Redis)

---

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Start Backing Services (Docker)

```bash
docker compose up -d
```

### 4. Development Modes

```bash
# Start all apps in parallel
pnpm dev

# Start API only
pnpm dev:api

# Start Worker only
pnpm dev:worker

# Start Web dashboard only
pnpm dev:web
```

---

## Verification & Quality Gates

```bash
# Typecheck all packages using TypeScript project references
pnpm typecheck

# Lint with ESLint
pnpm lint

# Run automated tests
pnpm test

# Build all packages and applications
pnpm build
```

---

## Health Check

Once the API is running, verify service liveness:

```bash
curl http://localhost:3000/healthz
```
