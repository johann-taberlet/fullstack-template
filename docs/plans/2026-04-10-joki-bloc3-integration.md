# Joki — Bloc 3 : Integration, Notifications, Dashboard, Settings, Seed, Deploy

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Integrer les features cross-cutting apres le merge des 4 branches : brancher les commentaires dans les vues tache/projet, creer le service notifications avec Resend, connecter le magic link, construire le dashboard avec statistiques, la page settings, le seed de dev, et la configuration Docker.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposee via Route Handlers REST (`/api/v1/*`) et consommee par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Resend, Zod, @react-pdf/renderer, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

---

## Contexte : toutes les features existent

Les 4 branches feature ont ete mergees dans main. L'application contient deja :

**Foundation (Bloc 1) :**
- Prisma schema complet, migrations appliquees
- Better Auth serveur + client (admin, magic link avec placeholder console.log)
- Pages login/setup, middleware auth
- Layout dashboard avec sidebar et header

**Feature Clients (Bloc 2A) :**
- `src/features/clients/` — types, service, api, composants (ClientList, ClientForm)
- `src/app/api/v1/clients/` — Route Handlers
- `src/app/(dashboard)/clients/` — Pages liste et detail

**Feature Projects + Tasks (Bloc 2B) :**
- `src/features/projects/` — types, service, api, composants (ProjectList, ProjectCard, ProjectForm, ProjectHeader)
- `src/features/tasks/` — types, service, api, composants (KanbanBoard, KanbanColumn, TaskCard, TaskForm)
- `src/app/api/v1/projects/` — Route Handlers (projets, clients par projet, taches par projet)
- `src/app/api/v1/tasks/` — Route Handlers (detail, position)
- `src/app/(dashboard)/projects/` — Pages liste, detail avec layout onglets (Taches/Temps/Factures/Parametres), settings

**Feature Time Tracking + Comments (Bloc 2C) :**
- `src/features/time-tracking/` — types, service, api, composants (Timer, TimeEntryList, TimeEntryForm)
- `src/features/comments/` — types, service, api, composants standalone (CommentList, CommentForm)
- `src/app/api/v1/time/` et `src/app/api/v1/projects/[id]/time/` — Route Handlers
- `src/app/api/v1/comments/` et endpoints par projet/tache — Route Handlers
- `src/app/(dashboard)/projects/[slug]/time/` — Page temps

**Feature Invoices (Bloc 2D) :**
- `src/features/invoices/` — types, service, api, composants (InvoiceList, InvoiceForm, InvoicePreview), template PDF
- `src/app/api/v1/invoices/` et `src/app/api/v1/projects/[id]/invoices/` — Route Handlers
- `src/app/(dashboard)/projects/[slug]/invoices/` — Page factures par projet
- `src/app/(dashboard)/invoices/` — Page factures globale

---

## Etape 0 : Merge des branches et nettoyage des worktrees

**IMPORTANT :** Executer ces commandes AVANT toute autre tache.

```bash
cd /Users/jo/dev/perso/joki

# Merge des 4 branches avec --no-ff pour preserver l'historique
git merge --no-ff feature/clients -m "Merge branch 'feature/clients'"
git merge --no-ff feature/projects-tasks -m "Merge branch 'feature/projects-tasks'"
git merge --no-ff feature/time-comments -m "Merge branch 'feature/time-comments'"
git merge --no-ff feature/invoices -m "Merge branch 'feature/invoices'"

# Nettoyage des worktrees
git worktree remove ../joki-clients
git worktree remove ../joki-projects
git worktree remove ../joki-time
git worktree remove ../joki-invoices

# Nettoyage des branches locales
git branch -d feature/clients
git branch -d feature/projects-tasks
git branch -d feature/time-comments
git branch -d feature/invoices
```

En cas de conflits de merge (peu probable vu l'isolation des fichiers), les resoudre manuellement.

---

## Task 21.5 : Integration cross-feature (commentaires)

**Fichiers a modifier :**
- `src/features/tasks/components/task-card.tsx` ou le panneau de detail tache — Ajouter la section commentaires
- `src/app/(dashboard)/projects/[slug]/page.tsx` ou un composant projet — Ajouter la section commentaires projet

**Objectif :** Les composants `CommentList` et `CommentForm` (crees dans le Bloc 2C) sont des composants standalone. Il faut maintenant les integrer dans les vues existantes :

1. **Panneau de detail tache :** Quand on clique sur une TaskCard dans le Kanban, le panneau de detail doit afficher les commentaires de la tache en bas (utiliser `listTaskComments(taskId)` et le `CommentForm` avec le `taskId`).

2. **Page projet :** Ajouter une section commentaires generaux du projet (pas lies a une tache) dans la vue projet. Peut etre dans une section sous le Kanban ou dans un onglet dedie.

**Commit :** `feat: wire comments into task detail and project views`

---

## Task 22 : Service Notifications et Templates Email

**Fichiers a creer :**
- `src/shared/lib/email.ts`
- `src/features/notifications/service.ts`
- `src/features/notifications/types.ts`
- `src/features/notifications/templates/invitation.tsx`
- `src/features/notifications/templates/new-comment.tsx`
- `src/features/notifications/templates/invoice-sent.tsx`

### 22.1 : Client Resend

Creer le client Resend dans `src/shared/lib/email.ts` avec `new Resend(process.env.RESEND_API_KEY)`.

### 22.2 : Service notifications

**Fonctions :**
- `sendInvitation(email, magicLinkUrl)` — Email d'invitation pour un nouveau client avec le lien magic link
- `notifyNewComment(projectId, comment)` — Notifie les participants du projet quand un commentaire est poste
- `sendInvoiceEmail(invoice, pdfBuffer)` — Envoie la facture par email avec le PDF en piece jointe

Chaque fonction utilise le client Resend et un template JSX (Resend accepte du JSX via l'option `react`).

### 22.3 : Templates email

Templates JSX simples (pas besoin de react-email) pour chaque type de notification. Inclurent au minimum : un titre, le contenu pertinent, et un lien d'action.

### 22.4 : Brancher les notifications dans les services existants

Modifier les services pour appeler les notifications aux bons moments :
- `src/features/clients/service.ts` → `createClient` appelle `sendInvitation` apres la creation
- `src/features/comments/service.ts` → `createComment` appelle `notifyNewComment`
- `src/features/invoices/service.ts` → `sendInvoice` appelle `sendInvoiceEmail` avec le PDF

**Commit :** `feat: add notification service with Resend and email templates`

---

## Task 23 : Brancher Magic Link dans Better Auth

**Fichier a modifier :** `src/features/auth/lib.ts`

Remplacer le `console.log` placeholder dans la config `sendMagicLink` de Better Auth par l'appel reel au service notifications :

```typescript
magicLink({
  sendMagicLink: async ({ email, token, url }) => {
    await notificationService.sendInvitation(email, url);
  },
}),
```

**Verification du flow complet :**
1. Admin cree un client via l'UI
2. Email d'invitation envoye via Resend
3. Client clique sur le magic link
4. Client definit son mot de passe sur la page `/setup`
5. Client accede a ses projets dans le dashboard

**Commit :** `feat: wire magic link to Resend email notifications`

---

## Task 24 : Dashboard avec statistiques

**Fichiers a modifier :** `src/app/(dashboard)/page.tsx`

**Fichiers a creer :** `src/features/projects/components/project-stats.tsx`

### 24.1 : Dashboard admin

Remplacer le placeholder par un vrai dashboard affichant :
- Nombre de projets actifs
- Heures travaillees cette semaine (agrege depuis TimeEntry)
- Factures en attente (nombre + montant total des factures SENT)
- Derniere activite (commentaires recents, taches mises a jour)
- Liste des projets actifs avec leur progression (ratio taches DONE / total)

### 24.2 : Dashboard client

Vue adaptee au role client :
- Ses projets avec avancement
- Dernieres taches mises a jour sur ses projets
- Factures en attente de paiement

Les donnees sont chargees cote serveur dans le Server Component via les services existants.

### 24.3 : Verification

Tester les deux vues (se connecter en admin puis en client).

**Commit :** `feat: add dashboard with stats for admin and client views`

---

## Task 25 : Page Settings

**Fichiers a creer :**
- `src/app/(dashboard)/settings/page.tsx`
- `src/features/auth/components/profile-form.tsx`

### 25.1 : Page parametres

Sections du formulaire :
- **Profil :** Modifier nom et avatar
- **Securite :** Changer le mot de passe
- **Facturation (admin only) :** Informations utilisees dans les PDF de factures — nom complet, adresse, SIRET/numero de TVA

### 25.2 : Verification

Tester la modification du profil et du mot de passe.

**Commit :** `feat: add settings page with profile management`

---

## Task 26 : Seed de developpement

**Fichiers a creer :** `prisma/seed.ts`

**Fichier a modifier :** `package.json` (ajouter la config seed)

### 26.1 : Script de seed

Generer des donnees realistes :
- 1 utilisateur admin (le developpeur)
- 3 clients avec profils (entreprises variees)
- 3 projets avec statuts differents (ACTIVE, DRAFT, COMPLETED)
- 10-15 taches reparties dans les projets avec des statuts varies (TODO, IN_PROGRESS, REVIEW, DONE)
- Quelques entrees de temps (timer et saisie manuelle)
- 2 factures (1 DRAFT, 1 SENT)
- Quelques commentaires sur les projets et taches

### 26.2 : Configuration package.json

```json
"prisma": {
  "seed": "bun prisma/seed.ts"
}
```

### 26.3 : Verification

```bash
bunx prisma db seed
```

Verifier que toutes les donnees sont creees et visibles dans l'UI.

**Commit :** `feat: add development seed script`

---

## Task 27 : Review finale et deploiement

### 27.1 : Verification complete

```bash
bun run lint
bun run build
```

Corriger toutes les erreurs de lint et de build.

### 27.2 : Configuration Docker pour Coolify

Creer un `Dockerfile` optimise pour Next.js avec Bun :
- Build stage multi-step
- Image de production legere
- Variables d'environnement configurables

Creer un `docker-compose.yml` pour le dev local :
- Service app (Next.js)
- Service PostgreSQL
- Volume pour la persistence des donnees

### 27.3 : Variables d'environnement

Mettre a jour `.env.example` avec toutes les variables requises et documentees :
- `DATABASE_URL` — URL de connexion PostgreSQL
- `BETTER_AUTH_SECRET` — Secret pour Better Auth (generer avec openssl)
- `BETTER_AUTH_URL` — URL de base de l'application
- `RESEND_API_KEY` — Cle API Resend pour les emails

### 27.4 : Verification finale

- `docker compose up` fonctionne
- `bun run build` reussit sans erreur
- L'application demarre et toutes les features fonctionnent

**Commit :** `feat: add Docker configuration and final cleanup`
