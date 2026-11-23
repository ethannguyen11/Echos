# Brèches permanentes : compte rendu

Branche : `breches-permanentes`. Rien n'est commité ni poussé sur `main`.

Vocabulaire : « brèche » est le mot vu par le joueur et celui des nouveaux
noms de code. `js/poche.js` (les « poches d'Oubli », brèches sporadiques à
minuteur) est un **autre système**, il garde ses noms pour l'instant.

---

## Brique 1 : exploration et architecture

### Ce que le code fait aujourd'hui

**Les arènes (`js/lieux.js`)**
- Une arène s'appelle « donjon » dans le code. Son identifiant est
  `element.type + "/" + element.id` d'OpenStreetMap (`"way/123456"`,
  `"node/42"`). Il est **stable** : le même lieu donne le même id sur tous
  les appareils et à chaque session.
- Elles sont rangées dans le global `donjons` (objet indexé par id) et
  sauvées telles quelles sous `echos_donjons_v5` (`sauvegarder()` /
  `charger()`). Une arène découverte reste connue d'une session à l'autre.
- `categorie` vaut `temple`, `parc`, `metro` ou `monument` : exactement les
  valeurs de `ESPECES[x].famille`. C'est le pont naturel entre une arène et
  une « famille » de boss.
- Tout ce qui est tiré au sort (espèce, niveau, Figement) l'est par
  `tirageAleatoire(grainePourTexte(id))` : déterministe, sans `Math.random`.

**Le lancement d'un combat**
- `js/jeu.js`, bouton « Approcher » → `Ecran3.lancer(donjonProche, préemptif)`.
- `Ecran3.lancer` choisit l'écran : le combat à plusieurs si
  `COMBAT_MULTI_ACTIF` ou l'interrupteur du mode test, sinon
  `demarrerCombat()` (1 contre 1, `js/combat.js`).
- `donjonProche` est choisi par `mettreAJourHud()` (`js/carte.js`). **En
  mode test, il est toujours remplacé** par le terrain d'essai
  (`ModeTest.donjonDeTest`, id `"test/fictif"`, `fictif: true`) : on ne peut
  pas entrer dans une vraie arène quand le mode test est actif.

**Ce qu'Ecran3 reçoit**
- Le nombre d'adversaires : `nombreAdversaires(donjon)` →
  `COMBAT_MULTI_ADVERSAIRES_LIEU` (1), ou le sélecteur du mode test pour le
  terrain d'essai, plafonné à `ADVERSAIRES_MAX`.
- Le niveau : `niveauAdversaire(donjon)` (`donjon.niveau` + bonus du
  Figement), le malus du gate break (`malusGateBreak`, figé au départ) et le
  palier.
- `creerCombatMulti(equipe, adversaires, options)` (`js/combat3.js`) rend un
  objet `combat` dont chaque adversaire porte `pv`, `pvMax`, `atq`. Rien
  d'autre ne modifie ces chiffres ensuite.

**Les fins de combat** : `terminer(issue)` dans Ecran3 donne butin, XP et
assimilation, puis sauve (`sauverJoueur`) sauf pour un combat fictif, qui
recharge la vraie partie (`chargerJoueur`). Assimiler l'unique adversaire
compte comme une **victoire** (`issueCombatMulti`).

**Les marqueurs** : `poserMarqueur(d)` / `rafraichirMarqueur(d)` dans
`js/carte.js`, des `L.circleMarker` indexés dans `marqueurs[id]`.

**Le temps** : aucune notion de jour calendaire dans le jeu. `js/poche.js`
reçoit toujours « maintenant » de l'appelant ; c'est le modèle à suivre.

### Proposition

**Quatre nouveaux fichiers, aucun des fichiers interdits touché**
(`combat.js`, `combat3.js`, `poche.js`, `rendu3d.js` restent intacts) :

| Fichier | Rôle |
|---|---|
| `js/saisons.js` | Les **données** des saisons : un tableau `SAISONS_BRECHES`. Un objet JS plutôt qu'un `.json` : le jeu n'a pas de serveur de build, un `fetch` de fichier local échoue en `file://` sur iPhone et dans `verifier.js`. Ajouter une saison = ajouter un objet dans ce tableau, sans toucher au code. |
| `js/breches.js` | Les **règles pures** (calendrier, cycle, saison, classement) puis, en dernière section seulement, la sauvegarde sous sa propre clé. Ni DOM, ni horloge, ni `Math.random`. |
| `js/brechesjeu.js` | Le **branchement** : lit l'horloge, choisit la clé, pose les marqueurs, prépare le boss, enregistre la victoire. Expose un seul global `window.BrechesJeu`. Ne fait rien si le système est éteint. |
| `verifier/breches.js` | Les tests, lancés par `node verifier.js` (section 7). Plus `verifier/mutations-breches.js` : la preuve par mutations. |

Fichiers existants retouchés, par petites accroches gardées par
`BrechesJeu.actif()` : `js/config.js` (réglages), `js/carte.js`
(marqueur et bandeau), `js/ecran3.js` (boss, victoire), `js/jeu.js`
(démarrage), `js/modetest.js` + `index.html` (outils), `js/langues.js`
(textes), `css/style.css`, `verifier.js` et `verifier/parcours.js` (liste
des fichiers).

**Quelles arènes sont des brèches ?** Déterministe, sans serveur :
une arène est une brèche ce mois-ci si la saison définit un trio pour sa
catégorie **et** si `grainePourTexte("breche/" + mois + "/" + areneId) %
BRECHES_UNE_ARENE_SUR === 0`. Tous les appareils voient donc les mêmes
brèches, et elles changent de place à chaque saison.

**Le jour calendaire** : `jourCalendaire(instantMs, decalageMinutes)` rend
le numéro du jour local (jours depuis le 1er janvier 1970).
`decalageMinutes` suit la convention de `Date.getTimezoneOffset()` ; c'est
l'appelant qui le lit, **pour l'instant concerné** : un changement d'heure
est donc géré naturellement. Le mois (`"2026-11"`) se déduit du numéro de
jour, sans horloge.

**Le cycle** : une brèche stocke `cran` (0 à 6 : la prochaine marche à
gravir) et `dernierJour` (jour de la dernière victoire). Le cran du jour se
**calcule**, il ne se stocke pas : `cran - (jours manqués)`, plancher 0. Une
seule victoire par jour (`jour > dernierJour`). Une horloge qui recule ne
donne jamais de seconde victoire.

**Le boss et son multiplicateur** : le combat d'une brèche passe **toujours
par Ecran3** (même si l'écran à plusieurs est éteint, car l'ancien combat ne
sait pas appliquer un multiplicateur), avec 1 adversaire. Après
`creerCombatMulti`, Ecran3 multiplie `pv`, `pvMax` et `atq` de l'adversaire
par `rôle × cran` (fonction pure `appliquerForceBoss`). Le boss est un
« donjon » fabriqué pour l'occasion (`id: "breche/" + areneId`), qui reprend
la position, le niveau et le Figement de l'arène : l'arène elle-même n'est
jamais marquée capturée par un combat de brèche.

**La sauvegarde** : une clé neuve `echos_breches_v1`, format
`{ version, saison, breches, journal, trophees, saisonsPassees }`,
normalisée à la lecture comme `chargerPoches`. En mode test, une **autre**
clé, `echos_breches_test_v1`, qui porte aussi le décalage de jours simulé :
les outils de test ne peuvent pas abîmer la vraie partie.

**Le classement futur** : `bilanClassement()` rend
`{ format: 1, saison: "2026-11", joueur_id, possedees, breches: [{ arene_id,
jour_possession }] }`, trié, sans rien de local à l'appareil sauf
`joueur_id` (`"local"` aujourd'hui, comme les dépôts des poches).
