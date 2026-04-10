# Joki — Plateforme de gestion de projets freelance

## Résumé

Plateforme web pour gérer les projets de développement pour des clients. Deux types d'utilisateurs : admin (le développeur) et clients (collaboration active). Toutes les actions sont exposées via une API REST pour permettre l'intégration avec un CLI futur (Claude Code).

## Stack technique

| Domaine | Choix |
|---------|-------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Auth | Better Auth |
| DB | PostgreSQL + Prisma |
| Emails | Resend + React Email (templates) |
| PDF | @react-pdf/renderer |
| Validation | Zod |
| Linting | Biome |
| Package manager | Bun |
| Déploiement | Oracle Cloud + Coolify |

## Architecture

Monolithe Next.js avec approche API-first. La couche services métier est partagée entre le frontend (Server Components) et l'API REST.

```
┌─────────────────────────────────────────┐
│              Next.js Monolith           │
├──────────────┬──────────────────────────┤
│  Pages/UI    │   Route Handlers         │
│  (React)     │   /api/v1/*              │
├──────────────┴──────────────────────────┤
│    Features (services + composants)     │
├─────────────────────────────────────────┤
│         Prisma (PostgreSQL)             │
└─────────────────────────────────────────┘
        ▲                    ▲
        │                    │
   Frontend UI          CLI / Claude Code
```

## Utilisateurs & rôles

- **ADMIN** : Le développeur (toi). Accès complet à tous les projets, time tracking, facturation, gestion des clients.
- **CLIENT** : Invité par magic link via email. Peut voir ses projets, créer/modifier des tâches, commenter. Ne peut pas accéder au time tracking, à la facturation (sauf voir ses factures), ni gérer d'autres clients.

### Matrice de permissions

| Action | ADMIN | CLIENT |
|--------|:-----:|:------:|
| Créer un projet | Oui | Non |
| Voir un projet | Tous | Ses projets |
| Créer/modifier une tâche | Oui | Oui (ses projets) |
| Suivi de temps | Oui | Non |
| Créer une facture | Oui | Non |
| Voir une facture | Oui | Ses factures |
| Commenter | Oui | Oui (ses projets) |
| Gérer les clients | Oui | Non |

## Modèle de données

```
User
├── id, email, passwordHash, name, role (ADMIN | CLIENT)
├── avatarUrl, createdAt, updatedAt

Client (profil étendu d'un User role=CLIENT)
├── id, userId (FK), company, phone, address
├── has many: Projects (via ProjectClient)

Project
├── id, name, slug, description, status (DRAFT | ACTIVE | PAUSED | COMPLETED | ARCHIVED)
├── color, startDate, endDate, budget
├── belongsTo: User (owner = admin)
├── has many: ProjectClient, Task, TimeEntry, Invoice, Comment

Task
├── id, projectId, title, description, status (TODO | IN_PROGRESS | REVIEW | DONE)
├── priority (LOW | MEDIUM | HIGH | URGENT), position (ordre kanban)
├── dueDate, assigneeId (FK User), createdById (FK User)
├── has many: Comment, TimeEntry

TimeEntry
├── id, projectId, taskId (optionnel), userId
├── description, startTime, endTime, duration (minutes)
├── billable (bool)

Invoice
├── id, projectId, clientId, number (auto-incrémenté)
├── status (DRAFT | SENT | PAID | OVERDUE | CANCELLED)
├── issueDate, dueDate, totalAmount, taxRate, notes
├── has many: InvoiceItem (description, quantity, unitPrice, amount)

Comment
├── id, projectId, taskId (optionnel), userId
├── content (texte), createdAt
```

## API REST

Toutes les routes sous `/api/v1/`. Authentification par Bearer token (Better Auth).

### Auth
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### Projects
```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/clients
POST   /api/v1/projects/:id/clients
DELETE /api/v1/projects/:id/clients/:clientId
```

### Tasks
```
GET    /api/v1/projects/:id/tasks
POST   /api/v1/projects/:id/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id/position
```

### Time Entries
```
GET    /api/v1/projects/:id/time
POST   /api/v1/projects/:id/time
PATCH  /api/v1/time/:id
DELETE /api/v1/time/:id
GET    /api/v1/time/running
```

### Invoices
```
GET    /api/v1/projects/:id/invoices
POST   /api/v1/projects/:id/invoices
GET    /api/v1/invoices/:id
PATCH  /api/v1/invoices/:id
GET    /api/v1/invoices/:id/pdf
POST   /api/v1/invoices/:id/send
```

### Comments
```
GET    /api/v1/projects/:id/comments
GET    /api/v1/tasks/:id/comments
POST   /api/v1/comments
DELETE /api/v1/comments/:id
```

### Clients
```
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/clients/:id
PATCH  /api/v1/clients/:id
```

## Structure des fichiers (Feature-Sliced adaptée)

```
src/
├── app/                              # ROUTING ONLY — pages fines
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── setup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       ├── time/page.tsx
│   │   │       ├── invoices/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── invoices/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...all]/route.ts
│       └── v1/
│           ├── projects/
│           ├── tasks/
│           ├── time/
│           ├── invoices/
│           ├── comments/
│           └── clients/
│
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── lib.ts
│   │   └── types.ts
│   ├── projects/
│   │   ├── components/
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── tasks/
│   │   ├── components/
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── time-tracking/
│   │   ├── components/
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── invoices/
│   │   ├── components/
│   │   ├── templates/
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── types.ts
│   ├── clients/
│   │   ├── components/
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── types.ts
│   └── notifications/
│       ├── templates/
│       ├── service.ts
│       └── types.ts
│
├── shared/
│   ├── components/ui/
│   ├── lib/
│   ├── types/
│   └── utils/
│
└── prisma/
    └── schema.prisma
```

### Principes d'organisation
- `app/` = routeur fin, importe depuis `features/`
- Chaque feature est autonome : composants, service, API handler, types
- `shared/` = ce qui est utilisé par 2+ features
- Une feature ne doit pas importer directement depuis une autre feature

## Notifications email (Resend)

- Invitation client (magic link pour setup mot de passe)
- Nouveau commentaire sur un projet/tâche
- Facture envoyée
- Rappel facture en retard
- Changement de statut de tâche (optionnel)

## UI/UX

Style moderne et coloré, inspiré Asana/Monday. Accessible pour des clients non-techniques.

- Dashboard avec vue d'ensemble des projets actifs
- Kanban board pour les tâches par projet
- Timer intégré pour le time tracking
- Prévisualisation des factures avant export PDF
- Système de commentaires inline sur les tâches
