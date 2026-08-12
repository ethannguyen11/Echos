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
var CLE_JOUEUR  = "echos_joueur_v2";

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
