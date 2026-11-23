# Brèches permanentes : compte rendu

Branche : `breches-permanentes`. Rien n'est commité ni poussé sur `main`.

Vocabulaire : « brèche » est le mot vu par le joueur et celui des nouveaux
noms de code. `js/poche.js` (les « poches d'Oubli », brèches sporadiques à
minuteur) est un **autre système**, il garde ses noms pour l'instant.

## En bref

Les 8 briques sont faites, rien n'est bloqué. Le système est **éteint**
(`BRECHES_PERMANENTES_ACTIF = false`) : le jeu normal est inchangé tant
qu'on ne l'allume pas. Le mode test l'allume avec le bouton
**« Brèches : Oui »**.

| Brique | Commit | Contenu |
|---|---|---|
| 1 | `e2118ec` | Exploration et architecture (ce document) |
| 2 | `6042331` | Réglages (`js/config.js`) et saisons (`js/saisons.js`) |
| 3 | `c854ec8` | Logique pure : calendrier, cycle, recul, plafond, possession |
| 4 | `33f4818` | Saison mensuelle, compteur, bilan pour le classement |
| 5 | `1858971` | Sauvegarde sous `echos_breches_v1`, chargement défensif |
| 6 | `658f201` | Branchement : anneaux, bandeau, boss dans Ecran3, victoire |
| 7 | `9f7bf0c` | Outils du mode test (jours simulés, semaine, mois, état, remise à zéro) |
| 8 | le commit qui ajoute cette section | Relecture, compte rendu complet |

**Vérification** (à la fin de la brique 8) :
- `node verifier.js` : seuls les 2 échecs voulus du mode test
  (« livré à l'arrêt », « mode test éteint »). Sur une copie avec
  `MODE_TEST = false` et `MODE_TEST_LOCAL_SEULEMENT = true` : « Tout est
  vert ».
- La nouvelle section **7. Brèches permanentes** compte 154 tests
  (réglages 18, jours 15, cycle 32, saison 22, sauvegarde 15, jeu 32,
  mode test 20).
- `node verifier/mutations-breches.js` : **109 mutations, aucune
  survivante**. Chaque mutation abîme une ligne du jeu en mémoire et exige
  qu'au moins un test passe au rouge. Pendant le travail, 9 mutations ont
  d'abord survécu : 6 révélaient un vrai trou dans les tests (corrigé en
  ajoutant le test), 2 étaient des mutants équivalents, qui ne changent
  pas le comportement (remplacés par d'autres), 1 révélait du code mort
  (retiré).
- `js/combat.js`, `js/combat3.js`, `js/poche.js`, `js/rendu3d.js` :
  inchangés (`git diff main` vide pour eux). `echos_joueur_v5` et
  `echos_poches_v1` : aucune clé modifiée, et un test prouve qu'une série
  de victoires, une bascule et des sauvegardes les laissent identiques
  octet pour octet.

Rien n'est bloqué.

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

L'architecture a été suivie telle quelle. Seul ajout en cours de route :
une petite clé `echos_breches_test_jours` pour les jours simulés du mode
test (brique 7), pour qu'ils survivent à un rechargement de la page.

---

## Ce qui a été construit, brique par brique

**Brique 2 : données.** `js/config.js` gagne la section « LES BRECHES
PERMANENTES » : interrupteur, cycle (3 + 3 + 1 = 7 jours), multiplicateurs,
plafond de 3, une arène sur 4, clés et plafonds de sauvegarde, format du
classement. `js/saisons.js` : novembre 2026 (« Saison des Gardiens ») et
décembre 2026 (« Saison des Machines »), un trio de boss par famille de lieu,
avec les espèces existantes. `validerSaisons()` contrôle les données.

**Brique 3 : règles pures** (`js/breches.js`, sections 1 à 5).
- `jourCalendaire(instant, decalageMinutes)` : le jour local. Le décalage
  est celui de `getTimezoneOffset()` **pour cet instant**, lu par
  l'appelant : le changement d'heure est exact.
- Les crans : 0-1-2 = boss A, 3-4-5 = boss B, 6 = final. Force :
  1 / 1,15 / 1,3 | 1,4 / 1,61 / 1,82 | 2.
- `cranDuJour` : un cran perdu par jour manqué, plancher au jour 1.
- `statutBreche` : `disponible`, `active`, `eteinte` (gagnée aujourd'hui,
  revient demain), `possedee`, `plafond`.
- `gagnerBreche` : une victoire par jour, entrée de journal et trophée.

**Brique 4 : saison.** `basculerSaison` (brèches et compteur à zéro ;
journal, trophées et bilans gardés ; trophée de saison si au moins une
brèche possédée), `compterPossedees`, `bilanClassement`, `inscrireVictoire`.

**Brique 5 : sauvegarde.** `chargerBreches` / `sauverBreches`, clé
`echos_breches_v1`. Format : `{ version, saison, breches, journal,
trophees, saisons_passees }`.

**Brique 6 : branchement** (`js/brechesjeu.js`, `window.BrechesJeu`).
Sur la carte, un anneau autour de chaque arène qui porte une brèche :
- **violet** : ouverte (plus épais quand elle est déjà commencée) ;
- **gris pointillé** : refermée jusqu'à demain ;
- **gris en petits points** : hors d'atteinte (3 brèches déjà ouvertes) ;
- **doré, plein, qui respire** : possédée (l'effet de possession).
L'infobulle de l'arène gagne une ligne. Près d'une brèche ouverte, le
bandeau annonce le boss (« Brèche · jour 2/7 · force ×1.15 ») et
« Approcher » lance son combat dans Ecran3, seul, avec sa force. La
victoire (ou l'assimilation du boss) s'inscrit dans le journal, avec un
trophée.

**Brique 7 : mode test.** Bouton « Brèches : Oui/Non », puis : Terrain
(arène normale ou brèche d'essai 1 à 4), +1 jour, +3 jours, Finir la
semaine, Mois suivant, État, Réinitialiser.

---

## Questions de design en attente

J'ai appliqué une valeur prudente à chaque fois ; tout est réglable dans
`js/config.js` ou `js/saisons.js` sauf mention contraire.

1. **Quelles arènes portent une brèche ?** Une sur 4, tirée de façon
   déterministe à partir de l'id de l'arène et du mois : les mêmes pour
   tous, différentes chaque mois (`BRECHES_UNE_ARENE_SUR`). Un joueur qui a
   peu d'arènes autour de lui peut n'en avoir aucune : faut-il un minimum ?
2. **Niveau du boss** : celui de l'arène (niveau + Figement). Seuls ses PV
   et son ATQ sont multipliés (×1 à ×2). Avec une équipe de niveau 30
   contre une arène de niveau 3, le boss reste facile. Faut-il caler le
   niveau du boss sur l'équipe, ou ajouter des niveaux par rôle ?
3. **Valeurs des multiplicateurs** : `BRECHES_MULT_CRAN = [1, 1.15, 1.3]`,
   `BRECHES_MULT_ROLE = { a: 1, b: 1.4, final: 2 }`. À équilibrer en jouant.
4. **Peut-on assimiler un boss ?** Oui aujourd'hui (le boss final aussi),
   et l'assimilation compte comme la victoire du jour. Faut-il rendre
   certains boss inassimilables (rang `X`) ?
5. **Récompenses** : le butin et l'XP sont ceux d'un combat ordinaire ;
   le trophée n'est que de la donnée. Une récompense propre aux brèches
   (fragments, glyphe, titre) ?
6. **Textes narratifs** (`breche.*` dans `js/langues.js`, français et
   anglais) : provisoires, à réécrire.
7. **Noms des saisons** : ils vivent dans `js/saisons.js` (`nom.fr`,
   `nom.en`) et non dans `js/langues.js`, pour qu'ajouter une saison ne
   touche aucun autre fichier. Ils ne sont encore affichés nulle part.
8. **Mois sans saison écrite** : le jeu reprend les saisons existantes à
   tour de rôle. Alternative : pas de brèche ce mois-là.
9. **Le plafond de 3** compte les brèches commencées, non possédées, dont
   le cran du jour est au-dessus de 0. Une brèche retombée au jour 1 par
   absence libère donc sa place.
10. **Horloge qui recule** : la brèche reste refermée (pas de seconde
    victoire) et un mois déjà passé ne revient jamais (pas de rebascule).
11. **Combat à cheval sur minuit** : il compte pour le jour où il a
    commencé. S'il est à cheval sur la fin du mois, la victoire est perdue
    (la saison a basculé entre-temps). Cas rare, à confirmer.
12. **Trophée de saison** : seulement si au moins une brèche a été
    possédée dans le mois.
13. **Écran** : le combat d'une brèche s'ouvre toujours dans l'écran à
    plusieurs (Ecran3), même quand `COMBAT_MULTI_ACTIF` est à `false` :
    l'ancien écran ne sait pas appliquer un multiplicateur sans modifier
    `js/combat.js`.
14. **Brèche sur une arène déjà assimilée** : la brèche s'ouvre quand
    même (elle est indépendante de l'arène), et battre son boss ne touche
    pas à l'arène.
15. **Une brèche possédée** : rien d'autre ne se passe, l'arène continue
    de fonctionner normalement ; seul l'anneau doré le montre.
16. **Journal et trophées** : plafonnés à 1000 entrées chacun (les plus
    récentes gardées), soit près de trois ans à une victoire par jour.
17. **« Finir la semaine »** : interprété comme « gagner chaque jour
    jusqu'au matin du jour 7 », pour laisser le boss final à jouer à la
    main. Si tu voulais plutôt « sauter au jour 7 sans victoires », dis-le.
18. **En mode test, les vraies arènes** portent leurs anneaux mais ne se
    combattent pas : le bandeau du mode test montre toujours le terrain
    d'essai (comportement existant). On teste donc les brèches sur les
    brèches d'essai.

---

## Vérification manuelle sur iPhone

**Avant tout** : la branche doit être servie. GitHub Pages sert
probablement `main` ; il faut donc soit faire pointer Pages sur
`breches-permanentes` le temps du test, soit fusionner. Je n'ai touché ni
à `main` ni aux réglages de Pages. Le mode test est actif partout
(`MODE_TEST = true`, `MODE_TEST_LOCAL_SEULEMENT = false`).

**Brique 2 (données)** : rien à voir dans le jeu. `node verifier.js`,
section 7, bloc « reglages et saisons ».

**Brique 3, 4, 5 (règles, saison, sauvegarde)** : invisibles seules ; elles
se vérifient par les étapes ci-dessous et par `node verifier.js`.

**Le jeu normal n'a pas changé** (à faire en premier) :
1. Ouvre le jeu, touche Commencer. Panneau du mode test : laisse
   « Brèches : Non ».
2. La carte n'a aucun anneau ; le terrain d'essai et le combat se
   comportent comme avant ; aucune ligne « Brèche » nulle part.

**Brique 6 et 7 : une semaine entière en quelques minutes**
1. Panneau du mode test : « Brèches : Oui ». Les outils apparaissent
   dessous.
2. Terrain : « Brèche d'essai 1 ». Le bandeau annonce
   « Brèche · jour 1/7 · force ×1 », avec le boss A de la famille de
   l'espèce choisie dans « Espèce » (Sun Wukong = temple → Chi Guo en
   novembre).
3. « Approcher » : l'écran à plusieurs s'ouvre, **un seul** adversaire,
   avec la ligne « Une brèche s'ouvre : jour 1 sur 7… ». Gagne.
   Le journal finit par « La brèche se referme… » et « Un trophée… ».
4. Sors : le bandeau redevient le terrain d'essai ordinaire, avec
   « La brèche d'ici s'est refermée. Elle revient demain. »
5. « État » : on voit `test/breche/1 · eteinte`, journal 1, trophées 1.
6. « +1 jour » : le boss revient, « jour 2/7 · force ×1.15 ». Ses PV
   sont plus hauts qu'hier.
7. « +3 jours » : trois jours manqués, trois crans perdus : retour au
   « jour 1/7 ».
8. « Finir la semaine » : l'état passe au jour 7 ; le bandeau annonce
   « jour 7/7 · force ×2 » avec le boss final (Komainu en novembre).
9. Combat : la ligne « Septième jour… » ; gagne. Message « La brèche est
   à toi… ». « État » : `possedee`, Possédées : 1.
10. « Mois suivant » : « État » montre `saison 2026-12`, plus aucune
    brèche, « saisons passées : 1 » et un trophée de plus (le trophée de
    saison). Le boss A est maintenant celui de décembre (Palantir pour un
    temple). Ton Grimoire n'a rien perdu.
11. Le plafond (après la bascule, pour partir de zéro) : Terrain
    « Brèche d'essai 1 », gagne un combat ; pareil pour 2 puis 3, le même
    jour (une victoire par jour **et par brèche**). Puis Terrain « Brèche
    d'essai 4 » : le bandeau dit « … 3 brèches sont déjà ouvertes », et
    « Approcher » lance le combat ordinaire du terrain, pas un boss.
    (Une brèche possédée ne compte pas dans les 3 : c'est pour ça qu'on
    attend la bascule.)
12. Recharge la page, repasse « Brèches : Oui » : les jours simulés et
    l'état sont toujours là.
13. « Réinitialiser » : tout revient au vrai jour, aucune brèche.

**Les anneaux sur la carte** (vraies arènes ; à voir dehors ou là où la
carte a déjà chargé des lieux) : avec « Brèches : Oui », environ une arène
sur quatre porte un anneau violet ; touche-la : l'infobulle dit
« Brèche ouverte · jour 1/7 ». En mode test, on ne peut pas les combattre
(question 18). Pour les voir en vrai combat, il faudrait allumer
`BRECHES_PERMANENTES_ACTIF` et éteindre le mode test : à ne faire qu'après
validation, car c'est alors la vraie clé `echos_breches_v1` qui s'écrit.

**La vraie partie n'est jamais touchée par ces essais** : tout s'écrit
sous `echos_breches_test_v1` et `echos_breches_test_jours`, et les combats
d'essai n'écrivent rien dans `echos_joueur_v5`.
