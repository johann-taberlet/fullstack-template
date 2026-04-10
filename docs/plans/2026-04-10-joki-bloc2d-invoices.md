# Joki — Bloc 2D : Feature Invoices + PDF

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implementer la facturation complete : service CRUD, API REST, UI (liste, formulaire, previsualisation), et generation de PDF avec @react-pdf/renderer.

**Architecture:** Monolithe Next.js 16 API-first avec feature-sliced organization. Toutes les actions passent par une couche service, exposee via Route Handlers REST (`/api/v1/*`) et consommee par les Server Components. Auth via Better Auth (plugins admin + magic link). PostgreSQL via Prisma.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Better Auth, Prisma, PostgreSQL, Zod, @react-pdf/renderer, Biome, Bun

**Docs Next.js:** Lire `node_modules/next/dist/docs/01-app/` avant d'ecrire du code Next.js. Les API peuvent avoir change par rapport aux versions precedentes.

**Branch :** `feature/invoices` (worktree `../joki-invoices`)

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

**REGLE :** Ne modifier aucun fichier hors du scope de cette feature. Creer uniquement des fichiers dans `src/features/invoices/`, `src/app/api/v1/invoices/`, `src/app/api/v1/projects/[id]/invoices/`, `src/app/(dashboard)/projects/[slug]/invoices/`, et `src/app/(dashboard)/invoices/`.

---

## Task 19 : Service et API Invoices

**Fichiers a creer :**
- `src/features/invoices/types.ts`
- `src/features/invoices/service.ts`
- `src/features/invoices/api.ts`
- `src/app/api/v1/projects/[id]/invoices/route.ts`
- `src/app/api/v1/invoices/[id]/route.ts`
- `src/app/api/v1/invoices/[id]/pdf/route.ts`
- `src/app/api/v1/invoices/[id]/send/route.ts`

### 19.1 : Types Zod

- `createInvoiceSchema` : clientProfileId (string), dueDate (date), taxRate (number, default 0), notes? (string), items (array de { description: string, quantity: number, unitPrice: number })
- `updateInvoiceSchema` : partial du precedent + status?
- Le champ `number` est auto-incremente (gere par Prisma). Le `totalAmount` est calcule automatiquement.

### 19.2 : Service invoices

**Fonctions :**
- `listInvoices(projectId?)` — Liste les factures d'un projet ou toutes les factures. Inclut client et projet.
- `getInvoice(id)` — Detail avec items, client, projet.
- `createInvoice(projectId, input)` — Calcule `totalAmount` = somme(items.quantity * items.unitPrice) * (1 + taxRate/100). Cree la facture et ses items en transaction.
- `updateInvoice(id, input)` — Met a jour. Recalcule le total si les items changent.
- `generatePdf(id)` — Genere un buffer PDF avec @react-pdf/renderer (implementation dans Task 21).
- `sendInvoice(id)` — Met le status a SENT. L'envoi email sera branche dans le Bloc 3 via le service notifications.

**Permissions :**
- Admin : CRUD complet
- Client : lecture seule sur ses propres factures (GET uniquement)

### 19.3 : API handlers + Route Handlers

- `GET/POST /api/v1/projects/:id/invoices` — Lister par projet / creer
- `GET/PATCH /api/v1/invoices/:id` — Detail / modifier
- `GET /api/v1/invoices/:id/pdf` — Retourne un `Response` avec `Content-Type: application/pdf`
- `POST /api/v1/invoices/:id/send` — Envoyer la facture (change status)

### 19.4 : Verification

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/invoices \
  -H "Content-Type: application/json" \
  -d '{"clientProfileId":"...","dueDate":"2026-05-10","taxRate":20,"items":[{"description":"Dev homepage","quantity":1,"unitPrice":2000}]}'
```

**Commit :** `feat: add invoices CRUD service and REST API`

---

## Task 20 : UI Invoices

**Fichiers a creer :**
- `src/features/invoices/components/invoice-list.tsx`
- `src/features/invoices/components/invoice-form.tsx`
- `src/features/invoices/components/invoice-preview.tsx`
- `src/app/(dashboard)/projects/[slug]/invoices/page.tsx`
- `src/app/(dashboard)/invoices/page.tsx`

### 20.1 : InvoiceList

Tableau des factures.
- **Colonnes :** Numero, Client, Montant (formate en euros), Statut (badge colore : vert=PAID, jaune=SENT, rouge=OVERDUE, gris=DRAFT, barre=CANCELLED), Date emission, Date echeance
- **Actions :** Voir detail, telecharger PDF, marquer comme payee

### 20.2 : InvoiceForm

Formulaire de creation/edition.
- Selection du client (dropdown des clients du projet)
- Date d'echeance (date picker)
- Taux de TVA (number input, %)
- Notes (textarea, optionnel)
- **Liste d'items dynamique :** Ajouter/supprimer des lignes. Chaque ligne : description, quantite, prix unitaire, montant (calcule). Total calcule en temps reel (sous-total + TVA + total TTC).

### 20.3 : InvoicePreview

Previsualisation de la facture avant envoi. Affiche le meme layout que le PDF mais en HTML :
- En-tete avec infos du developpeur
- Infos client
- Numero, dates
- Tableau des items
- Totaux

### 20.4 : Pages

- `/projects/[slug]/invoices` — Factures d'un projet specifique. Accessible via l'onglet "Factures" dans le layout projet (cree par le worktree B).
- `/invoices` — Vue globale de toutes les factures (admin uniquement). Accessible via la sidebar.

### 20.5 : Verification

Tester dans le navigateur : creation d'une facture avec items dynamiques, previsualisation, liste.

**Commit :** `feat: add invoices UI (list, form, preview)`

---

## Task 21 : Generation PDF Factures

**Fichiers a creer :**
- `src/features/invoices/templates/invoice-pdf.tsx`

**Fichier a modifier :**
- `src/features/invoices/service.ts` (ajouter l'implementation de `generatePdf`)

### 21.1 : Template PDF avec @react-pdf/renderer

Creer un composant React PDF pour la facture avec un layout professionnel :
- **En-tete :** Nom/logo du developpeur, coordonnees
- **Infos client :** Nom, entreprise, adresse
- **Metadata :** Numero de facture, date d'emission, date d'echeance
- **Tableau des items :** Description, Quantite, Prix unitaire, Montant — avec en-tetes de colonnes
- **Totaux :** Sous-total HT, TVA (montant + taux), Total TTC
- **Notes :** Section notes en bas si presentes

Utiliser les composants `Document`, `Page`, `View`, `Text`, `StyleSheet` de `@react-pdf/renderer`.

### 21.2 : Integration dans le service

La fonction `generatePdf(id)` dans le service :
1. Charge la facture complete (items, client, projet)
2. Cree le composant React PDF avec les donnees
3. Appelle `renderToBuffer` de `@react-pdf/renderer`
4. Retourne le buffer

### 21.3 : Endpoint PDF

L'endpoint `/api/v1/invoices/:id/pdf` :
1. Appelle `generatePdf(id)`
2. Retourne une `Response` avec les headers :
   - `Content-Type: application/pdf`
   - `Content-Disposition: inline; filename="facture-{number}.pdf"`

### 21.4 : Verification

Ouvrir `http://localhost:3000/api/v1/invoices/{id}/pdf` dans le navigateur. Le PDF doit se telecharger/afficher avec le bon contenu.

**Commit :** `feat: add PDF invoice generation with @react-pdf/renderer`
