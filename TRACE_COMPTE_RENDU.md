# Fusion des brèches et banc de tracé : compte rendu

## En bref

Les deux parties sont faites, rien n'est bloqué.

| Étape | Commit |
|---|---|
| A. Étiquette de sécurité `avant-breches` (ancien `main`) | `b9056dd` |
| A. Fusion de `breches-permanentes` dans `main` | `fe48ed5` |
| B1. Moteur de reconnaissance (`js/trace.js`, `GLYPHES`) | `cc857f9` |
| B2. Banc de tracé dans le mode test | `9894f8e` |
| B3. Tests et preuve par mutations | `a8dfc96` |
| B. Compte rendu, puis fusion de `banc-trace` dans `main` | voir `git log` (commits qui suivent) |

**Vérification** à la fin :
- `node verifier.js` : seuls les 2 échecs voulus du mode test
  (`MODE_TEST` reste à `true`). Sur une copie avec le mode test éteint :
  « Tout est vert ».
- Nouvelle section **8. Trace des sorts** : 47 tests.
- `node verifier/mutations-trace.js` : **33 mutations, aucune survivante**.
  Au premier passage, 4 ont survécu : 2 révélaient de vrais trous (la
  symétrie de la distance et le choix du meilleur départ n'étaient pas
  testés : tests ajoutés), 2 étaient des mutants équivalents. L'un des
  deux : la garde « mode test actif » existe deux fois (panneau et banc),
  donc en retirer une ne change rien de visible ; il a été retiré de la
  liste, la garde reste.
- `node verifier/mutations-breches.js` : toujours 109 sur 109.
- Inchangés : `js/combat.js`, `js/combat3.js`, `js/poche.js`,
  `js/rendu3d.js`, et tout ce qui touche aux sauvegardes (`js/joueur.js`,
  `js/breches.js`, `js/brechesjeu.js`). Le banc n'écrit rien dans
  `localStorage` (testé).
- Fins de ligne : les fichiers en CRLF le restent. Un `sed -i` a
  converti `verifier.js` entier en LF dans la copie de travail ; le commit
  n'en a pas souffert (Git normalise), et la copie a été remise en CRLF.

## Partie A : fusion de `breches-permanentes` dans `main`

- La branche était à jour : `main` n'avait pas bougé depuis sa création
  (`b9056dd`), donc aucun conflit possible.
- `node verifier.js` avant la fusion : seuls les 2 échecs voulus du mode
  test.
- Étiquette de sécurité **`avant-breches`** posée sur `b9056dd` (l'ancien
  `main`) et poussée. Pour revenir en arrière : `git reset --hard avant-breches`
  sur `main` (à faire seulement si tu le décides : c'est une réécriture).
- Fusion `git merge --no-ff` : commit **`fe48ed5`**, sans réécriture de
  l'historique. `node verifier.js` après : les mêmes 2 échecs seulement.
  `main` poussé.

## Partie B : banc d'essai de tracé

### Approche

**Algorithme : la famille « $P » (point cloud recognizer).** Un tracé est
traité comme un nuage de points, pas comme un chemin :
1. **Rééchantillonnage** : tous les traits du dessin, bout à bout, sont
   ramenés à `TRACE_POINTS` (32) points également espacés le long du tracé.
2. **Normalisation** : mise à l'échelle uniforme (le plus grand côté du
   cadre englobant vaut 1, les proportions sont gardées : une vague reste
   plate) puis translation du centre de gravité à l'origine.
3. **Comparaison** : appariement glouton des points du tracé avec ceux du
   modèle (chaque point prend le plus proche encore libre, les premiers
   appariements pèsent plus), essayé depuis plusieurs points de départ et
   dans les deux sens ; on garde la plus petite distance.
4. **Score** de 0 à 1 : `1 - distance / tolérance du glyphe`, borné.

Pourquoi $P plutôt que $1 : $P ne dépend ni du **sens** du tracé (un
cercle tracé à l'envers est un cercle), ni du **nombre de traits** (la
croix se dessine en deux traits). $P ne corrige pas la rotation, et c'est
voulu : un éclair couché n'est plus un éclair.

**Fichiers**
- `js/trace.js` : `window.Trace`, fonctions pures (ni horloge, ni hasard,
  ni DOM) : `reconnaitre(traits, glyphes)`, plus les étapes exposées pour
  les tests et `resumeHistorique(historique)`.
- `js/config.js` : section « LE TRACE DES SORTS » avec les réglages et la
  bibliothèque `GLYPHES` (id, clé du nom, tolérance, points modèles, champ
  `deblocage` prévu mais non branché).
- `js/langues.js` : les noms des glyphes et les textes du banc, en
  français et en anglais.
- `js/modetest.js` + `index.html` + `css/style.css` : le bouton « Banc de
  tracé » et l'écran plein écran, sur le modèle du banc 3D.
- `verifier/trace.js` (section 8 de `node verifier.js`) et
  `verifier/mutations-trace.js` (preuve par mutations).

Aucun branchement dans le combat, la capture, les brèches ou la
sauvegarde.

### Ce qui a changé en cours de route

**La spirale demandait plus qu'un nuage de points.** Mesure sur des
tracés de synthèse : une vraie spirale tremblante était à 0,083 du modèle,
un gribouillis au hasard à 0,096. Vue comme un nuage, une spirale couvre
le cadre comme un gribouillis. Deux options par glyphe ont été ajoutées
dans `GLYPHES` :
- `ordre` : le tracé doit aussi suivre le **chemin** du modèle, point par
  point, dans un sens ou dans l'autre (un gribouillis tombe alors à 0,4) ;
- `miroir` : le reflet gauche-droite est accepté (une spirale tourne dans
  les deux sens).
Seule la spirale les utilise. Sa tolérance (0,35) n'est donc pas
comparable à celle des autres (0,14 à 0,16) : ce n'est pas la même
distance.

**Les tolérances** viennent de mesures sur des tracés de synthèse (un
tremblement lent, comme un doigt, plus un petit grain) :

| glyphe | tracé tremblant | gribouillis le plus proche | tolérance |
|---|---|---|---|
| cercle | 0,048 | 0,148 | 0,15 |
| triangle | 0,030 | 0,124 | 0,14 |
| éclair | 0,028 | 0,125 | 0,14 |
| croix | 0,031 | 0,128 | 0,14 |
| vague | 0,069 | 0,122 | 0,16 |
| spirale (chemin) | 0,141 | 0,397 | 0,35 |

Score = 1 − distance / tolérance. Seuil de reconnaissance : 0,35 (un
gribouillis plafonne vers 0,25). **Ces valeurs sont à recaler avec le banc
sur iPhone** : c'est précisément son but.

---

## Questions de design en attente

1. **Tolérances et seuil** (`GLYPHES[].tolerance`, `TRACE_SEUIL_RECONNU`) :
   calibrés sur des tracés de synthèse. Un vrai doigt sera sans doute plus
   imprécis : si tes scores tombent souvent sous 50 %, élargir les
   tolérances.
2. **Fin d'un tracé** : le doigt levé 700 ms (`TRACE_DELAI_FIN`). C'est ce
   qui permet la croix en deux traits, mais ça ajoute une attente.
   Alternatives : un bouton « Lancer », ou des glyphes tous en un trait.
3. **La croix est un « + »** (deux traits droits), pas un « × » : le « × »
   ressemblerait trop à l'éclair. Un « × » serait un autre glyphe.
4. **La rotation compte** : un triangle pointe en bas n'est pas reconnu.
   Une légère inclinaison passe (dans la tolérance). Faut-il accepter les
   glyphes tournés ?
5. **La spirale** se trace du centre ou du bord, dans les deux sens de
   rotation. Les autres glyphes acceptent aussi les deux sens de tracé.
6. **L'historique** donne, par glyphe *reconnu*, le nombre et le score
   moyen, plus le nombre de non-reconnus. Le banc ne sait pas quel signe
   tu *voulais* tracer : pour mesurer les confusions (cercle reconnu comme
   spirale…), il faudrait un sélecteur « glyphe visé ». Simple à ajouter.
7. **Un tracé trop court** (un tapotement) affiche « trop court » mais
   n'entre pas dans l'historique.
8. **Pour plus tard, non implémenté** :
   - qualité → chance de capture et XP : le score 0 à 1 est prêt pour une
     formule (linéaire au-dessus du seuil, par exemple) ;
   - déblocage : chaque glyphe a un champ `deblocage` (aujourd'hui `null`,
     lu par rien) ;
   - accessibilité : la reconnaissance ne dépend pas de l'écran, une
     alternative sans dessin pourra choisir le glyphe par un bouton et
     recevoir un score fixe (à décider : lequel ?).

---

## Vérification manuelle sur iPhone

`main` contient maintenant les brèches et le banc : si GitHub Pages sert
`main`, il suffit de recharger la page (en vidant le cache si besoin). Le
mode test est actif (`MODE_TEST = true`).

### Les brèches (outils de simulation des jours)

Procédure détaillée dans `BRECHES_COMPTE_RENDU.md`. En résumé :
1. « Brèches : Non » : le jeu est exactement comme avant.
2. « Brèches : Oui », Terrain « Brèche d'essai 1 » : le bandeau annonce
   « Brèche · jour 1/7 · force ×1 ». Approcher, gagner : « La brèche se
   referme… ».
3. « +1 jour » : jour 2, force ×1.15. « +3 jours » : retour au jour 1
   (trois crans perdus).
4. « Finir la semaine » : le boss final attend (jour 7/7, ×2). Le battre :
   « La brèche est à toi ». « État » : `possedee`.
5. « Mois suivant » : `saison 2026-12`, brèches remises à zéro, trophée de
   saison, Grimoire intact.
6. Le plafond : brèches d'essai 1, 2, 3 gagnées une fois chacune, puis la
   4 : « … 3 brèches sont déjà ouvertes ».
7. « Réinitialiser » : retour au vrai jour, aucune brèche.

### Le banc de tracé

1. Panneau du mode test : bouton **« Banc de tracé »**. Un écran plein
   écran s'ouvre : titre, consigne, un grand cadre carré, Effacer, Fermer.
2. Trace un cercle d'un seul geste : le trait doré suit le doigt **pendant**
   le dessin, et la page ne défile pas. Lève le doigt : un peu moins d'une
   seconde plus tard, « Cercle · NN % » et les scores des six glyphes (le
   meilleur en doré).
3. La croix : un trait vertical, puis un horizontal **sans attendre** :
   un seul résultat, « Croix ». Si tu attends trop entre les deux, le
   premier trait est jugé seul.
4. Essaie les six glyphes, chacun plusieurs fois, dans tes deux sens
   habituels. La spirale : du centre vers le bord, ou l'inverse.
5. Un tapotement : « Tracé trop court ». Un gribouillis : « Signe non
   reconnu · meilleur : … ».
6. Sous les boutons, l'historique : « N derniers tracés · M non
   reconnu(s) », puis par glyphe « Cercle : 5 × · moyenne 78 % ». Il garde
   les 20 derniers tracés ; Fermer puis rouvrir le garde ; recharger la
   page l'efface (rien n'est sauvegardé).
7. **Ce qu'il faut me rapporter** : pour chaque glyphe, la moyenne
   affichée et combien de fois il a été confondu ou non reconnu. C'est ce
   qui permettra de recaler les tolérances (question 1).
8. En anglais (langue changée dans le jeu) : « Tracing bench », « Circle »,
   « Clear »… aucun texte brut.
