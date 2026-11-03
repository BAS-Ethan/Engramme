# Engramme

Application de « second cerveau » (notes, liens, recherche, assistant IA) sous forme de site web responsive installable comme PWA sur iPhone.

## Démarrer

```bash
cp .env.example .env.local   # puis renseigner les valeurs Supabase
npm install
npm run dev
```

Autres commandes : `npm run build` (production), `npm run preview` (tester le build et la PWA).

## Base de données et Edge Functions

```bash
supabase db push                          # applique supabase/migrations/
supabase functions deploy fetch-calendar  # nécessaire pour le calendrier et l'accueil
```

## Déploiement (Cloudflare Pages)

1. Pages → Create project → connecter ce dépôt GitHub.
2. Build command : `npm run build` ; build output directory : `dist`.
3. Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Supabase → Authentication → URL Configuration : mettre l'adresse `*.pages.dev` en « Site URL » et dans « Redirect URLs ».
5. Coller `supabase/templates/magic-link.html` dans Authentication → Email Templates.
6. iPhone : ouvrir l'adresse dans Safari → Partager → « Sur l'écran d'accueil ».

## Logo

Kit complet dans `design/logo/` (voir `GUIDE.md`).

Contexte détaillé du projet : `CLAUDE.md`.
