# Joki Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a freelance project management platform with client collaboration, time tracking, invoicing, and a complete REST API.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions métier passent par une couche service, exposée à la fois via Route Handlers REST (`/api/v1/*`) et consommée directement par les Server Components. Auth via Better Auth avec plugins admin + magic link. PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Resend, Zod, @react-pdf/renderer, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'écrire du code Next.js. Les API peuvent avoir changé par rapport aux versions précédentes.

---

## Stratégie de parallélisation (Worktrees)

Ce plan est découpé en 3 blocs pour permettre l'exécution parallèle via git worktrees.

```
Bloc 1: TRUNK (séquentiel sur main) ── Tasks 1-8
    │
    │  Brancher les 4 worktrees depuis la fin du Bloc 1
    │
    ├── Worktree A: feature/clients ──────── Tasks 9-10
    ├── Worktree B: feature/projects-tasks ─ Tasks 11-14
    ├── Worktree C: feature/time-comments ── Tasks 15-18
    └── Worktree D: feature/invoices ─────── Tasks 19-21
    │
    │  Merger toutes les branches dans main (--no-ff)
    │
Bloc 3: INTÉGRATION (séquentiel sur main) ── Tasks 22-27
```

### Lancement des sessions parallèles

Après avoir terminé le Bloc 1 (trunk), ouvrir 4 sessions Claude Code :

```bash
# Session A — Clients
git worktree add ../joki-clients feature/clients
cd ../joki-clients
# → /superpowers:executing-plans docs/plans/2026-04-10-joki-implementation-plan.md
# → Exécuter uniquement les Tasks 9-10

# Session B — Projects + Tasks
git worktree add ../joki-projects feature/projects-tasks
cd ../joki-projects
# → Exécuter uniquement les Tasks 11-14

# Session C — Time Tracking + Comments
git worktree add ../joki-time feature/time-comments
cd ../joki-time
# → Exécuter uniquement les Tasks 15-18

# Session D — Invoices + PDF
git worktree add ../joki-invoices feature/invoices
cd ../joki-invoices
# → Exécuter uniquement les Tasks 19-21
```

### Merge après Bloc 2

```bash
cd /Users/jo/dev/perso/joki
git merge --no-ff feature/clients
git merge --no-ff feature/projects-tasks
git merge --no-ff feature/time-comments
git merge --no-ff feature/invoices
```

Puis continuer avec le Bloc 3 (Tasks 22-27) sur main.

### Pourquoi ça marche sans conflits

- Le schéma Prisma complet est défini dans le trunk (Task 2) — aucun worktree ne le modifie
- Chaque feature crée ses fichiers dans des répertoires distincts (`src/features/<name>/`)
- Le layout projet (`projects/[slug]/layout.tsx`) avec TOUS les onglets est créé par Worktree B
- Les autres worktrees ajoutent uniquement des `page.tsx` dans des sous-dossiers (fichiers nouveaux)
- L'intégration cross-feature (commentaires dans les vues tâche, notifications) est reportée au Bloc 3

---

## BLOC 1 — TRUNK (séquentiel sur main)

## Phase 1: Foundation — Database & Shared Infrastructure

### Task 1: Installer les dépendances

**Files:**
- Modify: `package.json`

**Step 1: Installer les dépendances de production**

```bash
bun add better-auth @prisma/client zod resend @react-pdf/renderer
```

**Step 2: Installer les dépendances de développement**

```bash
bun add -d prisma
```

**Step 3: Vérifier l'installation**

```bash
bun run build
```

Expected: Build réussi sans erreurs

**Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add core dependencies (better-auth, prisma, zod, resend)"
```

---

### Task 2: Définir le schéma Prisma

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Créer le schéma Prisma complet**

```prisma
generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────
// Better Auth tables (generated/managed by Better Auth)
// Run `bunx @better-auth/cli generate` to sync
// ──────────────────────────────────────

model user {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("client")
  banned        Boolean?  @default(false)
  banReason     String?
  banExpires    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions Session[]

  // App relations
  clientProfile   ClientProfile?
  ownedProjects   Project[]       @relation("ProjectOwner")
  assignedTasks   Task[]          @relation("TaskAssignee")
  createdTasks    Task[]          @relation("TaskCreator")
  timeEntries     TimeEntry[]
  comments        Comment[]
}

model session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      user     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ──────────────────────────────────────
// App models
// ──────────────────────────────────────

model ClientProfile {
  id      String  @id @default(cuid())
  userId  String  @unique
  company String?
  phone   String?
  address String?

  user     user            @relation(fields: [userId], references: [id], onDelete: Cascade)
  projects ProjectClient[]
  invoices Invoice[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ProjectStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
}

model Project {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  description String?
  status      ProjectStatus @default(DRAFT)
  color       String?
  startDate   DateTime?
  endDate     DateTime?
  budget      Float?
  ownerId     String

  owner    user            @relation("ProjectOwner", fields: [ownerId], references: [id])
  clients  ProjectClient[]
  tasks    Task[]
  time     TimeEntry[]
  invoices Invoice[]
  comments Comment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProjectClient {
  id              String @id @default(cuid())
  projectId       String
  clientProfileId String

  project       Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  clientProfile ClientProfile @relation(fields: [clientProfileId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([projectId, clientProfileId])
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  REVIEW
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Task {
  id          String       @id @default(cuid())
  projectId   String
  title       String
  description String?
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  position    Int          @default(0)
  dueDate     DateTime?
  assigneeId  String?
  createdById String

  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee  user?       @relation("TaskAssignee", fields: [assigneeId], references: [id])
  createdBy user        @relation("TaskCreator", fields: [createdById], references: [id])
  time      TimeEntry[]
  comments  Comment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TimeEntry {
  id          String   @id @default(cuid())
  projectId   String
  taskId      String?
  userId      String
  description String?
  startTime   DateTime
  endTime     DateTime?
  duration    Int?
  billable    Boolean  @default(true)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task    Task?   @relation(fields: [taskId], references: [id], onDelete: SetNull)
  user    user    @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

model Invoice {
  id              String        @id @default(cuid())
  projectId       String
  clientProfileId String
  number          Int           @default(autoincrement())
  status          InvoiceStatus @default(DRAFT)
  issueDate       DateTime      @default(now())
  dueDate         DateTime
  totalAmount     Float         @default(0)
  taxRate         Float         @default(0)
  notes           String?

  project       Project       @relation(fields: [projectId], references: [id])
  clientProfile ClientProfile @relation(fields: [clientProfileId], references: [id])
  items         InvoiceItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model InvoiceItem {
  id          String @id @default(cuid())
  invoiceId   String
  description String
  quantity    Float
  unitPrice   Float
  amount      Float

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
}

model Comment {
  id        String  @id @default(cuid())
  projectId String
  taskId    String?
  userId    String
  content   String

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task    Task?   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user    user    @relation(fields: [userId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Step 2: Créer le fichier .env**

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/joki?schema=public"
BETTER_AUTH_SECRET="generate-a-random-secret-here"
BETTER_AUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_your_api_key"
```

Vérifier que `.env` est dans `.gitignore`.

**Step 3: Lancer la migration**

```bash
bunx prisma migrate dev --name "initial-schema"
```

Expected: Migration réussie, base de données créée

**Step 4: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat: add Prisma schema with all models and enums"
```

---

### Task 3: Créer les utilitaires partagés

**Files:**
- Create: `src/shared/lib/prisma.ts`
- Create: `src/shared/lib/api.ts`
- Create: `src/shared/types/index.ts`

**Step 1: Client Prisma singleton**

```typescript
// src/shared/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 2: Helpers API (réponses standardisées + auth extraction)**

```typescript
// src/shared/lib/api.ts
import { type NextRequest } from "next/server";

export function jsonResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function notFound(resource = "Resource") {
  return errorResponse(`${resource} not found`, 404);
}

export function forbidden() {
  return errorResponse("Forbidden", 403);
}

export function unauthorized() {
  return errorResponse("Unauthorized", 401);
}
```

**Step 3: Types partagés**

```typescript
// src/shared/types/index.ts
export type Role = "admin" | "client";

export type ApiResponse<T> = {
  data: T;
};

export type ApiError = {
  error: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
```

**Step 4: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared utilities (prisma client, API helpers, types)"
```

---

## Phase 2: Authentication

### Task 4: Configurer Better Auth (serveur)

**Files:**
- Create: `src/features/auth/lib.ts`
- Create: `src/app/api/auth/[...all]/route.ts`

**Step 1: Configuration serveur Better Auth**

Lire la doc Better Auth pour la version actuelle. Config avec Prisma adapter, email/password, admin plugin, et magic link.

```typescript
// src/features/auth/lib.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { prisma } from "@/shared/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin(),
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        // TODO: Resend integration (Phase 9)
        console.log(`Magic link for ${email}: ${url}`);
      },
    }),
  ],
});
```

**Step 2: Route Handler Better Auth**

Lire `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` pour vérifier la syntaxe des Route Handlers dans cette version de Next.js.

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/features/auth/lib";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 3: Générer le schéma Better Auth et synchroniser Prisma**

```bash
bunx @better-auth/cli generate
bunx prisma migrate dev --name "sync-better-auth"
```

**Step 4: Vérifier que le serveur démarre**

```bash
bun run dev
```

Tester : `curl http://localhost:3000/api/auth/ok` → devrait répondre

**Step 5: Commit**

```bash
git add src/features/auth/ src/app/api/auth/
git commit -m "feat: configure Better Auth with Prisma, admin and magic link plugins"
```

---

### Task 5: Configurer Better Auth (client)

**Files:**
- Create: `src/features/auth/client.ts`
- Create: `src/features/auth/types.ts`

**Step 1: Client auth**

```typescript
// src/features/auth/client.ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient(), magicLinkClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
```

**Step 2: Types auth**

```typescript
// src/features/auth/types.ts
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  image?: string | null;
};
```

**Step 3: Commit**

```bash
git add src/features/auth/
git commit -m "feat: add Better Auth client with admin and magic link plugins"
```

---

### Task 6: Pages Login et Setup Password

**Files:**
- Create: `src/features/auth/components/login-form.tsx`
- Create: `src/features/auth/components/setup-password-form.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/setup/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Layout auth (centré, sans sidebar)**

```typescript
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      {children}
    </div>
  );
}
```

**Step 2: Composant LoginForm**

Formulaire email + password. Utilise `signIn.email` de Better Auth client. Redirection vers `/` après login.

**Step 3: Composant SetupPasswordForm**

Page pour les clients invités par magic link. Permet de définir leur mot de passe.

**Step 4: Pages fines**

```typescript
// src/app/(auth)/login/page.tsx
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

```typescript
// src/app/(auth)/setup/page.tsx
import { SetupPasswordForm } from "@/features/auth/components/setup-password-form";

export default function SetupPage() {
  return <SetupPasswordForm />;
}
```

**Step 5: Tester le flow login dans le navigateur**

```bash
bun run dev
```

Ouvrir `http://localhost:3000/login`, vérifier que le formulaire s'affiche et fonctionne.

**Step 6: Commit**

```bash
git add src/features/auth/components/ src/app/\(auth\)/
git commit -m "feat: add login and setup password pages"
```

---

### Task 7: Middleware d'authentification et helpers API auth

**Files:**
- Create: `src/shared/lib/auth-middleware.ts`
- Modify: `src/shared/lib/api.ts`

**Step 1: Helper pour extraire l'utilisateur courant dans les Route Handlers**

Créer une fonction `getSessionFromRequest` qui utilise Better Auth pour valider la session côté serveur (cookie ou Bearer token). Retourne l'utilisateur ou null.

```typescript
// src/shared/lib/auth-middleware.ts
import { auth } from "@/features/auth/lib";
import { headers } from "next/headers";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}
```

**Step 2: Commit**

```bash
git add src/shared/lib/auth-middleware.ts
git commit -m "feat: add auth middleware helpers for API routes"
```

---

## Phase 3: Dashboard Layout

### Task 8: Layout Dashboard avec Sidebar

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/shared/components/ui/sidebar.tsx`
- Create: `src/shared/components/ui/header.tsx`
- Create: `src/app/(dashboard)/page.tsx`

**Step 1: Composant Sidebar**

Navigation principale : Dashboard, Projets, Clients, Factures, Paramètres. Affiche le nom de l'utilisateur. Adapte les liens en fonction du rôle (admin voit tout, client voit ses projets).

**Step 2: Composant Header**

Barre supérieure avec le nom de la page courante, bouton de déconnexion.

**Step 3: Layout Dashboard**

```typescript
// src/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/shared/lib/auth-middleware";
import { Sidebar } from "@/shared/components/ui/sidebar";
import { Header } from "@/shared/components/ui/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-full">
      <Sidebar user={session.user} />
      <div className="flex flex-1 flex-col">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 4: Page Dashboard (placeholder)**

```typescript
// src/app/(dashboard)/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Bienvenue sur Joki</p>
    </div>
  );
}
```

**Step 5: Tester dans le navigateur**

Vérifier que `/login` redirige vers `/` après connexion, que la sidebar et le header s'affichent.

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/ src/shared/components/
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

## BLOC 2 — FEATURES PARALLÈLES (4 worktrees)

> **Pour Claude:** Chaque worktree exécute son sous-ensemble de tâches indépendamment.
> Brancher depuis la fin du Bloc 1. Ne pas modifier de fichiers hors de la feature assignée.

### WORKTREE A: `feature/clients` — Tasks 9-10

## Phase 4: Clients Feature

### Task 9: Service et API Clients

**Files:**
- Create: `src/features/clients/types.ts`
- Create: `src/features/clients/service.ts`
- Create: `src/features/clients/api.ts`
- Create: `src/app/api/v1/clients/route.ts`
- Create: `src/app/api/v1/clients/[id]/route.ts`

**Step 1: Types Zod + TS pour les clients**

```typescript
// src/features/clients/types.ts
import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
```

**Step 2: Service clients**

CRUD complet dans `service.ts`. Fonctions : `listClients`, `getClient`, `createClient` (crée un user role=client + ClientProfile + envoie magic link), `updateClient`.

- `createClient` doit :
  1. Créer le user via Better Auth avec rôle `client`
  2. Créer le ClientProfile avec company/phone/address
  3. Envoyer un magic link d'invitation (via notifications service, placeholder pour l'instant)

**Step 3: API handlers**

```typescript
// src/features/clients/api.ts
import { type NextRequest } from "next/server";
import { jsonResponse, errorResponse, notFound, forbidden } from "@/shared/lib/api";
import { requireAdmin } from "@/shared/lib/auth-middleware";
import { createClientSchema, updateClientSchema } from "./types";
import * as clientService from "./service";

export async function handleListClients(req: NextRequest) {
  await requireAdmin();
  const clients = await clientService.listClients();
  return jsonResponse({ data: clients });
}

export async function handleCreateClient(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.message);
  const client = await clientService.createClient(parsed.data);
  return jsonResponse({ data: client }, 201);
}

export async function handleGetClient(req: NextRequest, id: string) {
  await requireAdmin();
  const client = await clientService.getClient(id);
  if (!client) return notFound("Client");
  return jsonResponse({ data: client });
}

export async function handleUpdateClient(req: NextRequest, id: string) {
  await requireAdmin();
  const body = await req.json();
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.message);
  const client = await clientService.updateClient(id, parsed.data);
  return jsonResponse({ data: client });
}
```

**Step 4: Route Handlers fins**

```typescript
// src/app/api/v1/clients/route.ts
import { handleListClients, handleCreateClient } from "@/features/clients/api";

export const GET = handleListClients;
export const POST = handleCreateClient;
```

```typescript
// src/app/api/v1/clients/[id]/route.ts
import { handleGetClient, handleUpdateClient } from "@/features/clients/api";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/clients/[id]">) {
  const { id } = await ctx.params;
  return handleGetClient(req, id);
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/v1/clients/[id]">) {
  const { id } = await ctx.params;
  return handleUpdateClient(req, id);
}
```

**Step 5: Tester l'API avec curl**

```bash
# Créer un client (après login admin)
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Jean Dupont","email":"jean@example.com","company":"Acme"}'

# Lister les clients
curl http://localhost:3000/api/v1/clients
```

**Step 6: Commit**

```bash
git add src/features/clients/ src/app/api/v1/clients/
git commit -m "feat: add clients CRUD service and REST API"
```

---

### Task 10: UI Clients

**Files:**
- Create: `src/features/clients/components/client-list.tsx`
- Create: `src/features/clients/components/client-form.tsx`
- Create: `src/app/(dashboard)/clients/page.tsx`
- Create: `src/app/(dashboard)/clients/[id]/page.tsx`

**Step 1: Composant ClientList**

Tableau des clients avec colonnes : Nom, Email, Entreprise, Téléphone, Date d'ajout. Bouton "Inviter un client" en haut.

**Step 2: Composant ClientForm**

Formulaire de création/édition client. Champs : nom, email, entreprise (optionnel), téléphone (optionnel), adresse (optionnel).

**Step 3: Pages fines**

```typescript
// src/app/(dashboard)/clients/page.tsx
import { ClientList } from "@/features/clients/components/client-list";

export default function ClientsPage() {
  return <ClientList />;
}
```

**Step 4: Tester dans le navigateur**

Vérifier la liste, la création et l'édition d'un client.

**Step 5: Commit**

```bash
git add src/features/clients/components/ src/app/\(dashboard\)/clients/
git commit -m "feat: add clients UI (list and form)"
```

---

### WORKTREE B: `feature/projects-tasks` — Tasks 11-14

## Phase 5: Projects Feature

### Task 11: Service et API Projects

**Files:**
- Create: `src/features/projects/types.ts`
- Create: `src/features/projects/service.ts`
- Create: `src/features/projects/api.ts`
- Create: `src/app/api/v1/projects/route.ts`
- Create: `src/app/api/v1/projects/[id]/route.ts`
- Create: `src/app/api/v1/projects/[id]/clients/route.ts`
- Create: `src/app/api/v1/projects/[id]/clients/[clientId]/route.ts`

**Step 1: Types Zod pour les projets**

Schémas : `createProjectSchema`, `updateProjectSchema`. Inclure slug auto-généré à partir du nom.

**Step 2: Service projects**

Fonctions : `listProjects(userId, role)`, `getProject(id, userId, role)`, `createProject`, `updateProject`, `archiveProject`, `addClientToProject`, `removeClientFromProject`.

- Les clients ne voient que leurs projets (via ProjectClient join).
- L'admin voit tous les projets.
- Le slug est généré automatiquement à partir du nom (slugify).

**Step 3: API handlers + Route Handlers**

Même pattern que les clients. Ajouter les endpoints pour la gestion des clients par projet.

Permissions :
- `GET /projects` : admin → tous, client → ses projets
- `POST /projects` : admin uniquement
- `PATCH /projects/:id` : admin uniquement
- `DELETE /projects/:id` : admin uniquement (archive, ne supprime pas)
- `GET/POST/DELETE /projects/:id/clients` : admin uniquement

**Step 4: Tester l'API**

```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Site Web Acme","description":"Refonte du site","status":"ACTIVE"}'
```

**Step 5: Commit**

```bash
git add src/features/projects/ src/app/api/v1/projects/
git commit -m "feat: add projects CRUD service and REST API with client management"
```

---

### Task 12: UI Projects — Liste et Détail

**Files:**
- Create: `src/features/projects/components/project-list.tsx`
- Create: `src/features/projects/components/project-card.tsx`
- Create: `src/features/projects/components/project-form.tsx`
- Create: `src/features/projects/components/project-header.tsx`
- Create: `src/app/(dashboard)/projects/page.tsx`
- Create: `src/app/(dashboard)/projects/[slug]/page.tsx`
- Create: `src/app/(dashboard)/projects/[slug]/layout.tsx`
- Create: `src/app/(dashboard)/projects/[slug]/settings/page.tsx`

**Step 1: ProjectCard**

Carte colorée (couleur du projet) avec nom, statut, nombre de tâches, budget, dates.

**Step 2: ProjectList**

Grille de ProjectCards. Filtres par statut. Bouton "Nouveau projet" (admin uniquement).

**Step 3: Layout projet**

Navigation secondaire pour un projet : Tâches, Temps, Factures, Paramètres.

**Step 4: Pages fines**

**Step 5: Tester dans le navigateur**

**Step 6: Commit**

```bash
git add src/features/projects/components/ src/app/\(dashboard\)/projects/
git commit -m "feat: add projects UI (list, card, detail layout)"
```

---

## Phase 6: Tasks Feature

### Task 13: Service et API Tasks

**Files:**
- Create: `src/features/tasks/types.ts`
- Create: `src/features/tasks/service.ts`
- Create: `src/features/tasks/api.ts`
- Create: `src/app/api/v1/projects/[id]/tasks/route.ts`
- Create: `src/app/api/v1/tasks/[id]/route.ts`
- Create: `src/app/api/v1/tasks/[id]/position/route.ts`

**Step 1: Types Zod**

`createTaskSchema`, `updateTaskSchema`, `updatePositionSchema` (pour le drag & drop kanban).

**Step 2: Service tasks**

Fonctions : `listTasks(projectId)`, `getTask(id)`, `createTask`, `updateTask`, `deleteTask`, `updatePosition(id, status, position)`.

- `updatePosition` : utilisé par le kanban drag & drop. Met à jour le status ET la position d'une tâche, et réordonne les autres tâches dans la même colonne.

Permissions :
- Admin : tout
- Client : CRUD sur ses projets uniquement

**Step 3: API handlers + Route Handlers**

**Step 4: Tester l'API**

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Maquette homepage","priority":"HIGH"}'
```

**Step 5: Commit**

```bash
git add src/features/tasks/ src/app/api/v1/projects/*/tasks/ src/app/api/v1/tasks/
git commit -m "feat: add tasks CRUD service and REST API with position management"
```

---

### Task 14: UI Tasks — Kanban Board

**Files:**
- Create: `src/features/tasks/components/kanban-board.tsx`
- Create: `src/features/tasks/components/kanban-column.tsx`
- Create: `src/features/tasks/components/task-card.tsx`
- Create: `src/features/tasks/components/task-form.tsx`
- Modify: `src/app/(dashboard)/projects/[slug]/page.tsx`

**Step 1: TaskCard**

Carte avec titre, priorité (badge coloré), assignee (avatar), date due. Clic → modale ou panneau latéral de détail.

**Step 2: KanbanColumn**

Colonne pour un statut (TODO, IN_PROGRESS, REVIEW, DONE). Drop zone pour le drag & drop. Header avec le nombre de tâches. Bouton "+" pour ajouter une tâche.

**Step 3: KanbanBoard**

4 colonnes. Drag & drop entre colonnes (utiliser l'API `updatePosition`). Pas de bibliothèque DnD externe : utiliser l'API HTML5 Drag and Drop pour rester simple, ou évaluer `@dnd-kit/core` si le HTML5 DnD est trop limité.

**Step 4: TaskForm**

Modale ou panneau latéral pour créer/éditer une tâche. Champs : titre, description, statut, priorité, assignee (dropdown), date due.

**Step 5: Intégrer dans la page projet**

```typescript
// src/app/(dashboard)/projects/[slug]/page.tsx
import { KanbanBoard } from "@/features/tasks/components/kanban-board";
import * as projectService from "@/features/projects/service";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await projectService.getProjectBySlug(slug);
  // ...
  return <KanbanBoard projectId={project.id} />;
}
```

**Step 6: Tester le drag & drop dans le navigateur**

**Step 7: Commit**

```bash
git add src/features/tasks/components/ src/app/\(dashboard\)/projects/
git commit -m "feat: add Kanban board UI with drag and drop"
```

---

### WORKTREE C: `feature/time-comments` — Tasks 15-18

## Phase 7: Time Tracking Feature

### Task 15: Service et API Time Tracking

**Files:**
- Create: `src/features/time-tracking/types.ts`
- Create: `src/features/time-tracking/service.ts`
- Create: `src/features/time-tracking/api.ts`
- Create: `src/app/api/v1/projects/[id]/time/route.ts`
- Create: `src/app/api/v1/time/[id]/route.ts`
- Create: `src/app/api/v1/time/running/route.ts`

**Step 1: Types Zod**

`createTimeEntrySchema`, `updateTimeEntrySchema`. Le champ `endTime` est optionnel (timer en cours).

**Step 2: Service time tracking**

Fonctions : `listTimeEntries(projectId)`, `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`, `getRunningTimer(userId)`, `stopTimer(id)`.

- `getRunningTimer` : retourne l'entrée de temps sans `endTime` pour l'utilisateur courant.
- `stopTimer` : met `endTime` = now et calcule `duration`.
- Admin uniquement (les clients n'ont pas accès au time tracking).

**Step 3: API handlers + Route Handlers**

**Step 4: Tester l'API**

```bash
# Démarrer un timer
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/time \
  -H "Content-Type: application/json" \
  -d '{"description":"Développement feature X","startTime":"2026-04-10T10:00:00Z"}'

# Obtenir le timer en cours
curl http://localhost:3000/api/v1/time/running
```

**Step 5: Commit**

```bash
git add src/features/time-tracking/ src/app/api/v1/projects/*/time/ src/app/api/v1/time/
git commit -m "feat: add time tracking service and REST API with running timer"
```

---

### Task 16: UI Time Tracking

**Files:**
- Create: `src/features/time-tracking/components/timer.tsx`
- Create: `src/features/time-tracking/components/time-entry-list.tsx`
- Create: `src/features/time-tracking/components/time-entry-form.tsx`
- Create: `src/app/(dashboard)/projects/[slug]/time/page.tsx`

**Step 1: Timer**

Composant timer flottant (visible dans le header ou en bas de page). Affiche le temps écoulé, bouton start/stop, sélection du projet et de la tâche (optionnel). Mise à jour en temps réel avec `setInterval`.

**Step 2: TimeEntryList**

Tableau des entrées de temps pour un projet. Colonnes : Date, Description, Tâche (optionnel), Durée, Facturable, Actions. Agrégation par jour.

**Step 3: TimeEntryForm**

Formulaire pour saisie manuelle. Champs : description, tâche (optionnel), date début, date fin, facturable.

**Step 4: Tester dans le navigateur**

Vérifier le timer, l'ajout manuel, la liste.

**Step 5: Commit**

```bash
git add src/features/time-tracking/components/ src/app/\(dashboard\)/projects/*/time/
git commit -m "feat: add time tracking UI (timer, entry list, manual form)"
```

---

## Phase 8: Comments Feature

### Task 17: Service et API Comments

**Files:**
- Create: `src/features/comments/types.ts`
- Create: `src/features/comments/service.ts`
- Create: `src/features/comments/api.ts`
- Create: `src/app/api/v1/projects/[id]/comments/route.ts`
- Create: `src/app/api/v1/tasks/[id]/comments/route.ts`
- Create: `src/app/api/v1/comments/[id]/route.ts`

**Step 1: Types Zod**

`createCommentSchema` : `{ content: string, projectId: string, taskId?: string }`.

**Step 2: Service comments**

Fonctions : `listProjectComments(projectId)`, `listTaskComments(taskId)`, `createComment`, `deleteComment`.

Permissions :
- Admin et clients peuvent commenter sur leurs projets.
- Seul l'auteur ou l'admin peut supprimer un commentaire.

**Step 3: API handlers + Route Handlers**

**Step 4: Commit**

```bash
git add src/features/comments/ src/app/api/v1/comments/ src/app/api/v1/projects/*/comments/ src/app/api/v1/tasks/*/comments/
git commit -m "feat: add comments service and REST API"
```

---

### Task 18: UI Comments

**Files:**
- Create: `src/features/comments/components/comment-list.tsx`
- Create: `src/features/comments/components/comment-form.tsx`

**Step 1: CommentList**

Liste de commentaires avec avatar, nom, date, contenu. Bouton supprimer pour l'auteur/admin.

**Step 2: CommentForm**

Textarea + bouton envoyer. Intégré dans la vue détail d'une tâche et dans la page projet.

**Step 3: Intégrer dans les pages tâche et projet**

Ajouter la section commentaires dans le panneau de détail d'une tâche et dans la page projet.

**Step 4: Commit**

```bash
git add src/features/comments/components/
git commit -m "feat: add comments UI (list and form)"
```

---

### WORKTREE D: `feature/invoices` — Tasks 19-21

## Phase 9: Invoices Feature

### Task 19: Service et API Invoices

**Files:**
- Create: `src/features/invoices/types.ts`
- Create: `src/features/invoices/service.ts`
- Create: `src/features/invoices/api.ts`
- Create: `src/app/api/v1/projects/[id]/invoices/route.ts`
- Create: `src/app/api/v1/invoices/[id]/route.ts`
- Create: `src/app/api/v1/invoices/[id]/pdf/route.ts`
- Create: `src/app/api/v1/invoices/[id]/send/route.ts`

**Step 1: Types Zod**

`createInvoiceSchema` : items[], dueDate, taxRate, notes. Le `number` est auto-incrémenté. Le `totalAmount` est calculé automatiquement.

**Step 2: Service invoices**

Fonctions : `listInvoices(projectId)`, `getInvoice(id)`, `createInvoice`, `updateInvoice`, `generatePdf(id)`, `sendInvoice(id)`.

- `createInvoice` : calcule `totalAmount` = sum(items.quantity * items.unitPrice) * (1 + taxRate/100)
- `generatePdf` : utilise `@react-pdf/renderer` pour générer un PDF (Task 21)
- `sendInvoice` : met le status à SENT et envoie l'email avec le PDF (via notifications)

Permissions :
- Admin uniquement pour CRUD
- Client peut voir ses factures (GET)

**Step 3: API handlers + Route Handlers**

Endpoint `/api/v1/invoices/:id/pdf` retourne un `Response` avec `Content-Type: application/pdf`.

**Step 4: Tester l'API**

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/invoices \
  -H "Content-Type: application/json" \
  -d '{"clientProfileId":"...","dueDate":"2026-05-10","taxRate":20,"items":[{"description":"Dev homepage","quantity":1,"unitPrice":2000}]}'
```

**Step 5: Commit**

```bash
git add src/features/invoices/ src/app/api/v1/invoices/ src/app/api/v1/projects/*/invoices/
git commit -m "feat: add invoices CRUD service and REST API"
```

---

### Task 20: UI Invoices

**Files:**
- Create: `src/features/invoices/components/invoice-list.tsx`
- Create: `src/features/invoices/components/invoice-form.tsx`
- Create: `src/features/invoices/components/invoice-preview.tsx`
- Create: `src/app/(dashboard)/projects/[slug]/invoices/page.tsx`
- Create: `src/app/(dashboard)/invoices/page.tsx`

**Step 1: InvoiceList**

Tableau des factures. Colonnes : N°, Client, Montant, Statut (badge coloré : vert=payée, jaune=envoyée, rouge=en retard), Date émission, Date échéance. Actions : voir, télécharger PDF, marquer payée.

**Step 2: InvoiceForm**

Formulaire de création. Sélection du client, date d'échéance, taux de TVA, liste d'items (ajouter/supprimer des lignes dynamiquement). Calcul automatique du total en temps réel.

**Step 3: InvoicePreview**

Prévisualisation de la facture avant envoi. Affiche le même layout que le PDF mais en HTML.

**Step 4: Pages**

- `/projects/[slug]/invoices` : factures d'un projet
- `/invoices` : toutes les factures (vue globale admin)

**Step 5: Tester dans le navigateur**

**Step 6: Commit**

```bash
git add src/features/invoices/components/ src/app/\(dashboard\)/projects/*/invoices/ src/app/\(dashboard\)/invoices/
git commit -m "feat: add invoices UI (list, form, preview)"
```

---

### Task 21: Génération PDF Factures

**Files:**
- Create: `src/features/invoices/templates/invoice-pdf.tsx`
- Modify: `src/features/invoices/service.ts`

**Step 1: Template PDF avec @react-pdf/renderer**

Créer un composant React PDF pour la facture. Layout professionnel :
- En-tête : logo/nom du dev, coordonnées
- Infos client : nom, entreprise, adresse
- N° facture, date émission, date échéance
- Tableau des items : description, quantité, prix unitaire, montant
- Sous-total, TVA, Total
- Notes

**Step 2: Intégrer dans le service**

La fonction `generatePdf` appelle `renderToBuffer` de `@react-pdf/renderer` avec le composant et les données de la facture.

**Step 3: Endpoint PDF**

L'endpoint `/api/v1/invoices/:id/pdf` retourne le buffer PDF avec les bons headers.

**Step 4: Tester le téléchargement**

Ouvrir `http://localhost:3000/api/v1/invoices/{id}/pdf` dans le navigateur → le PDF se télécharge.

**Step 5: Commit**

```bash
git add src/features/invoices/templates/
git commit -m "feat: add PDF invoice generation with @react-pdf/renderer"
```

---

## BLOC 3 — INTÉGRATION (séquentiel sur main, après merge des 4 worktrees)

> **Pour Claude:** Exécuter après avoir mergé les 4 branches feature dans main avec `--no-ff`.
> Ce bloc modifie des fichiers de PLUSIEURS features (cross-cutting concerns).

### Étape de merge préalable

```bash
cd /Users/jo/dev/perso/joki
git merge --no-ff feature/clients -m "Merge branch 'feature/clients'"
git merge --no-ff feature/projects-tasks -m "Merge branch 'feature/projects-tasks'"
git merge --no-ff feature/time-comments -m "Merge branch 'feature/time-comments'"
git merge --no-ff feature/invoices -m "Merge branch 'feature/invoices'"

# Nettoyage des worktrees
git worktree remove ../joki-clients
git worktree remove ../joki-projects
git worktree remove ../joki-time
git worktree remove ../joki-invoices
```

### Task 21.5: Intégration cross-feature

Wiring des commentaires dans les vues existantes :
- Ajouter la section commentaires dans le panneau de détail d'une tâche (modifier `src/features/tasks/components/`)
- Ajouter les commentaires dans la page projet

## Phase 10: Notifications

### Task 22: Service Notifications et Templates Email

**Files:**
- Create: `src/shared/lib/email.ts`
- Create: `src/features/notifications/service.ts`
- Create: `src/features/notifications/types.ts`
- Create: `src/features/notifications/templates/invitation.tsx`
- Create: `src/features/notifications/templates/new-comment.tsx`
- Create: `src/features/notifications/templates/invoice-sent.tsx`

**Step 1: Client Resend**

```typescript
// src/shared/lib/email.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
```

**Step 2: Service notifications**

Fonctions : `sendInvitation(email, magicLinkUrl)`, `notifyNewComment(projectId, comment)`, `sendInvoiceEmail(invoice, pdfBuffer)`.

Chaque fonction utilise Resend pour envoyer l'email avec le template React approprié.

**Step 3: Templates email**

Utiliser JSX simple pour les templates (pas besoin de `react-email` — Resend accepte du JSX directement via `react` dans les options d'envoi).

**Step 4: Brancher les notifications dans les services existants**

- `clients/service.ts` → `createClient` appelle `sendInvitation`
- `comments/service.ts` → `createComment` appelle `notifyNewComment`
- `invoices/service.ts` → `sendInvoice` appelle `sendInvoiceEmail`

**Step 5: Commit**

```bash
git add src/shared/lib/email.ts src/features/notifications/
git commit -m "feat: add notification service with Resend and email templates"
```

---

### Task 23: Brancher Magic Link dans Better Auth

**Files:**
- Modify: `src/features/auth/lib.ts`

**Step 1: Remplacer le console.log par l'envoi réel**

Modifier la config `sendMagicLink` dans Better Auth pour utiliser le service notifications.

```typescript
magicLink({
  sendMagicLink: async ({ email, token, url }) => {
    await notificationService.sendInvitation(email, url);
  },
}),
```

**Step 2: Tester le flow d'invitation**

1. Admin crée un client via l'UI
2. Email d'invitation envoyé via Resend
3. Client clique sur le lien
4. Client définit son mot de passe
5. Client accède à ses projets

**Step 3: Commit**

```bash
git add src/features/auth/lib.ts
git commit -m "feat: wire magic link to Resend email notifications"
```

---

## Phase 11: Dashboard & Finitions

### Task 24: Dashboard avec statistiques

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Create: `src/features/projects/components/project-stats.tsx`

**Step 1: Dashboard admin**

Afficher :
- Nombre de projets actifs
- Heures travaillées cette semaine
- Factures en attente (montant total)
- Derniers commentaires / activité récente
- Liste des projets actifs avec progression

**Step 2: Dashboard client**

Afficher :
- Ses projets avec avancement
- Dernières tâches mises à jour
- Factures en attente

**Step 3: Tester les deux vues**

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx src/features/projects/components/
git commit -m "feat: add dashboard with stats for admin and client views"
```

---

### Task 25: Page Settings

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`
- Create: `src/features/auth/components/profile-form.tsx`

**Step 1: Page paramètres**

- Modifier le nom et l'avatar
- Changer le mot de passe
- Pour l'admin : informations de facturation (nom, adresse, SIRET — utilisées dans les PDF)

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/settings/ src/features/auth/components/
git commit -m "feat: add settings page with profile management"
```

---

### Task 26: Seed de développement

**Files:**
- Create: `prisma/seed.ts`

**Step 1: Script de seed**

Créer un script qui génère :
- 1 utilisateur admin (toi)
- 3 clients avec profils
- 3 projets avec statuts variés
- 10-15 tâches réparties dans les projets
- Quelques entrées de temps
- 2 factures (1 brouillon, 1 envoyée)
- Quelques commentaires

**Step 2: Configurer le seed dans package.json**

```json
"prisma": {
  "seed": "bun prisma/seed.ts"
}
```

**Step 3: Tester**

```bash
bunx prisma db seed
```

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add development seed script"
```

---

### Task 27: Review finale et déploiement

**Step 1: Vérification complète**

```bash
bun run lint
bun run build
```

Corriger toutes les erreurs.

**Step 2: Configuration Docker pour Coolify**

Créer un `Dockerfile` optimisé pour Next.js avec Bun, et un `docker-compose.yml` avec PostgreSQL pour le développement local.

**Step 3: Variables d'environnement**

Documenter toutes les variables requises dans `.env.example` :
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `RESEND_API_KEY`

**Step 4: Commit et PR**

```bash
git add .
git commit -m "feat: add Docker configuration and final cleanup"
```

---

## Résumé des tâches par bloc et worktree

### Bloc 1 — Trunk (séquentiel sur main)

| # | Tâche | Phase |
|---|-------|-------|
| 1 | Installer les dépendances | Foundation |
| 2 | Schéma Prisma | Foundation |
| 3 | Utilitaires partagés | Foundation |
| 4 | Better Auth serveur | Auth |
| 5 | Better Auth client | Auth |
| 6 | Pages Login/Setup | Auth |
| 7 | Middleware auth | Auth |
| 8 | Layout Dashboard | Dashboard |

### Bloc 2 — Features parallèles (4 worktrees)

| # | Tâche | Worktree | Branch |
|---|-------|----------|--------|
| 9 | Service & API Clients | A | `feature/clients` |
| 10 | UI Clients | A | `feature/clients` |
| 11 | Service & API Projects | B | `feature/projects-tasks` |
| 12 | UI Projects | B | `feature/projects-tasks` |
| 13 | Service & API Tasks | B | `feature/projects-tasks` |
| 14 | UI Tasks (Kanban) | B | `feature/projects-tasks` |
| 15 | Service & API Time Tracking | C | `feature/time-comments` |
| 16 | UI Time Tracking | C | `feature/time-comments` |
| 17 | Service & API Comments | C | `feature/time-comments` |
| 18 | UI Comments (core) | C | `feature/time-comments` |
| 19 | Service & API Invoices | D | `feature/invoices` |
| 20 | UI Invoices | D | `feature/invoices` |
| 21 | Génération PDF | D | `feature/invoices` |

### Bloc 3 — Intégration (séquentiel sur main, après merge)

| # | Tâche | Phase |
|---|-------|-------|
| 21.5 | Intégration cross-feature | Wiring |
| 22 | Notifications & Emails | Notifications |
| 23 | Magic Link → Resend | Notifications |
| 24 | Dashboard stats | Dashboard |
| 25 | Page Settings | Settings |
| 26 | Seed de développement | Dev |
| 27 | Review & Déploiement | Finition |
