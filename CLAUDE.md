# Engramme

Application de « second cerveau » (notes, liens, recherche, assistant IA) sous forme de **site web responsive installable comme PWA sur iPhone**. Il n'y a qu'un seul code : l'appli mobile *est* le site responsive.

Le nom vient d'« engramme » : la trace physique d'un souvenir dans le cerveau.

## Objectifs et contraintes

- Un site web + une appli iPhone, **un seul code** (PWA).
- Installation sur iPhone via Safari → Partager → « Sur l'écran d'accueil ». Pas d'App Store, pas de Play Store, pas de compte développeur Apple.
- **Hébergement et services 100 % gratuits** (free tiers uniquement). Ne propose aucun service payant.
- HTTPS obligatoire (requis pour une PWA), fourni par l'hébergeur.
- Usage personnel au départ, mais l'auth et le RLS doivent être en place dès le début.
- **Assistant IA (RAG)** : poser des questions en langage naturel et obtenir une réponse basée sur les notes de l'utilisateur, avec les notes sources citées, au lieu de chercher manuellement.

## Stack

| Besoin | Techno |
|---|---|
| Frontend | Vite + React + TypeScript |
| Style | Tailwind CSS |
| PWA | `vite-plugin-pwa` (manifest + service worker) |
| Backend / BDD / Auth | Supabase (free tier) : Postgres, auth email / magic link, recherche plein texte |
| Vecteurs (RAG) | `pgvector` dans le Postgres de Supabase |
| Backend IA | Supabase Edge Functions (Deno) : indexation et question / réponse |
| Embeddings + LLM | Fournisseur avec free tier (voir section RAG) |
| Éditeur de notes | Tiptap ou Milkdown (Markdown) |
| Hors-ligne (plus tard) | Service worker, éventuellement IndexedDB avec Dexie |
| Hébergement | Cloudflare Pages (ou Vercel), déploiement auto depuis GitHub |

Variables d'environnement côté frontend : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (fichier `.env.local`, jamais commité ; fournir un `.env.example`).

**Les clés des fournisseurs IA ne vont jamais dans le frontend** (pas de variable `VITE_`) : elles sont stockées comme secrets des Edge Functions Supabase (`supabase secrets set ...`).

## Modèle de données (point de départ)

> Ce schéma est le point de départ d'origine. Le schéma réel (beaucoup plus de tables) est décrit dans « Base de données (état actuel) » plus bas.

Table `notes` :

- `id` (uuid, PK)
- `user_id` (uuid, référence `auth.users`)
- `title` (text)
- `content` (text, Markdown)
- `tags` (text[])
- `created_at`, `updated_at` (timestamptz)

Table `note_chunks` (RAG) :

- `id` (uuid, PK)
- `note_id` (uuid, référence `notes`, `on delete cascade`)
- `user_id` (uuid, référence `auth.users`)
- `chunk_index` (int)
- `content` (text) : le morceau de texte
- `content_hash` (text) : pour ne ré-embedder que les morceaux modifiés
- `embedding` (`vector(N)`) : `N` dépend du modèle d'embeddings choisi (768 par défaut), à garder cohérent partout
- Index HNSW sur `embedding` (cosine)

**Row Level Security obligatoire sur toutes les tables** : chaque utilisateur ne lit et n'écrit que ses propres données (`user_id = auth.uid()`). La fonction SQL de recherche vectorielle `match_note_chunks(query_embedding, match_count)` doit être en `security invoker` pour respecter le RLS. Les migrations SQL vont dans `supabase/migrations/`.

## Fonctionnalités, dans l'ordre

À implémenter **une par une**, en validant chaque étape avant de passer à la suivante :

1. Squelette du projet : Vite + React + TS + Tailwind, config PWA, client Supabase.
2. Auth (email / magic link) et routes protégées.
3. CRUD de notes.
4. Recherche (Postgres full-text search).
5. Tags et liens entre notes (`[[note]]` façon Obsidian), backlinks.
6. Mode hors-ligne.
7. Déploiement continu sur Cloudflare Pages / Vercel (à faire tôt si possible, pour tester la PWA sur iPhone).
8. RAG, partie 1 : indexation (pgvector, découpage en morceaux, embeddings).
9. RAG, partie 2 : assistant de question / réponse dans l'UI.

## RAG : assistant IA alimenté par les notes

### Architecture

**Indexation** (Edge Function `index-note`) :

1. Déclenchée à la création ou modification d'une note (appel depuis le client après sauvegarde, ou webhook de base de données Supabase).
2. Découpe le Markdown en morceaux (environ 300 à 500 tokens, avec léger chevauchement, en respectant les titres quand c'est possible).
3. Compare le `content_hash` de chaque morceau et ne calcule les embeddings que pour les morceaux nouveaux ou modifiés.
4. Fait un upsert dans `note_chunks` et supprime les morceaux obsolètes.

**Question / réponse** (Edge Function `ask`) :

1. Reçoit la question et le JWT de l'utilisateur (le RLS s'applique donc automatiquement).
2. Calcule l'embedding de la question.
3. Appelle `match_note_chunks` pour récupérer les morceaux les plus proches (top 5 à 8).
4. Construit un prompt : consignes + morceaux de contexte + question. Le modèle doit répondre **uniquement à partir du contexte** et dire explicitement « je ne trouve pas cela dans tes notes » sinon.
5. Renvoie la réponse en streaming, avec la liste des notes sources (liens cliquables vers les notes).

### Fournisseurs gratuits (à vérifier dans la doc au moment de l'implémentation)

Les quotas des free tiers changent souvent : **vérifier les limites actuelles avant de choisir**, et isoler l'appel au fournisseur dans un seul module pour pouvoir en changer facilement.

- **Google Gemini API (Google AI Studio)** : free tier pour les embeddings et la génération. Très pratique, mais sur le free tier les données peuvent être utilisées par Google pour améliorer ses produits.
- **Cloudflare Workers AI** : free tier quotidien, modèles d'embeddings et de génération open source. Option plus respectueuse de la vie privée.
- **Groq, Mistral, OpenRouter (modèles `:free`)** : alternatives pour la génération.

Les notes sont des données personnelles : garder en tête ce compromis vie privée / gratuité et ne pas envoyer plus de contexte que nécessaire au LLM.

Ollama / modèles locaux : **écartés**, car ils ne sont pas accessibles depuis l'iPhone sans serveur payant.

### Points d'attention

- Respecter les limites de débit : file d'attente ou debounce à l'indexation, pas de ré-embedding de notes inchangées, retry avec backoff.
- Garder le modèle d'embeddings stable : en changer impose de ré-indexer toutes les notes (la dimension du vecteur change).
- Le free tier de Supabase **met en pause un projet inactif** après environ une semaine : prévoir un moyen de le réveiller (utilisation régulière, ou ping planifié).
- Limiter la taille de la base : quelques milliers de notes restent largement dans le free tier, mais les vecteurs prennent de la place.
- Afficher toujours les sources dans la réponse pour pouvoir vérifier ce que l'IA affirme.

## Design et esthétique

Direction visuelle : un mélange de **glassmorphisme** et de **bento box**. Interface moderne, aérée, douce et un peu poétique.

### Glassmorphisme (le matériau)

- Surfaces semi-transparentes avec flou d'arrière-plan : `backdrop-blur` (Tailwind) avec un fond de type `bg-white/10` en sombre ou `bg-white/60` en clair.
- Bordure fine et lumineuse (`border border-white/20`) et ombre douce et diffuse pour donner l'impression de verre posé sur un fond.
- Arrière-plan avec dégradés doux ou grandes taches de couleur floues (blobs), pour que le verre ait quelque chose à flouter.
- Coins très arrondis (`rounded-2xl` à `rounded-3xl`).
- Sur iOS Safari, vérifier le rendu de `backdrop-filter` (préfixe `-webkit-backdrop-filter` si Tailwind ne le gère pas) et limiter le nombre de surfaces floutées superposées pour garder de bonnes performances.

### Bento box (la mise en page)

- Grille modulaire de cartes de tailles variées (1x1, 2x1, 1x2, 2x2) en **CSS Grid**, avec des espacements (`gap`) et des rayons de bordure identiques partout.
- Chaque carte = un bloc de contenu autonome : notes récentes, recherche, tags, assistant IA, note épinglée, etc.
- Responsive mobile-first : une colonne sur iPhone (ou deux pour les petites cartes), puis la vraie grille bento sur tablette / desktop.
- Hiérarchie visuelle claire : la carte la plus importante (assistant IA ou recherche) est la plus grande.

### Principes

- Mode sombre en priorité, mode clair supporté, en suivant le réglage du système (`prefers-color-scheme`).
- Palette sobre : une couleur d'accent et des tons neutres. Pas de couleurs criardes.
- Typographie lisible, une seule famille de police avec peu de graisses.
- Animations légères et fluides (transitions courtes, survol / appui discret), pas d'effets lourds.
- **Accessibilité** : le verre ne doit jamais nuire à la lisibilité. Garder un contraste suffisant du texte sur les surfaces translucides (ajuster l'opacité du fond si besoin).
- Cibles tactiles d'au moins 44 px, et prise en compte des safe areas iOS.
- Tout le style passe par Tailwind. Définir les valeurs récurrentes (couleurs, rayons, flou, opacités) comme tokens dans la config Tailwind, et réutiliser les mêmes composants de carte (`Card`, etc.) plutôt que de dupliquer les classes. Pas de bibliothèque de composants UI supplémentaire sans raison.

## Contraintes PWA / iOS

Dans `index.html` :

```html
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- Manifest : `name: "Engramme"`, `short_name: "Engramme"`, `display: standalone`, icônes 192x192 et 512x512.
- Penser aux safe areas iOS (`env(safe-area-inset-*)`) et au design mobile-first.
- Le stockage hors-ligne peut être purgé par iOS : **Supabase reste la source de vérité**.
- L'assistant IA nécessite une connexion (appels aux Edge Functions), il n'est pas disponible hors-ligne.
- Les notifications push iOS ne fonctionnent que pour une PWA installée (iOS 16.4+) et restent limitées.
- Si besoin de fonctions natives plus tard, envelopper la PWA avec Capacitor sans tout réécrire.

## Conventions de travail (à respecter)

- **Code complet et prêt à l'emploi** : fournir des fichiers entiers, pas des extraits partiels à compléter.
- **Itératif** : une option / une fonctionnalité à la fois, pas de grosse refonte d'un coup.
- **Pas d'abstractions inutiles** : pas de couche, de wrapper ou de pattern ajouté « au cas où ». Seule exception assumée : un module unique pour l'appel au fournisseur IA, afin de pouvoir changer de free tier.
- **Réutiliser les types et interfaces existants** plutôt que d'introduire de nouveaux types locaux. Les types de la base peuvent être générés depuis Supabase et réutilisés partout.
- TypeScript strict, pas de `any`.
- Commits petits et clairs, un par étape fonctionnelle.
- Répondre en français ; le code, les noms de variables et les commits en anglais.

## Commandes

```bash
npm install        # installer les dépendances
npm run dev        # serveur de dev
npm run build      # build de production
npm run preview    # tester le build (utile pour la PWA)
```

## État réel de l'application (tour complet au 2026-11-03)

Ce qui suit décrit le code **tel qu'il est**, pas la cible. En cas de conflit avec les sections de spécification ci-dessus, c'est ce qui est écrit ici qui décrit l'existant ; les sections ci-dessus décrivent l'intention.

**Écarts notables avec la spécification d'origine :**
- L'éditeur de notes est un simple `<textarea>` Markdown (`NoteEditor.tsx`), pas Tiptap/Milkdown.
- La colonne `notes.tags` existe mais **aucune UI ne l'utilise** ; les liens `[[note]]` et les backlinks n'existent pas.
- La recherche plein texte (`notes.fts`) est branchée sur la barre de recherche de l'accueil.
- L'assistant IA (`/assistant`) est un **écran factice** (champ désactivé). Aucune Edge Function RAG, aucune extension `pgvector`, aucune table `note_chunks`.
- Pas de mode hors-ligne : seul `vite-plugin-pwa` (manifest + service worker `generateSW`) est en place.
- Pas de déploiement configuré (Cloudflare Pages / Vercel).
- Il y a beaucoup de fonctionnalités **hors feuille de route initiale** : projets/dossiers/tâches/documents, calendrier ICS, fils directeurs, idées, tableau de bord, page Apparence.
- Les types de base sont **écrits à la main** dans `src/lib/database.types.ts` (pas générés par `supabase gen types`).

**Git :** tout le travail depuis le commit `f423d82` (recherche plein texte) est **non commité** (nombreux fichiers modifiés et non suivis). Les futurs agents doivent committer par petites étapes fonctionnelles (voir conventions).

## Carte du code

### Routes (`src/App.tsx`)

Providers : `AppearanceProvider` > `AuthProvider` > `BrowserRouter`. Tout sauf `/login` est derrière `ProtectedRoute` puis `AppLayout` (barre de navigation + fond).

| Route | Page | Rôle |
|---|---|---|
| `/login` | `Login.tsx` | Magic link **ou** code à 6 chiffres (`signInWithOtp` / `verifyOtp`), seule page centrée (`max-w-md`) |
| `/` | `Home.tsx` | Tableau de bord bento : événements du jour (calendriers ICS), fil directeur du jour, notes (recherche FTS), tâches datées (cochables), compte |
| `/assistant` | `Assistant.tsx` | Placeholder (RAG à venir) |
| `/calendar` | `Calendar.tsx` | Calendrier mois + jour sélectionné en grille horaire (56 px/heure, scroll masqué) + détail d'événement ; gestion des sources ICS dans une modale |
| `/projects` | `Projects.tsx` | Dossiers et projets ; création par modales ; projets sans dossier (carte « Sans dossier ») ; glisser-déposer d'un projet vers un dossier ; renommer/supprimer un dossier |
| `/projects/:id` | `ProjectDetail.tsx` | Tâches (avec échéance via `DatePicker`), notes du projet, documents (Supabase Storage), changer de dossier (`Select`), supprimer |
| `/principles` | `Principles.tsx` | « Fils directeurs » : liste numérotée dépliable (titre = `content`, + `description`), création en modale |
| `/ideas` | `Ideas.tsx` | « Foire aux idées » : mur de cartes, statut (raw / dig / project / dropped, cycle au clic), tags (`#tag` dans le texte à la création), recherche et filtres côté client, création en modale |
| `/notes/new`, `/notes/:id` | `NoteEditor.tsx` | Édition d'une note ; `?project=<id>` rattache la note à un projet |
| `/appearance` | `Appearance.tsx` | Thème (système/clair/sombre), fond (réseau, aurore, points, étoiles, uni, image perso), couleurs d'accent (préréglages + personnalisées) |

Ordre de la barre de navigation (`AppLayout.tsx`, tableau `links`) : Accueil, Assistant, Calendrier, Projets, Fils directeurs, Idées, puis Apparence et Déconnexion en bas. Sur mobile c'est une barre flottante en bas ; dès `md` c'est un rail vertical à gauche (`md:pl-24` sur le contenu). Avec 8 boutons, les items utilisent `flex-1 max-w-12` pour tenir sur ~375 px : en ajouter un nouveau demande de revérifier ce calcul (ou de regrouper Apparence/Déconnexion).

### Composants partagés (`src/components/`)

- `Card` : surface en verre (le bloc de base de toute mise en page bento). Ne pas dupliquer ses classes.
- `Modal` : `<dialog>` natif (`showModal`), fermeture par Échap ou clic sur le fond, `overflow-visible` (les panneaux flottants y restent dans le `<dialog>`).
- `Select` : menu déroulant maison (combobox/listbox accessible, clavier). **Remplace le `<select>` natif**, dont la liste système ne suit pas le thème.
- `DatePicker` : sélecteur de date maison (valeur `YYYY-MM-DD` ou `''`). **Remplace `<input type="date">`**, pour la même raison.
- `FloatingPanel` : panneau en verre rendu par **portail** (dans `document.body`, ou dans le `<dialog>` englobant), positionné en `fixed` sous son ancre, ferme au clic extérieur/Échap. Utilisé par `Select` et `DatePicker`. Voir « Pièges » pour la raison d'être.
- `Logo` : symbole d'Engramme en SVG (fil `currentColor`, point `var(--accent)`, prop `small` pour le tracé épaissi). Utilisé sur `Login` et en haut du rail `md+`. Kit complet (SVG, icônes, guide) dans `design/logo/` ; les icônes PWA de `public/` en sont copiées. Le gabarit d'e-mail charge `{{ .SiteURL }}/icon-192.png` : le logo n'apparaît dans le mail que si l'URL du site est publique.
- `Icon.tsx` : `Icon`, le dictionnaire `iconPaths` (tracés SVG, style Feather) et les classes de boutons-icônes `iconButtonClass` (neutre), `iconPrimaryClass` (accent), `iconOutlineClass` (bordure).
- `AppLayout` (navigation + fond + `<Outlet/>`), `ProtectedRoute`, `Background` (+ `NeuralBackground` en three.js, `DotsBackground` et `StarsBackground` en canvas 2D).

### Librairies (`src/lib/`)

- `supabase.ts` : client typé `createClient<Database>`, lève une erreur si `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` manquent.
- `auth.tsx` : `AuthProvider` / `useAuth()` (`session`, `loading`) via `onAuthStateChange`.
- `database.types.ts` : interface `Database` écrite à la main + alias `Note`, `Folder`, `Project`, `Task`, `ProjectDocument`, `Principle`, `CalendarSource`, `Idea`, `IdeaStatus`. **À mettre à jour à la main à chaque migration.**
- `calendar.ts` : `parseIcs(sourceId, text, from, to)` (ical.js : récurrences, exceptions `RECURRENCE-ID`, VTIMEZONE, événements annulés ignorés, plafond 20 000 occurrences) et `fetchFeed(sourceId)` (appelle l'Edge Function `fetch-calendar`). Type `CalendarEvent`.
- `dates.ts` : `localDateString()` (YYYY-MM-DD **local**, jamais `toISOString()` qui décale selon le fuseau) et `formatDueDate()`.
- `storage.ts` : bucket `project-documents`, `removeProjectFiles()` (la suppression SQL en cascade ne supprime pas les fichiers Storage : il faut les retirer avant).
- `appearance.tsx` : thème, fond, couleurs, image de fond, persistés dans `localStorage` (clés `engramme.theme`, `engramme.background`, `engramme.backgroundImage`, `engramme.colors`). Le `localStorage` y est un simple confort (try/catch partout) ; `index.html` applique thème et couleurs avant le premier rendu pour éviter le flash.

### Base de données (état actuel)

Toutes les tables ont le RLS activé avec 4 politiques (select/insert/update/delete) `user_id = auth.uid()` ; `user_id` a `default auth.uid()` (on ne l'envoie pas côté client).

| Table | Colonnes utiles |
|---|---|
| `notes` | `title`, `content`, `tags text[]` (inutilisé en UI), `project_id` (nullable, `on delete set null`), `fts` (tsvector généré, config `french`, index GIN), `updated_at` (trigger) |
| `folders` | `name` |
| `projects` | `folder_id` (**nullable** : projet sans dossier), `name`, `updated_at` (trigger) |
| `tasks` | `project_id`, `title`, `done`, `due_date date` (nullable) |
| `project_documents` | `project_id`, `name`, `storage_path`, `size` ; fichiers dans le bucket privé `project-documents`, chemin `<user_id>/<project_id>/<fichier>`, limite 20 Mo |
| `principles` | `content` (= titre du fil directeur), `description` |
| `calendar_sources` | `name`, `url` (lien ICS secret, `https` ou `webcal`), `color` |
| `ideas` | `content`, `status` (check : `raw`/`dig`/`project`/`dropped`), `tags text[]`, `updated_at` (trigger) |

Fonction `public.set_updated_at()` partagée par les triggers. Migrations dans `supabase/migrations/`, dans cet ordre : `create_notes`, `notes_full_text_search`, `projects` (folders + projects + tasks + documents + bucket), `principles`, `projects_optional_folder`, `calendar_sources`, `tasks_due_date`, `principles_description`, `ideas`.

**Il n'y a pas de `supabase/config.toml` ni de `.env.example` dans le dépôt** (alors que la spécification demande un `.env.example`). Le gabarit d'e-mail `supabase/templates/magic-link.html` est à coller côté Supabase.

### Edge Functions (`supabase/functions/`)

- `fetch-calendar` : reçoit `{ source_id }` + le JWT de l'utilisateur, lit l'URL dans `calendar_sources` **via RLS**, télécharge le flux ICS côté serveur (le navigateur est bloqué par CORS) et le renvoie en `text/plain`. Garde-fous : https seulement, résolution DNS et rejet des IP privées (SSRF) à chaque redirection (3 max), délai 10 s, taille max 5 Mo. **Non testée en conditions réelles** (écrite et typée, pas exécutée ni déployée depuis cet environnement).
- L'Edge Function `index-note` / `ask` du RAG n'existe pas encore.

### Mise en route et déploiement manuel

À faire par l'utilisateur (ces commandes ne sont pas automatisées ; l'état de la base distante n'est pas vérifiable depuis le code) :

```bash
supabase db push                          # appliquer les migrations en attente
supabase functions deploy fetch-calendar  # sinon calendrier et accueil affichent une erreur
```

Si une page affiche une erreur Supabase du type « relation does not exist » ou « column ... does not exist », une migration n'a pas été appliquée.

## Conventions de code observées (à suivre)

- **Chargement de données** : `useEffect` avec drapeau `cancelled`, appels `supabase.from(...)` directs dans la page (pas de couche de service ni de React Query), état local, mise à jour de l'état **après** succès serveur, erreurs dans un état `error` affiché dans un `<p role="alert" className="text-sm text-danger">`.
- **Pages** : `<main className="p-4 ...">` **pleine largeur** (pas de `max-w` ni de `mx-auto`, choix explicite de l'utilisateur ; seule `Login` est centrée), cartes dans une grille bento.
- **Boutons d'action = icônes** (poubelle, crayon, plus, coche, croix…), toujours avec `aria-label` **et** `title`, via `Icon` + `iconButtonClass` / `iconPrimaryClass` / `iconOutlineClass`. Exceptions assumées : les boutons texte **Annuler / Créer / Enregistrer** à l'intérieur des modales, et quelques liens de navigation (« ← Projets »). Ajouter un nouveau tracé dans `iconPaths` plutôt que du SVG inline.
- **Création d'éléments** (dossier, projet, fil directeur, idée, calendrier) : un bouton « + » ouvre une `Modal` ; on n'utilise pas de formulaire d'ajout intégré à la carte.
- **Verre** : l'utilitaire Tailwind `glass-surface` (défini dans `src/index.css` : flou + saturation + reflet) avec les jetons de `src/theme.css` (`--glass`, `--glass-border`, `--glass-sheen`, `--glass-shadow`, `--glass-blur`, `--glass-saturate`). `theme.css` est le **seul** endroit où les couleurs sont définies ; Tailwind les expose via `@theme inline` (`bg-glass`, `text-muted`, `bg-field`, `text-accent-text`, `text-danger`, `rounded-card`, `shadow-glass`…). Ne pas coder de couleur en dur, sauf les couleurs de calendrier choisies par l'utilisateur.
- **Mobile** : cibles tactiles ≥ 44 px (`min-h-11`, `size-11`), safe areas iOS déjà gérées dans `body` et la barre de navigation.
- **Texte** : interface et commentaires en **français**, identifiants et commits en **anglais**. TypeScript strict, pas de `any`. Aucun linter ni test automatisé n'est configuré : la vérification disponible est `npm run build` (`tsc -b` + `vite build`).
- **Dette connue** : les constantes `inputClass` / `buttonClass` sont **recopiées** dans plusieurs pages (7 occurrences de `inputClass`) ; les extraire dans un composant `Field`/`Input` partagé serait un refactor légitime mais n'a pas été fait.

### Ajouter une table ou une fonctionnalité (check-list)

1. Migration SQL dans `supabase/migrations/` avec horodatage croissant : table, `user_id ... default auth.uid() references auth.users on delete cascade`, index sur `user_id`, **RLS + 4 politiques**, trigger `set_updated_at` si `updated_at`.
2. Ajouter la table dans `Database` (`Row`/`Insert`/`Update`) **et** un alias exporté en bas de `database.types.ts`.
3. Page dans `src/pages/`, route dans `App.tsx`, entrée dans `links` de `AppLayout.tsx` si elle mérite un accès direct (attention à la largeur de la barre mobile).
4. `npm run build` doit passer. Dire à l'utilisateur de lancer `supabase db push`.
5. Mettre à jour cette section et la check-list d'avancement ci-dessous.

## Pièges connus (déjà rencontrés)

- **Surfaces en verre imbriquées** : un élément avec `backdrop-filter` crée un contexte d'empilement et une « racine de fond » : un menu `absolute` à l'intérieur d'une `Card` passe **sous** les cartes suivantes, et son propre flou ne voit pas le reste de la page. D'où `FloatingPanel` (portail). Tout nouveau menu/popover doit l'utiliser. (`ProjectDetail` donne aussi `relative z-20` à sa carte d'en-tête.)
- **Dans un `<dialog>` à fond flouté**, `position: fixed` se repère par rapport à la modale, pas à l'écran (compensé dans `FloatingPanel`).
- **Échap dans une modale** ferme la modale : un panneau interne doit intercepter la touche en phase de capture (`preventDefault` + `stopPropagation`).
- **Dates** : toujours `localDateString()` ; les colonnes `date` sont comparées comme chaînes `YYYY-MM-DD`.
- **Glisser-déposer HTML5** (projets vers dossiers) est peu fiable sur iPhone : le sélecteur « Dossier » de la page projet en est l'alternative fiable, ne pas le retirer.
- **Accueil** : chaque visite appelle l'Edge Function une fois par source de calendrier. Si le nombre de sources grandit, prévoir un cache.
- **Liens ICS** : ce sont des secrets stockés en clair en base (protégés par RLS). Ne jamais les logguer ni les afficher.
- **Inscriptions** : tant que « Allow new users to sign up » est actif côté Supabase (réglage par défaut), n'importe qui peut créer un compte avec un magic link. Le RLS l'empêche de voir les données d'autrui, mais il pourrait consommer le quota gratuit et utiliser `fetch-calendar` comme relais. Pour un usage personnel, désactiver les inscriptions dans le dashboard (le client ne peut pas le garantir : la clé anon est publique) et inviter les comptes voulus depuis Authentication → Users.
- Le calendrier est en **lecture seule** (abonnement ICS). Écrire dans Google/Microsoft demanderait OAuth et des projets cloud côté fournisseur : non fait.

## Idées et suite possible (non engagé)

Pistes évoquées avec l'utilisateur, par ordre de valeur perçue : tâches datées affichées dans le calendrier ; capture rapide (bouton « + » global, Web Share Target, raccourcis écran d'accueil) ; couleurs de cartes, épinglage, « En faire un projet » et idée au hasard sur l'accueil pour les idées ; description du fil directeur du jour sur l'accueil ; journal quotidien et revue hebdomadaire ; export Markdown/ZIP ; ping planifié contre la mise en pause du free tier Supabase ; puis les étapes 5 à 9 de la feuille de route (tags et `[[liens]]`, hors-ligne, déploiement, RAG).

## État d'avancement

Étapes de la feuille de route :

- [x] 1. Squelette du projet
- [x] 2. Auth
- [x] 3. CRUD de notes
- [x] 4. Recherche (plein texte sur l'accueil)
- [ ] 5. Tags et liens entre notes (colonne `tags` présente, pas d'UI ; ni `[[liens]]` ni backlinks)
- [ ] 6. Mode hors-ligne
- [ ] 7. Déploiement (à faire tôt si possible pour tester la PWA sur iPhone)
- [ ] 8. RAG : indexation
- [ ] 9. RAG : assistant question / réponse (écran factice seulement)

Fonctionnalités ajoutées hors feuille de route : projets / dossiers / tâches datées / documents, calendrier ICS (+ Edge Function `fetch-calendar`), fils directeurs, idées, tableau de bord d'accueil, page Apparence (thèmes, fonds, couleurs), système de composants (`Modal`, `Select`, `DatePicker`, `FloatingPanel`, `Icon`).

*(Mettre à jour cette liste à la fin de chaque étape.)*
