# Joki — Bloc 2C : Feature Time Tracking + Comments

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implementer le time tracking complet (service, API, timer en temps reel, liste d'entrees, saisie manuelle) et les commentaires (service, API, composants standalone). Les composants commentaires sont crees en standalone dans ce bloc. Leur integration dans les vues tache/projet sera faite dans le Bloc 3 apres le merge de toutes les branches.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposee via Route Handlers REST (`/api/v1/*`) et consommee par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Zod, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

**Branch :** `feature/time-comments` (worktree `../joki-time`)

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

**REGLE :** Ne modifier aucun fichier hors du scope de cette feature. Creer uniquement des fichiers dans `src/features/time-tracking/`, `src/features/comments/`, `src/app/api/v1/time/`, `src/app/api/v1/projects/[id]/time/`, `src/app/api/v1/comments/`, `src/app/api/v1/projects/[id]/comments/`, `src/app/api/v1/tasks/[id]/comments/`, et `src/app/(dashboard)/projects/[slug]/time/`.

---

## Task 15 : Service et API Time Tracking

**Fichiers a creer :**
- `src/features/time-tracking/types.ts`
- `src/features/time-tracking/service.ts`
- `src/features/time-tracking/api.ts`
- `src/app/api/v1/projects/[id]/time/route.ts`
- `src/app/api/v1/time/[id]/route.ts`
- `src/app/api/v1/time/running/route.ts`

### 15.1 : Types Zod

- `createTimeEntrySchema` : description?, taskId?, startTime (datetime), endTime? (datetime, optionnel pour timer en cours), billable? (boolean, default true)
- `updateTimeEntrySchema` : partial du precedent

### 15.2 : Service time tracking

**Fonctions :**
- `listTimeEntries(projectId)` — Liste les entrees de temps d'un projet, ordonnees par date.
- `createTimeEntry(projectId, userId, input)` — Cree une entree. Si endTime est fourni, calcule la duration en secondes.
- `updateTimeEntry(id, input)` — Met a jour. Recalcule la duration si endTime change.
- `deleteTimeEntry(id)` — Suppression.
- `getRunningTimer(userId)` — Retourne l'entree de temps sans `endTime` pour l'utilisateur courant (timer actif). Il ne peut y en avoir qu'un seul.
- `stopTimer(id)` — Met `endTime` = now, calcule `duration` = difference en secondes entre startTime et endTime.

**Permissions :** Admin uniquement. Les clients n'ont pas acces au time tracking.

### 15.3 : API handlers + Route Handlers

- `GET/POST /api/v1/projects/:id/time` — Lister les entrees / demarrer un timer ou saisie manuelle
- `GET/PATCH/DELETE /api/v1/time/:id` — Detail / modifier / supprimer une entree
- `GET /api/v1/time/running` — Obtenir le timer en cours de l'utilisateur

### 15.4 : Verification

```bash
# Demarrer un timer
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/time \
  -H "Content-Type: application/json" \
  -d '{"description":"Dev feature X","startTime":"2026-04-10T10:00:00Z"}'

# Obtenir le timer en cours
curl http://localhost:3000/api/v1/time/running
```

**Commit :** `feat: add time tracking service and REST API with running timer`

---

## Task 16 : UI Time Tracking

**Fichiers a creer :**
- `src/features/time-tracking/components/timer.tsx`
- `src/features/time-tracking/components/time-entry-list.tsx`
- `src/features/time-tracking/components/time-entry-form.tsx`
- `src/app/(dashboard)/projects/[slug]/time/page.tsx`

### 16.1 : Timer

Composant timer interactif (composant client) :
- Affiche le temps ecoule en temps reel (HH:MM:SS) avec `setInterval`
- Bouton start/stop
- Selection du projet (dropdown)
- Selection de la tache (dropdown, optionnel)
- Champ description
- Visible dans le header ou en bas de page (flottant)

### 16.2 : TimeEntryList

Tableau des entrees de temps pour un projet.
- **Colonnes :** Date, Description, Tache (optionnel), Duree (formatee HH:MM), Facturable (checkbox), Actions (editer, supprimer)
- Aggregation par jour (sous-total par jour)

### 16.3 : TimeEntryForm

Formulaire pour saisie manuelle d'une entree.
- **Champs :** description, tache (dropdown, optionnel), date debut, date fin, facturable (checkbox)

### 16.4 : Page temps du projet

La page `projects/[slug]/time/page.tsx` affiche le `TimeEntryList` et le `TimeEntryForm` pour le projet courant. Cette page sera accessible via l'onglet "Temps" dans le layout projet (cree par le worktree B).

### 16.5 : Verification

Tester dans le navigateur : demarrer/arreter le timer, ajouter une entree manuelle, verifier la liste.

**Commit :** `feat: add time tracking UI (timer, entry list, manual form)`

---

## Task 17 : Service et API Comments

**Fichiers a creer :**
- `src/features/comments/types.ts`
- `src/features/comments/service.ts`
- `src/features/comments/api.ts`
- `src/app/api/v1/projects/[id]/comments/route.ts`
- `src/app/api/v1/tasks/[id]/comments/route.ts`
- `src/app/api/v1/comments/[id]/route.ts`

### 17.1 : Types Zod

- `createCommentSchema` : content (string, min 1), projectId (string), taskId? (string, optionnel)

### 17.2 : Service comments

**Fonctions :**
- `listProjectComments(projectId)` — Liste les commentaires d'un projet (sans les commentaires de taches), avec l'auteur (user.name, user.image).
- `listTaskComments(taskId)` — Liste les commentaires d'une tache, avec l'auteur.
- `createComment(input, userId)` — Cree un commentaire. Le projectId est obligatoire. Le taskId est optionnel (commentaire general projet vs commentaire sur une tache).
- `deleteComment(id, userId, role)` — Seul l'auteur ou un admin peut supprimer un commentaire.

**Permissions :**
- Admin ET clients peuvent commenter sur les projets auxquels ils ont acces
- Suppression : auteur du commentaire ou admin

### 17.3 : API handlers + Route Handlers

- `GET/POST /api/v1/projects/:id/comments` — Commentaires d'un projet
- `GET/POST /api/v1/tasks/:id/comments` — Commentaires d'une tache
- `DELETE /api/v1/comments/:id` — Supprimer un commentaire

### 17.4 : Verification

Tester la creation et la liste de commentaires via curl.

**Commit :** `feat: add comments service and REST API`

---

## Task 18 : UI Comments (composants standalone)

**Fichiers a creer :**
- `src/features/comments/components/comment-list.tsx`
- `src/features/comments/components/comment-form.tsx`

### 18.1 : CommentList

Composant reutilisable affichant une liste de commentaires.
- Chaque commentaire montre : avatar de l'auteur, nom, date relative (il y a 2h...), contenu
- Bouton supprimer visible pour l'auteur et l'admin
- Props : `comments[]`, `onDelete(id)`

### 18.2 : CommentForm

Composant reutilisable pour poster un commentaire.
- Textarea + bouton envoyer
- Props : `projectId`, `taskId?`, `onSubmit(content)`

**NOTE :** Ces composants sont crees en standalone. Ils seront integres dans les vues tache (panneau de detail) et projet par le Bloc 3 apres le merge de toutes les branches.

### 18.3 : Verification

Verifier que les composants se renderent correctement en isolation (on peut creer une page de test temporaire ou simplement verifier la compilation).

**Commit :** `feat: add comments UI (list and form)`
