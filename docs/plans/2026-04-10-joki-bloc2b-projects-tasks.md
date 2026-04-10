# Joki — Bloc 2B : Feature Projects + Tasks/Kanban

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implementer le CRUD Projects complet (service, API, UI avec grille de cartes), le layout projet avec onglets (Taches/Temps/Factures/Parametres), et le systeme de taches avec un Kanban board drag & drop.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposee via Route Handlers REST (`/api/v1/*`) et consommee par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Zod, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

**Branch :** `feature/projects-tasks` (worktree `../joki-projects`)

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

**REGLE :** Ne modifier aucun fichier hors du scope de cette feature. Creer uniquement des fichiers dans `src/features/projects/`, `src/features/tasks/`, `src/app/api/v1/projects/`, `src/app/api/v1/tasks/`, et `src/app/(dashboard)/projects/`.

**NOTE IMPORTANTE :** Ce worktree cree le layout projet avec TOUS les onglets (Taches, Temps, Factures, Parametres). Les autres worktrees (time, invoices) ajouteront leurs `page.tsx` dans les sous-dossiers correspondants apres le merge. Il faut donc creer la structure de navigation complete ici.

---

## Task 11 : Service et API Projects

**Fichiers a creer :**
- `src/features/projects/types.ts`
- `src/features/projects/service.ts`
- `src/features/projects/api.ts`
- `src/app/api/v1/projects/route.ts`
- `src/app/api/v1/projects/[id]/route.ts`
- `src/app/api/v1/projects/[id]/clients/route.ts`
- `src/app/api/v1/projects/[id]/clients/[clientId]/route.ts`

### 11.1 : Types Zod

Schemas : `createProjectSchema` (name, description?, status?, color?, startDate?, endDate?, budget?), `updateProjectSchema` (partial). Le slug est auto-genere a partir du nom (slugify).

### 11.2 : Service projects

**Fonctions :**
- `listProjects(userId, role)` — Admin voit tous les projets. Client voit uniquement les siens (via join ProjectClient).
- `getProject(id, userId, role)` — Idem pour le detail. Verifier l'acces.
- `getProjectBySlug(slug)` — Recuperer un projet par slug.
- `createProject(input)` — Admin only. Genere le slug automatiquement.
- `updateProject(id, input)` — Admin only.
- `archiveProject(id)` — Admin only. Met le status a ARCHIVED (pas de suppression physique).
- `addClientToProject(projectId, clientProfileId)` — Admin only. Cree l'entree ProjectClient.
- `removeClientFromProject(projectId, clientProfileId)` — Admin only.

### 11.3 : API handlers + Route Handlers

**Permissions :**
- `GET /api/v1/projects` — Admin voit tous, client voit les siens
- `POST /api/v1/projects` — Admin uniquement
- `GET /api/v1/projects/:id` — Admin ou client ayant acces
- `PATCH /api/v1/projects/:id` — Admin uniquement
- `DELETE /api/v1/projects/:id` — Admin uniquement (archive)
- `GET/POST /api/v1/projects/:id/clients` — Admin uniquement
- `DELETE /api/v1/projects/:id/clients/:clientId` — Admin uniquement

### 11.4 : Verification

```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Site Web Acme","description":"Refonte du site","status":"ACTIVE"}'
```

**Commit :** `feat: add projects CRUD service and REST API with client management`

---

## Task 12 : UI Projects — Liste, Detail et Layout Projet

**Fichiers a creer :**
- `src/features/projects/components/project-list.tsx`
- `src/features/projects/components/project-card.tsx`
- `src/features/projects/components/project-form.tsx`
- `src/features/projects/components/project-header.tsx`
- `src/app/(dashboard)/projects/page.tsx`
- `src/app/(dashboard)/projects/[slug]/page.tsx`
- `src/app/(dashboard)/projects/[slug]/layout.tsx`
- `src/app/(dashboard)/projects/[slug]/settings/page.tsx`

### 12.1 : ProjectCard

Carte coloree (couleur du projet) affichant : nom, statut (badge), nombre de taches, budget, dates debut/fin.

### 12.2 : ProjectList

Grille de ProjectCards. Filtres par statut. Bouton "Nouveau projet" visible uniquement pour l'admin.

### 12.3 : Layout projet avec onglets

Le layout `projects/[slug]/layout.tsx` ajoute une navigation secondaire avec les onglets :
- **Taches** (`/projects/[slug]`) — page par defaut, onglet actif
- **Temps** (`/projects/[slug]/time`)
- **Factures** (`/projects/[slug]/invoices`)
- **Parametres** (`/projects/[slug]/settings`)

Ce layout est crucial car les worktrees Time et Invoices ajouteront leurs pages dans ces sous-dossiers apres le merge.

### 12.4 : ProjectHeader

En-tete dans le layout projet : nom du projet, statut, couleur, lien retour vers la liste.

### 12.5 : ProjectForm

Formulaire creation/edition. Champs : nom, description, statut, couleur, dates, budget.

### 12.6 : Page Settings

Page parametres du projet : edition des infos, gestion des clients associes (ajouter/retirer), archivage.

### 12.7 : Verification

Tester dans le navigateur : affichage de la grille, creation de projet, navigation entre onglets.

**Commit :** `feat: add projects UI (list, card, detail layout)`

---

## Task 13 : Service et API Tasks

**Fichiers a creer :**
- `src/features/tasks/types.ts`
- `src/features/tasks/service.ts`
- `src/features/tasks/api.ts`
- `src/app/api/v1/projects/[id]/tasks/route.ts`
- `src/app/api/v1/tasks/[id]/route.ts`
- `src/app/api/v1/tasks/[id]/position/route.ts`

### 13.1 : Types Zod

- `createTaskSchema` : title, description?, priority?, assigneeId?, dueDate?
- `updateTaskSchema` : partial du precedent + status?
- `updatePositionSchema` : status (TaskStatus), position (Int) — pour le drag & drop

### 13.2 : Service tasks

**Fonctions :**
- `listTasks(projectId)` — Liste les taches d'un projet, triees par position dans chaque colonne.
- `getTask(id)` — Detail d'une tache.
- `createTask(projectId, input, createdById)` — Cree une tache. Position = derniere de la colonne TODO.
- `updateTask(id, input)` — Mise a jour classique.
- `deleteTask(id)` — Suppression.
- `updatePosition(id, status, position)` — Pour le kanban drag & drop. Met a jour le status ET la position, et reordonne les autres taches dans la meme colonne.

**Permissions :**
- Admin : acces total
- Client : CRUD sur les taches de ses projets uniquement

### 13.3 : API handlers + Route Handlers

- `GET/POST /api/v1/projects/:id/tasks` — Lister / creer
- `GET/PATCH/DELETE /api/v1/tasks/:id` — Detail / modifier / supprimer
- `PATCH /api/v1/tasks/:id/position` — Changer position (drag & drop)

### 13.4 : Verification

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Maquette homepage","priority":"HIGH"}'
```

**Commit :** `feat: add tasks CRUD service and REST API with position management`

---

## Task 14 : UI Tasks — Kanban Board

**Fichiers a creer :**
- `src/features/tasks/components/kanban-board.tsx`
- `src/features/tasks/components/kanban-column.tsx`
- `src/features/tasks/components/task-card.tsx`
- `src/features/tasks/components/task-form.tsx`

**Fichier a modifier :**
- `src/app/(dashboard)/projects/[slug]/page.tsx`

### 14.1 : TaskCard

Carte de tache affichant : titre, priorite (badge colore par niveau), assignee (avatar si disponible), date due. Clic ouvre une modale ou un panneau lateral de detail/edition.

### 14.2 : KanbanColumn

Colonne pour un statut (TODO, IN_PROGRESS, REVIEW, DONE). Drop zone pour le drag & drop. Header avec compteur de taches. Bouton "+" pour ajouter une tache rapidement.

### 14.3 : KanbanBoard

4 colonnes. Drag & drop entre colonnes qui appelle l'API `updatePosition`. Utiliser l'API HTML5 Drag and Drop pour rester simple. Si trop limite, evaluer `@dnd-kit/core`.

### 14.4 : TaskForm

Modale ou panneau lateral pour creer/editer une tache. Champs : titre, description, statut, priorite, assignee (dropdown des membres), date due.

### 14.5 : Integration dans la page projet

La page `projects/[slug]/page.tsx` (onglet Taches) charge le projet par slug via le service et rend le `KanbanBoard` avec le `projectId`.

### 14.6 : Verification

Tester le drag & drop dans le navigateur : deplacer des taches entre colonnes, verifier que les positions sont persistees.

**Commit :** `feat: add Kanban board UI with drag and drop`
