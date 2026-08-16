/* ============================================================
   REGLAGES
   Toutes les valeurs que l'on peut ajuster sans toucher au reste.
   ============================================================ */

var RAYON_RECHERCHE    = 700;
var DISTANCE_ENTREE    = 40;   // metres pour declencher la rencontre
var DISTANCE_PREEMPTIF = 15;   // en dessous : tour d'ouverture gratuit
var DISTANCE_RELANCE   = 350;
var DISTANCE_DOUBLON   = 80;
var EQUIPE_MAX         = 3;

var CLE_DONJONS = "echos_donjons_v5";

// La sauvegarde du joueur passe en v3 : elle contient desormais
// un bloc "joueur" (nom, genre, voie, lieu zero, intro vue).
// L'ancienne cle n'est plus ecrite, seulement relue une fois
// pour recuperer la collection et l'equipe.
var CLE_JOUEUR          = "echos_joueur_v3";
var CLE_JOUEUR_ANCIENNE = "echos_joueur_v2";
var VERSION_JOUEUR      = 3;

// Overpass est gratuit et sature souvent. On essaie les miroirs
// l'un apres l'autre ; le japonais est le plus proche de Taipei.
var SERVEURS_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter"
];

var DELAI_NOUVEL_ESSAI = 20000;   // 20 s avant de retenter apres un echec total
var DOSSIER_MONSTRES = "monstres/";


/* ============================================================
   LE MODE TEST
   Un donjon fictif a ta position, et un panneau pour regler le
   palier de Figement, le niveau et l'espece de l'adversaire.
   Sert a essayer un combat sans sortir de chez soi.

   A false, il ne se passe RIEN : aucun panneau, aucun donjon
   fictif, pas une ligne executee. Tout tient dans js/modetest.js,
   qui peut etre supprime sans rien casser.

   Un combat d'essai n'ecrit jamais dans localStorage : ni le
   donjon fictif, ni l'Echo capture, ni l'experience gagnee.
   ============================================================ */

var MODE_TEST = true;

/* Deuxieme securite : meme a true, le mode test reste muet des que
   la page est servie ailleurs qu'en local (GitHub Pages, par
   exemple). Un MODE_TEST oublie a true dans un commit ne se voit
   donc pas sur le site publie.
   Pour essayer le mode test depuis ton telephone via GitHub Pages,
   passe cette constante a false. */
var MODE_TEST_LOCAL_SEULEMENT = false;

// Une couleur par famille de lieu : marqueurs de la carte et pastilles
// du grimoire piochent ici.
var COULEURS = {
  monument: "#b455d4",
  parc:     "#4ca85f",
  metro:    "#d49a2a",
  temple:   "#d4554a"
};


/* ============================================================
   LE FIGEMENT
   Un lieu trop regarde et pas assez compris se fige : ses
   creatures se recouvrent de metal. Pendant un combat, l'arene
   se mecanise tour apres tour, et ca change qui est fort.

   Toutes les valeurs du systeme sont ici, aucune dans combat.js :
   on regle l'equilibrage sans toucher a la logique.
   ============================================================ */

/* --- L'echelle ---
   Le Figement est un nombre de 0 a 100. On ne s'en sert jamais
   directement : on le convertit en palier de 0 a 10, et c'est le
   palier qui pilote les multiplicateurs. */
var FIGEMENT_MAX          = 100;   // valeur maximale du compteur
var FIGEMENT_PAR_PALIER   = 10;    // points de compteur dans un palier
var FIGEMENT_PALIER_MAX   = 10;    // palier maximal

/* Paliers gagnes a la fin de chaque tour.

   A ZERO, LE FIGEMENT EST EN SOMMEIL : le compteur ne bouge plus,
   tous les multiplicateurs valent 1.00, et la mecanique disparait
   de l'ecran de combat. Aucun code n'a ete supprime pour autant :
   il suffit de remettre les deux constantes ci-dessous a leur
   valeur d'origine (1 et true) pour retrouver le combat d'avant,
   a l'identique. verifier/tests.js verifie les deux etats.

   Le Figement continue de servir hors combat : c'est lui qui donne
   la difficulte d'un lieu, affichee avant d'y entrer.

   POINT D'ACCROCHE : le futur systeme de Clarte (issu du quiz)
   viendra reduire cette vitesse. Rien ne le fait aujourd'hui. */
var VITESSE_FIGEMENT      = 0;   // 1 = mecanique active
var AFFICHER_BARRE_FIGEMENT = false;   // true = barre et fleches en combat

/* Multiplicateur de degats de l'ATTAQUANT, selon sa nature.
   multiplicateur = base + pas x palier
     organique  1.25 -> 1.00 -> 0.75   (fort tot, s'essouffle)
     mecanique  0.75 -> 1.00 -> 1.25   (faible tot, monte en puissance)
     hybride    1.00 partout           (ni puni ni recompense) */
var FIGEMENT_NATURES = {
  organique: { base: 1.25, pas: -0.05 },
  mecanique: { base: 0.75, pas:  0.05 },
  hybride:   { base: 1.00, pas:  0.00 }
};

/* A partir de quand le joueur lit le chiffre exact du Figement.
   L'unite est un NOMBRE D'ESPECES DISTINCTES assimilees, pas un
   niveau d'Echo : ce qui apprend a lire un lieu, c'est d'en avoir
   compris beaucoup de differents. Voir experienceDuGardien()
   dans js/joueur.js. En dessous du seuil, le joueur ne lit qu'une
   impression, jamais un nombre.
   Il y a 16 especes en tout : 8 represente la moitie du bestiaire. */
var SEUIL_LECTURE_FIGEMENT = 8;

/* Ce que le joueur lit tant qu'il est sous le seuil : une phrase
   par tranche de paliers, de la plus vivante a la plus morte. */
var LIBELLES_FIGEMENT = [
  { jusqua: 3,  texte: "Lieu presque vivant" },
  { jusqua: 7,  texte: "Quelque chose s'est éteint ici" },
  { jusqua: 10, texte: "Plus rien ne respire" }
];


/* --- LE FIGEMENT COMME DIFFICULTE DU LIEU ---

   Le Figement ne pese plus sur le combat, mais il decide de ce que
   le lieu contient. Trois effets, et trois seulement.

   Il agit meme quand la mecanique de combat est en sommeil : c'est
   une propriete du lieu, pas une regle de bataille.

   Ce qu'il ne touche JAMAIS : le niveau auquel l'Echo est capture.
   Un debutant qui l'emporte dans un lieu tres fige repart avec une
   espece rare, pas avec un Echo surpuissant. Voir capture(). */

// a) Les adversaires rencontres sont plus forts : +0 a +5 niveaux
var FIGEMENT_PALIERS_PAR_NIVEAU = 2;    // 2 paliers = +1 niveau

// b) L'experience gagnee monte : x1.00 a x1.50
var FIGEMENT_BONUS_XP_PAR_PALIER = 0.05;

/* c) Les rangs d'especes qui peuvent habiter le lieu.
      Un lieu vivant n'abrite que du commun ; un lieu mort garde
      ce qu'il y a de plus rare. */
var FIGEMENT_RANGS_PAR_PALIER = [
  { jusqua: 2,  rangs: ["D", "C"] },
  { jusqua: 5,  rangs: ["D", "C", "B"] },
  { jusqua: 8,  rangs: ["C", "B", "A"] },
  { jusqua: 10, rangs: ["B", "A", "S"] }
];

/* L'echelle des rangs, du plus commun au plus rare. Une bande de
   FIGEMENT_RANGS_PAR_PALIER est toujours une tranche continue de
   cette echelle : c'est ce qui permet de l'elargir d'un cran. */
var ECHELLE_RANGS = ["D", "C", "B", "A", "S"];

/* Le rang est une TENDANCE, pas un mur.

   Avec 4 especes par categorie et 4 bandes de rangs, certaines
   cases ne laissaient qu'une seule espece possible : tous les
   monuments peu figes donnaient Vinci, tous les parcs tres figes
   donnaient Peng. En dessous de ce minimum, la bande s'elargit
   d'un cran vers le bas, puis vers le haut, jusqu'a offrir de quoi
   varier. Voir especesDisponibles() dans lieux.js, et
   Lieux.testerFiltreRang() pour verifier chaque case. */
var RANGS_MINIMUM_ESPECES = 3;


/* ============================================================
   LES AFFINITES
   Un triangle, comme pierre-feuille-ciseaux :
     matiere bat recit, recit bat oubli, oubli bat matiere.
   ============================================================ */

var AFFINITE_BAT = {
  matiere: "recit",
  recit:   "oubli",
  oubli:   "matiere"
};

var AFFINITE_AVANTAGE    = 1.3;
var AFFINITE_NEUTRE      = 1.0;
var AFFINITE_DESAVANTAGE = 0.75;

// Matiere = ocre / gris pierre, Recit = or terni / pourpre,
// Oubli = vert-de-gris / bleu delave.
var COULEURS_AFFINITE = {
  matiere: "#b08d5a",
  recit:   "#c9a227",
  oubli:   "#7fa6a0"
};

var LIBELLES_AFFINITE = { matiere: "Matière", recit: "Récit", oubli: "Oubli" };
var LIBELLES_NATURE   = { organique: "organique", mecanique: "mécanique", hybride: "hybride" };


/* ============================================================
   LES APTITUDES
   Huit archetypes reutilisables, pas 48 aptitudes uniques.
   Chaque espece en reference trois dans especes.js.

   Pas de points de magie : chaque aptitude a un temps de
   recharge, et c'est tout. Un systeme de moins a comprendre.
   ============================================================ */

var APTITUDE_RECHARGE = 3;              // tours avant de pouvoir la relancer
var APTITUDE_NIVEAUX  = [5, 10, 15];    // niveaux de deblocage des trois aptitudes

/* Chaque archetype porte ses propres nombres : c'est ici qu'on
   equilibre, jamais dans combat.js.
     multi          multiplie les degats
     coups          nombre de frappes
     ignoreDef      la defense de la cible ne compte pas
     soin           part des PV max rendue a l'Echo
     garde          les degats subis sont multiplies par ca
     affaiblit      l'ATQ de la cible est multipliee par ca
     tours          duree d'un effet qui dure
     immobilise     tours pendant lesquels l'Echo ne peut plus agir
     multiAvantage  multiplicateur quand l'affinite est favorable
     bonusAssimilation  points ajoutes au taux, jusqu'a la fin */
var APTITUDES = {
  frappeLourde: {
    nom: "Frappe lourde", multi: 1.6, immobilise: 1,
    texte: "Dégâts ×1.6, mais l'Écho ne peut pas agir au tour suivant."
  },
  doubleFrappe: {
    nom: "Double frappe", multi: 0.6, coups: 2,
    texte: "Deux attaques à ×0.6 chacune."
  },
  fissure: {
    nom: "Fissure", multi: 1, ignoreDef: true,
    texte: "Ignore complètement la défense de la cible."
  },
  seve: {
    nom: "Sève", soin: 0.25,
    texte: "Rend 25 % des PV maximum de l'Écho."
  },
  rempart: {
    nom: "Rempart", garde: 0.4, tours: 2,
    texte: "Dégâts subis ×0.4 pendant 2 tours."
  },
  sceau: {
    nom: "Sceau", affaiblit: 0.75, tours: 2,
    texte: "ATQ de la cible ×0.75 pendant 2 tours."
  },
  percee: {
    nom: "Percée", multi: 1, multiAvantage: 1.3,
    texte: "Dégâts ×1.3 si avantage d'affinité, ×1.0 sinon."
  },
  appel: {
    nom: "Appel", bonusAssimilation: 20,
    texte: "+20 au taux d'Assimilation jusqu'à la fin du combat."
  }
};


/* ============================================================
   DEFENDRE
   ============================================================ */

var DEFENDRE_REDUCTION          = 0.5;  // degats subis ce tour
var DEFENDRE_BONUS_ASSIMILATION = 10;   // points gagnes au tour suivant


/* ============================================================
   ASSIMILER
   Le taux est visible sur le bouton avant confirmation : le
   joueur voit ses chances monter et choisit son moment.

     taux = socle
          + PV manquants de la cible (en %) x poids
          + (niveau du meilleur Echo debout - niveau cible) x poids
          + bonus d'Appel et de Defense
          - malus de rang de la cible
   ============================================================ */

var ASSIMILATION_SOCLE        = 30;
var ASSIMILATION_POIDS_PV     = 0.4;   // 100 % de PV manquants -> +40
var ASSIMILATION_POIDS_NIVEAU = 3;     // par niveau d'ecart
var ASSIMILATION_ECART_MAX    = 20;    // l'ecart de niveau est borne a +/- 20

// Jamais 0, jamais 100 : il reste toujours un espoir et toujours un risque.
var ASSIMILATION_MIN = 5;
var ASSIMILATION_MAX = 95;

/* Le rang dit a quel point un Echo se laisse convaincre.
   X n'est porte par aucune espece : il est reserve aux futurs
   Gardiens de donjon, qui se poseront sur le LIEU et pas sur
   l'espece. POINT D'ACCROCHE, rien ne le pose aujourd'hui. */
var ASSIMILATION_MALUS_RANG = { D: 0, C: 5, B: 10, A: 15, S: 25 };
var RANG_INASSIMILABLE = "X";


/* ============================================================
   OUTILS COMMUNS
   Trois raccourcis dont tous les fichiers se servent.
   ============================================================ */

function distanceMetres(lat1, lon1, lat2, lon2) {
  var R = 6371000, p = Math.PI / 180;
  var dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * p) * Math.cos(lat2 * p) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function elem(id) { return document.getElementById(id); }
function etat(m) { elem("etat").textContent = m; }
