# Engramme — guide d'usage du logo

## 1. L'idée
Un fil unique serpente en trois boucles et dessine l'extérieur d'un **E**, comme les sillons du cortex.
Il part d'un **point** : la trace d'un souvenir (l'engramme). Il n'y a pas de « dos » au E : le fil ne redescend pas.

## 2. Versions
| Version | Fichier | Usage |
|---|---|---|
| Symbole (clair) | `engramme-symbol.svg` | fonds clairs |
| Symbole (sombre) | `engramme-symbol-dark.svg` | fonds sombres (version principale dans l'appli) |
| Symbole petite taille | `engramme-symbol-small*.svg` | **en dessous de 48 px** : trait épaissi, boucles plus espacées |
| Horizontal | `engramme-horizontal*.svg` | en-têtes, e-mails, README |
| Vertical | `engramme-stacked*.svg` | écran de connexion, affiches |
| Mot seul | `engramme-wordmark.svg` | quand le symbole est déjà présent à côté |
| Une couleur | `mono/` | noir, blanc, charbon (tampon, gravure, fax…) |
| Web / PWA | `web/` | favicon, icône iPhone, manifest |

## 3. Couleurs (reprises de `src/theme.css`)
| Nom | HEX | RGB | Rôle |
|---|---|---|---|
| Charbon encre | `#2b2b2e` | 43, 43, 46 | fil et texte sur fond clair |
| Blanc fantôme | `#f4f4f8` | 244, 244, 248 | fil et texte sur fond sombre |
| Moutarde | `#fed766` | 254, 215, 102 | point sur fond sombre |
| Flamme | `#ff4a1c` | 255, 74, 28 | point sur fond clair |
| Charbon profond | `#1c1c1f` | 28, 28, 31 | tuile de l'icône, fond sombre |

Le point est toujours l'unique touche de couleur. Pas de CMYK ni de Pantone définis : la marque est pensée pour l'écran.
Le moutarde sur fond blanc manque de contraste : utiliser le point flamme sur fond clair.

## 4. Espace de protection
Laisser autour du logo au moins **une boucle** (la hauteur d'une boucle du symbole, environ 19 % de sa hauteur).

## 5. Tailles minimales
| Version | Écran |
|---|---|
| Horizontal | 96 px de large |
| Symbole complet | 48 px |
| Symbole petite taille | 16 px (favicon) |

## 6. À éviter
Ne pas étirer, pivoter ou ajouter d'ombre, de contour ou de dégradé. Ne pas changer la couleur du point hors palette.
Ne pas retaper « Engramme » dans une police : utiliser le fichier (le mot est tracé en chemins, police Noto Sans Regular, licence OFL).
Ne pas poser sur une image chargée sans tuile sombre.

## 7. Mise en place dans l'appli
Les icônes `web/icon-192.png` et `web/icon-512.png` sont prêtes à remplacer celles de `public/`.
`web/head-snippet.html` donne les balises `<head>` ; `web/site.webmanifest` sert de référence (le manifest réel est dans `vite.config.ts`).

## 8. Limites
- Aucune recherche d'antériorité de marque n'a été faite : à vérifier avant tout usage public.
- Le mot est en Noto Sans Regular épaissi légèrement : un lettrage sur mesure reste possible.
- Le petit format n'a été vérifié qu'en rendu (16 / 32 / 64 px) sur planche, pas sur un iPhone réel.
