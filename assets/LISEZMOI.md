# Les fichiers 3D

Ce dossier reçoit les modèles 3D du futur combat. **Le jeu n'en a besoin
d'aucun pour fonctionner** : une espèce sans modèle garde son image 2D
actuelle (et, sans image, sa silhouette de secours), exactement comme
aujourd'hui.

Le combat ne les affiche pas encore. Pour l'instant, ils se voient
seulement dans le **banc 3D** du mode test.

## La convention

| Quoi | Où | Nom |
|---|---|---|
| Un monstre | `assets/monstres/` | la clé de l'espèce, sans accent : `komainu.glb` |
| Un décor de combat | `assets/decors/` | le type de lieu : `parc.glb`, `temple.glb`, `monument.glb`, `metro.glb` |
| Une cinématique d'attaque | `assets/attaques/` | son identifiant : `morsure.json` |

Les musées tombent dans `monument` : il n'y a pas de type « musée ».

Le nom du fichier n'est **pas deviné** : il est écrit dans le manifeste,
dans `js/config.js` (`MONSTRES_3D`, `DECORS_3D`). Ajouter un modèle se fait
donc en deux gestes :

1. déposer `assets/monstres/komainu.glb` ;
2. dans `js/config.js`, ligne `komainu`, remplacer `modele: null` par
   `modele: "assets/monstres/komainu.glb"`.

`node verifier.js` te prévient si le chemin ne suit pas la convention ou si
le fichier n'existe pas.

## Les clips d'animation attendus

Chaque monstre doit contenir ces cinq animations, **avec ces noms exacts**
(minuscules, sans accent) :

| Nom | Quand | Joué |
|---|---|---|
| `idle` | au repos | en boucle |
| `attaque` | il frappe | une fois, puis retour à `idle` |
| `degat` | il encaisse | une fois, puis retour à `idle` |
| `ko` | il tombe | une fois, reste au sol |
| `victoire` | il a gagné | une fois, reste sur la dernière pose |

Un clip manquant ne casse rien : le modèle garde sa pose. Si ton fichier
nomme un clip autrement, inutile de le renommer : indique-le dans le
manifeste, par exemple `clips: { attaque: "Morsure" }`.

## Faire un vrai .glb dans Blender

1. Modélise ton monstre **debout sur le sol** (ses pieds à hauteur 0), face
   à l'axe −Y de Blender (la vue de face, touche `1` du pavé numérique).
   Hauteur conseillée : environ 1 mètre ; l'échelle se règle ensuite dans
   le manifeste (`echelle`).
2. Pour chaque animation, crée une **Action** dans l'éditeur *Action*
   (Dope Sheet → Action Editor) et nomme-la exactement `idle`, `attaque`,
   `degat`, `ko`, `victoire`. Clique sur le bouclier (*Fake User*) de
   chaque action pour qu'elle ne soit pas perdue.
3. **Fichier → Exporter → glTF 2.0 (.glb/.gltf)**.
4. Dans la fenêtre d'export :
   - **Format** : *glTF Binaire (.glb)* ;
   - **Inclure** : coche *Sélection uniquement* si la scène contient autre
     chose (caméra, lumières de travail…) ;
   - **Animation** : coche *Animation*, et dans *Mode d'animation* choisis
     *Actions* pour que chaque action devienne un clip séparé ;
   - **Données → Maillage** : coche *Appliquer les modificateurs*.
5. Enregistre sous `komainu.glb` (la clé de l'espèce), puis dépose-le dans
   `assets/monstres/`.

Pour le look PS1 / DS : peu de polygones, des textures toutes petites, et,
dans l'éditeur d'image de la texture, l'interpolation sur *Closest* (pas de
lissage).

## Le budget

Pensé pour GitHub Pages et la 5G, dehors, en marchant. Les valeurs exactes
sont dans `js/config.js` (`BUDGET_3D`).

| | Triangles max | Texture max | Poids max |
|---|---|---|---|
| Monstre | 800 | 128 × 128 | 300 Ko |
| Décor | 3 000 | 256 × 256 | 500 Ko |
| Cinématique (.json) | — | — | 10 Ko |

Un combat à 3 contre 3, c'est six monstres et un décor : au pire environ
2,3 Mo à télécharger une seule fois, et 7 800 triangles à l'écran. Blender
affiche le nombre de triangles dans la barre d'état (clic droit sur la
barre → *Statistiques de scène*).

L'image entière ne fait que 320 × 240 pixels : une texture plus grande que
le budget ne se verrait pas, elle coûterait seulement du téléchargement.

## Les cinématiques d'attaque

Ce sont des **descriptions en données**, pas des vidéos. Le format est
décrit en tête de la section 3D de `js/config.js`, et
`assets/attaques/test.json` sert d'exemple. Aucune n'est encore jouée par
le jeu.

## Les fichiers de test

`monstres/test.glb` (un cube de 12 triangles, avec les cinq clips),
`decors/test.glb` (un sol et quatre piliers) et `attaques/test.json` servent
au banc 3D et aux vérifications. Ce ne sont pas des espèces : ne les
supprime pas.
