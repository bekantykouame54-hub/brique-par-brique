# Brique par Brique

Application de suivi d'habitudes, installable sur l'écran d'accueil (PWA).

- **Peu d'habitudes** : trois au maximum.
- **Un plan clair** : pour chacune, *quand* précisément, et une *version minimum* pour les jours difficiles.
- **Un mur de 100 briques** : chaque jour tenu pose une brique, soit 1 % du mur. Série en cours et constance sur 30 jours.
- **Argent** : entrées réparties en trois caisses (Dépenser 50 %, Épargner 30 %, Investir 20 %), dépenses notées par caisse, objectif d'épargne, bilan de la semaine.
- **Rappels** : notification à l'heure choisie, plus un export vers le calendrier du téléphone.
- Fonctionne hors connexion ; les données restent sur l'appareil (export / import en JSON).

## Mise en ligne (GitHub Pages)

Le site est statique, sans étape de compilation.

1. Sur GitHub : **Settings → Pages**.
2. *Source* : **Deploy from a branch**.
3. Choisir la branche qui contient ces fichiers, dossier **/ (root)**, puis **Save**.
4. Après une à deux minutes, l'application est disponible sur
   `https://bekantykouame54-hub.github.io/brique-par-brique/`.

## Installation sur le téléphone

**Android (Chrome)** : ouvrir l'adresse, menu ⋮ → *Ajouter à l'écran d'accueil* / *Installer l'application*.

**iPhone (Safari)** : ouvrir l'adresse, bouton Partager → *Sur l'écran d'accueil* → *Ajouter*.

Ouvrir ensuite l'application depuis son icône, puis onglet **Rappels → Activer les notifications**.

### À savoir sur les rappels

Sans serveur, une application web ne peut pas garantir une notification quand elle est complètement fermée.
Les rappels partent quand l'application est ouverte ou en arrière-plan (et, sur Android, lors des réveils
périodiques accordés par Chrome). Pour un rappel garanti, utiliser **Rappels → Ajouter à mon calendrier** :
le téléphone sonnera chaque jour à l'heure prévue.

## Développement

```bash
python3 -m http.server 8000
```

Après une modification, incrémenter `CACHE` dans `sw.js`.
