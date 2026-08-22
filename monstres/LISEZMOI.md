# Les illustrations des Échos

Un fichier par espèce. Le jeu va chercher l'image ici, et se débrouille
tout seul quand elle n'existe pas encore.

## La convention

| | |
|---|---|
| **Format** | PNG, fond **transparent** (pas de blanc, pas de damier aplati) |
| **Nom** | la clé interne de l'espèce, en minuscules, sans accent : `jinchan.png` |
| **Taille** | environ **1000 px de haut**, largeur libre |
| **Poids** | vise moins de 300 Ko par image |

Le nom du fichier n'est pas deviné : il est écrit noir sur blanc dans le
champ `image` de chaque espèce, dans `js/especes.js`.

```js
jinchan: {
  image: "jinchan.png", famille: "parc",
  ...
}
```

Si tu renommes un fichier ici, change aussi ce champ. C'est le seul
endroit à corriger, et `node verifier.js` te préviendra si les deux ne
correspondent plus.

## Les seize fichiers attendus

| Famille | Fichiers |
|---|---|
| Temples | `komainu.png` · `chiguo.png` · `sunwukong.png` · `palantir.png` |
| Métro | `mechadrill.png` · `teketeke.png` · `zhanxiyuan.png` · `baku.png` |
| Monuments | `eiffel.png` · `tortuedragon.png` · `hephaistos.png` · `vinci.png` |
| Parcs | `hinezumi.png` · `penghou.png` · `peng.png` · `jinchan.png` |

## Tu peux n'en avoir aucune, ou trois sur seize

C'est prévu, et c'est la règle principale de ce dossier : **le jeu reste
parfaitement jouable avec un dossier vide.**

Une espèce dont l'image manque affiche un **visuel de secours** : une
silhouette sombre, colorée selon son affinité (Pierre ocre, Flamme or
terni, Brume vert-de-gris), avec son initiale. Elle ne provoque aucune
erreur, et n'empêche jamais les autres espèces de s'afficher
normalement. Tu peux donc dessiner tes seize Échos un par un, sur des
semaines, sans jamais casser le jeu entre deux.

Le secours n'est pas un message d'erreur : c'est un état d'attente qui
a l'air voulu.

## Les deux images de test sont PROVISOIRES

`jinchan.png` et `komainu.png` ont été générées automatiquement pour
vérifier que le branchement fonctionne. Ce sont deux formes plates, sans
intention de dessin.

**Elles sont à remplacer par tes propres illustrations.** Rien d'autre
n'est à faire que d'écraser les deux fichiers : le nom ne change pas, le
code non plus.

Pour vérifier que tout est branché, ouvre le jeu : Jin Chan est l'Écho de
départ, il apparaît donc dans la cinématique d'ouverture et dans le
grimoire dès le premier lancement. Si tu le vois dessiné et que les
quatorze autres espèces montrent une silhouette colorée, le
branchement est bon.
