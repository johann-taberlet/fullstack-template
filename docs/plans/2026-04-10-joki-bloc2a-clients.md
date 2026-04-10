# Joki — Bloc 2A : Feature Clients

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implementer la feature Clients complete : types Zod, service CRUD, API REST, composants UI (liste + formulaire), et pages dashboard.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposee via Route Handlers REST (`/api/v1/*`) et consommee par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Zod, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

**Branch :** `feature/clients` (worktree `../joki-clients`)

---

## Contexte : ce qui existe deja (Bloc 1 termine)

Le trunk (Tasks 1-8) a ete complete. Les fichiers et structures suivants sont en place :

- **`prisma/schema.prisma`** — Schema complet avec TOUS les modeles (user, session, verification, ClientProfile, Project, ProjectClient, Task, TimeEntry, Invoice, InvoiceItem, Comment). Ne pas le modifier.
- **`src/shared/lib/prisma.ts`** — Singleton Prisma client
- **`src/shared/lib/api.ts`** — Helpers de reponse : `jsonResponse`, `errorResponse`, `notFound`, `forbidden`, `unauthorized`
- **`src/shared/lib/auth-middleware.ts`** — Fonctions `getSession()`, `requireSession()`, `requireAdmin()`
- **`src/shared/types/index.ts`** — Types `Role`, `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`
- **`src/features/auth/lib.ts`** — Config Better Auth serveur (Prisma adapter, admin, magicLink)
- **`src/features/auth/client.ts`** — Client Better Auth (signIn, signUp, signOut, useSession)
- **`src/features/auth/types.ts`** — Type `AuthUser`
- **`src/features/auth/components/`** — LoginForm, SetupPasswordForm
- **`src/app/(auth)/`** — Pages `/login` et `/setup` avec layout centre
- **`src/app/(dashboard)/layout.tsx`** — Layout protege avec sidebar et header
- **`src/app/(dashboard)/page.tsx`** — Page Dashboard placeholder
- **`src/shared/components/ui/sidebar.tsx`** — Sidebar avec navigation
- **`src/shared/components/ui/header.tsx`** — Header avec deconnexion

**REGLE :** Ne modifier aucun fichier hors du scope de cette feature. Creer uniquement des fichiers dans `src/features/clients/`, `src/app/api/v1/clients/`, et `src/app/(dashboard)/clients/`.

---

## Task 9 : Service et API Clients

**Fichiers a creer :**
- `src/features/clients/types.ts`
- `src/features/clients/service.ts`
- `src/features/clients/api.ts`
- `src/app/api/v1/clients/route.ts`
- `src/app/api/v1/clients/[id]/route.ts`

### 9.1 : Types Zod et TypeScript

Definir les schemas de validation :
- `createClientSchema` : name (string, min 1), email (string, email), company (string, optional), phone (string, optional), address (string, optional)
- `updateClientSchema` : partial de createClientSchema
- Types derives : `CreateClientInput`, `UpdateClientInput`

### 9.2 : Service clients

CRUD complet dans `service.ts`. Toutes les fonctions utilisent le Prisma client.

**Fonctions :**
- `listClients()` — Liste tous les clients (user + clientProfile). Admin only.
- `getClient(id)` — Recupere un client par ID avec son profil.
- `createClient(input)` — Cree un user avec role "client" via Better Auth, puis cree le ClientProfile avec company/phone/address. Placeholder pour l'envoi du magic link d'invitation (sera branche dans le Bloc 3 via le service notifications).
- `updateClient(id, input)` — Met a jour le profil client (company, phone, address) et le user (name, email).

### 9.3 : API handlers

Dans `api.ts`, creer les handlers qui :
1. Verifient les permissions (tous les endpoints sont admin-only via `requireAdmin()`)
2. Parsent et valident le body avec les schemas Zod
3. Appellent le service
4. Retournent des reponses standardisees via les helpers API

**Handlers :**
- `handleListClients(req)` — GET, retourne `{ data: clients }`
- `handleCreateClient(req)` — POST, valide body, retourne `{ data: client }` avec status 201
- `handleGetClient(req, id)` — GET, retourne `{ data: client }` ou 404
- `handleUpdateClient(req, id)` — PATCH, valide body, retourne `{ data: client }`

### 9.4 : Route Handlers

Routes fines qui delegent aux handlers :
- `GET/POST /api/v1/clients` → `handleListClients` / `handleCreateClient`
- `GET/PATCH /api/v1/clients/[id]` → `handleGetClient` / `handleUpdateClient`

Pour `[id]`, utiliser le pattern `ctx: RouteContext<"/api/v1/clients/[id]">` et `await ctx.params` pour extraire l'ID.

### 9.5 : Verification

Tester avec curl apres login admin :
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Jean Dupont","email":"jean@example.com","company":"Acme"}'

curl http://localhost:3000/api/v1/clients
```

**Commit :** `feat: add clients CRUD service and REST API`

---

## Task 10 : UI Clients

**Fichiers a creer :**
- `src/features/clients/components/client-list.tsx`
- `src/features/clients/components/client-form.tsx`
- `src/app/(dashboard)/clients/page.tsx`
- `src/app/(dashboard)/clients/[id]/page.tsx`

### 10.1 : Composant ClientList

Tableau des clients avec colonnes :
- Nom
- Email
- Entreprise
- Telephone
- Date d'ajout

Bouton "Inviter un client" en haut de la page (admin only).

### 10.2 : Composant ClientForm

Formulaire de creation/edition. Champs : nom, email, entreprise (optionnel), telephone (optionnel), adresse (optionnel). Utilise les schemas Zod pour la validation cote client.

### 10.3 : Pages

- `/clients` — Affiche `ClientList` avec les donnees du service
- `/clients/[id]` — Detail d'un client avec `ClientForm` en mode edition

### 10.4 : Verification

Tester dans le navigateur : affichage de la liste, creation et edition d'un client.

**Commit :** `feat: add clients UI (list and form)`
