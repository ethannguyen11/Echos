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
   POINT D'ACCROCHE : le futur systeme de Clarte (issu du quiz)
   viendra reduire cette vitesse. Rien ne le fait aujourd'hui. */
var VITESSE_FIGEMENT      = 1;

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
