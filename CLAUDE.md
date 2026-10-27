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

## État d'avancement

- [x] 1. Squelette du projet
- [x] 2. Auth
- [ ] 3. CRUD de notes
- [ ] 4. Recherche
- [ ] 5. Tags et liens entre notes
- [ ] 6. Mode hors-ligne
- [ ] 7. Déploiement
- [ ] 8. RAG : indexation
- [ ] 9. RAG : assistant question / réponse

*(Mettre à jour cette liste à la fin de chaque étape.)*
