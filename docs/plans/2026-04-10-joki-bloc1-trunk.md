# Joki — Bloc 1 : Foundation + Auth + Dashboard Layout

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Mettre en place les fondations du projet : dépendances, schéma Prisma complet, utilitaires partagés, authentification Better Auth (serveur + client + pages), middleware auth, et layout dashboard avec sidebar/header.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposée via Route Handlers REST (`/api/v1/*`) et consommée par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Resend, Zod, @react-pdf/renderer, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

**Contexte:** Projet vierge Next.js 16. Aucun code metier n'existe encore. Ce bloc est sequentiel sur la branche `main`.

---

## Task 1 : Installer les dependances

**Fichiers concernes :** `package.json`, `bun.lock`

Installer les dependances de production et dev necessaires au projet.

**Production :**
```bash
bun add better-auth @prisma/client zod resend @react-pdf/renderer
```

**Dev :**
```bash
bun add -d prisma
```

**Verification :** `bun run build` doit reussir sans erreur.

**Commit :** `feat: add core dependencies (better-auth, prisma, zod, resend)`

---

## Task 2 : Definir le schema Prisma

**Fichiers a creer :** `prisma/schema.prisma`

Creer le schema Prisma COMPLET avec tous les modeles de l'application. Ce schema est pose une seule fois et ne sera pas modifie par les worktrees du Bloc 2.

**Modeles a definir :**

- **user** : id, name, email, emailVerified, image, role (default "client"), banned, banReason, banExpires, timestamps. Relations vers sessions, clientProfile, ownedProjects, assignedTasks, createdTasks, timeEntries, comments.
- **session** : id, expiresAt, token (unique), ipAddress, userAgent, userId -> user (cascade). Timestamps.
- **verification** : id, identifier, value, expiresAt. Timestamps.
- **ClientProfile** : id, userId (unique), company?, phone?, address?. Relations vers user (cascade), projects (via ProjectClient), invoices. Timestamps.
- **Project** : id, name, slug (unique), description?, status (enum DRAFT/ACTIVE/PAUSED/COMPLETED/ARCHIVED, default DRAFT), color?, startDate?, endDate?, budget?, ownerId. Relations vers owner, clients, tasks, time, invoices, comments. Timestamps.
- **ProjectClient** : id, projectId, clientProfileId. Contrainte unique (projectId, clientProfileId). Timestamps (createdAt only).
- **Task** : id, projectId, title, description?, status (enum TODO/IN_PROGRESS/REVIEW/DONE, default TODO), priority (enum LOW/MEDIUM/HIGH/URGENT, default MEDIUM), position (Int, default 0), dueDate?, assigneeId?, createdById. Relations vers project (cascade), assignee, createdBy, time, comments. Timestamps.
- **TimeEntry** : id, projectId, taskId?, userId, description?, startTime, endTime?, duration?, billable (default true). Relations vers project (cascade), task (SetNull), user. Timestamps.
- **Invoice** : id, projectId, clientProfileId, number (autoincrement), status (enum DRAFT/SENT/PAID/OVERDUE/CANCELLED, default DRAFT), issueDate, dueDate, totalAmount (default 0), taxRate (default 0), notes?. Relations vers project, clientProfile, items. Timestamps.
- **InvoiceItem** : id, invoiceId, description, quantity (Float), unitPrice (Float), amount (Float). Relation vers invoice (cascade). Timestamps (createdAt only).
- **Comment** : id, projectId, taskId?, userId, content. Relations vers project (cascade), task (cascade), user. Timestamps.

**Fichier .env :** Creer `.env` avec `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`. Verifier que `.env` est dans `.gitignore`.

**Migration :** `bunx prisma migrate dev --name "initial-schema"`

**Commit :** `feat: add Prisma schema with all models and enums`

---

## Task 3 : Creer les utilitaires partages

**Fichiers a creer :**
- `src/shared/lib/prisma.ts` — Singleton Prisma client (globalThis pattern pour eviter les connexions multiples en dev)
- `src/shared/lib/api.ts` — Helpers de reponse API : `jsonResponse(data, status)`, `errorResponse(message, status)`, `notFound(resource)`, `forbidden()`, `unauthorized()`
- `src/shared/types/index.ts` — Types partages : `Role` ("admin" | "client"), `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`

**Commit :** `feat: add shared utilities (prisma client, API helpers, types)`

---

## Task 4 : Configurer Better Auth (serveur)

**Fichiers a creer :**
- `src/features/auth/lib.ts`
- `src/app/api/auth/[...all]/route.ts`

**Configuration de Better Auth :**
- Prisma adapter avec provider PostgreSQL
- Email/password active
- Plugin `admin()`
- Plugin `magicLink()` avec `sendMagicLink` en placeholder (console.log, sera branche sur Resend dans le Bloc 3)

**Route Handler :** Utiliser `toNextJsHandler(auth)` de `better-auth/next-js`. Verifier la syntaxe Route Handlers dans `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

**Synchronisation :**
```bash
bunx @better-auth/cli generate
bunx prisma migrate dev --name "sync-better-auth"
```

**Verification :** `bun run dev` puis `curl http://localhost:3000/api/auth/ok` doit repondre.

**Commit :** `feat: configure Better Auth with Prisma, admin and magic link plugins`

---

## Task 5 : Configurer Better Auth (client)

**Fichiers a creer :**
- `src/features/auth/client.ts` — Creer le auth client avec `createAuthClient` de `better-auth/react`, plugins `adminClient()` et `magicLinkClient()`. Exporter `signIn`, `signUp`, `signOut`, `useSession`.
- `src/features/auth/types.ts` — Type `AuthUser` : id, name, email, role ("admin" | "client"), image?.

**Commit :** `feat: add Better Auth client with admin and magic link plugins`

---

## Task 6 : Pages Login et Setup Password

**Fichiers a creer :**
- `src/app/(auth)/layout.tsx` — Layout auth centre, sans sidebar (`flex min-h-full items-center justify-center`)
- `src/features/auth/components/login-form.tsx` — Formulaire email + password. Utilise `signIn.email`. Redirection vers `/` apres login.
- `src/features/auth/components/setup-password-form.tsx` — Page pour les clients invites par magic link. Permet de definir leur mot de passe.
- `src/app/(auth)/login/page.tsx` — Importe et rend `LoginForm`
- `src/app/(auth)/setup/page.tsx` — Importe et rend `SetupPasswordForm`

**Verification :** `bun run dev`, ouvrir `http://localhost:3000/login`, verifier que le formulaire s'affiche.

**Commit :** `feat: add login and setup password pages`

---

## Task 7 : Middleware d'authentification et helpers API auth

**Fichiers a creer :**
- `src/shared/lib/auth-middleware.ts`

**Fonctions a implementer :**
- `getSession()` — Utilise `auth.api.getSession({ headers: await headers() })` pour valider la session cote serveur. Retourne la session ou null.
- `requireSession()` — Appelle `getSession()`, throw "Unauthorized" si null.
- `requireAdmin()` — Appelle `requireSession()`, throw "Forbidden" si `role !== "admin"`.

**Commit :** `feat: add auth middleware helpers for API routes`

---

## Task 8 : Layout Dashboard avec Sidebar

**Fichiers a creer :**
- `src/shared/components/ui/sidebar.tsx` — Navigation principale : Dashboard, Projets, Clients, Factures, Parametres. Affiche le nom de l'utilisateur. Adapte les liens selon le role (admin voit tout, client voit ses projets).
- `src/shared/components/ui/header.tsx` — Barre superieure avec nom de la page courante, bouton deconnexion.
- `src/app/(dashboard)/layout.tsx` — Layout protege : appelle `getSession()`, redirige vers `/login` si pas de session. Structure flex avec Sidebar + zone de contenu (Header + main).
- `src/app/(dashboard)/page.tsx` — Page Dashboard placeholder : titre "Dashboard" et message "Bienvenue sur Joki".

**Verification :** `/login` redirige vers `/` apres connexion. Sidebar et header s'affichent correctement.

**Commit :** `feat: add dashboard layout with sidebar and header`

---

## Apres le Bloc 1

Le trunk est termine. Creer 4 branches depuis ce point et lancer les worktrees pour le Bloc 2 :

```bash
git branch feature/clients
git branch feature/projects-tasks
git branch feature/time-comments
git branch feature/invoices

git worktree add ../joki-clients feature/clients
git worktree add ../joki-projects feature/projects-tasks
git worktree add ../joki-time feature/time-comments
git worktree add ../joki-invoices feature/invoices
```

Chaque worktree execute son plan autonome (bloc2a, bloc2b, bloc2c, bloc2d).
