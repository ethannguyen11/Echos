# Fusion des brèches et banc de tracé : compte rendu

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
