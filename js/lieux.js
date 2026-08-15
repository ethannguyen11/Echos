/* ============================================================
   LES LIEUX
   Interrogation d'OpenStreetMap, classement des lieux en
   categories, nommage, et generation deterministe des donjons.
   ============================================================ */

var CATEGORIES = {
  monument: { prefixe: "Seuil de" },
  parc:     { prefixe: "Clairière du parc" },
  metro:    { prefixe: "Tunnel d'entrée de" },
  temple:   { prefixe: "Porte du Temple de" }
};

// Les donjons connus, ranges par identifiant OSM
var donjons = {};


/* ------------------------------------------------------------
   TYPE DE LIEU ET NOM
   ------------------------------------------------------------ */

function categorieDuLieu(tags) {
  if (tags.amenity === "place_of_worship") return "temple";
  if (tags.leisure === "park") return "parc";
  if (tags.station === "subway") return "metro";
  if (tags.railway === "station" && tags.subway === "yes") return "metro";
  if (tags.historic) return "monument";
  if (tags.man_made === "tower") return "monument";
  if (tags.tourism === "attraction") return "monument";
  return null;
}

var MOTS_A_RETIRER = [
  "MRT Station", "Metro Station", "Subway Station", "Station",
  "Temple", "Shrine", "Park", "Garden", "Memorial Hall", "Observatory"
];

function nettoyerNom(nom) {
  var propre = nom;
  for (var i = 0; i < MOTS_A_RETIRER.length; i++) {
    var mot = MOTS_A_RETIRER[i];
    propre = propre.replace(new RegExp("\\s+" + mot + "$", "i"), "");
    propre = propre.replace(new RegExp("^" + mot + "\\s+", "i"), "");
  }
  propre = propre.trim();
  return propre.length > 0 ? propre : nom;
}


/* ------------------------------------------------------------
   GENERATION DETERMINISTE
   ------------------------------------------------------------ */

function grainePourTexte(t) {
  var h = 2166136261;
  for (var i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function tirageAleatoire(graine) {
  var e = graine;
  return function () {
    e = (e + 0x6D2B79F5) | 0;
    var t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nomDuLieu(tags) {
  return tags["name:fr"] || tags["name:en"] || tags.name || "";
}

function donjonDepuisLieu(element) {
  var tags = element.tags || {};

  var cat = categorieDuLieu(tags);
  if (!cat) return null;

  var brut = nomDuLieu(tags);
  if (!brut) return null;

  var lat = element.lat || (element.center && element.center.lat);
  var lon = element.lon || (element.center && element.center.lon);
  if (!lat || !lon) return null;

  var id = element.type + "/" + element.id;
  var a = tirageAleatoire(grainePourTexte(id));
  var liste = ESPECES_PAR_LIEU[cat];

  return {
    id: id,
    lat: lat, lon: lon,
    lieu: brut,
    categorie: cat,
    nom: CATEGORIES[cat].prefixe + " " + nettoyerNom(brut),
    espece: liste[Math.floor(a() * liste.length)],
    niveau: 1 + Math.floor(a() * 8),
    capture: false,     // assimile avec succes
    dissipe: false      // vaincu sans etre capture
  };
}


/* ------------------------------------------------------------
   OPENSTREETMAP
   ------------------------------------------------------------ */

function requeteOverpass(lat, lon) {
  var autour = "(around:" + RAYON_RECHERCHE + "," + lat + "," + lon + ")";

  var filtres = [
    '["amenity"="place_of_worship"]',
    '["leisure"="park"]',
    '["station"="subway"]',
    '["railway"="station"]["subway"="yes"]',
    '["historic"]',
    '["man_made"="tower"]',
    '["tourism"="attraction"]'
  ];

  var corps = "";
  for (var i = 0; i < filtres.length; i++) {
    corps += "nwr" + filtres[i] + autour + ";";
  }

  return "[out:json][timeout:25];(" + corps + ");out center 80;";
}

function estUnDoublon(nouveau) {
  for (var id in donjons) {
    var d = donjons[id];
    if (d.categorie !== nouveau.categorie) continue;
    if (distanceMetres(d.lat, d.lon, nouveau.lat, nouveau.lon) < DISTANCE_DOUBLON) return true;
  }
  return false;
}

var chargementEnCours = false;

function chargerDonjons(lat, lon, indexServeur) {
  if (indexServeur === undefined) indexServeur = 0;

  // Tous les miroirs ont echoue : on retentera plus tard
  if (indexServeur >= SERVEURS_OVERPASS.length) {
    chargementEnCours = false;
    dernierePosRequete = null;         // autorise une nouvelle tentative
    etat("Serveurs OSM saturés. Nouvel essai dans 20 s...");

    setTimeout(function () {
      if (dernierePosition && !chargementEnCours) {
        chargerDonjons(dernierePosition[0], dernierePosition[1], 0);
      }
    }, DELAI_NOUVEL_ESSAI);
    return;
  }

  chargementEnCours = true;

  etat(indexServeur === 0 ?
       "Consultation des lieux alentour..." :
       "Serveur occupé, essai " + (indexServeur + 1) + "/" + SERVEURS_OVERPASS.length + "...");

  fetch(SERVEURS_OVERPASS[indexServeur], {
    method: "POST",
    body: requeteOverpass(lat, lon)
  })
    .then(function (r) {
      if (!r.ok) throw new Error("statut " + r.status);
      return r.json();
    })
    .then(function (donnees) {
      chargementEnCours = false;
      dernierePosRequete = [lat, lon];   // succes : on note la position

      var nouveaux = 0;

      for (var i = 0; i < donnees.elements.length; i++) {
        var d = donjonDepuisLieu(donnees.elements[i]);
        if (!d) continue;
        if (donjons[d.id]) continue;
        if (estUnDoublon(d)) continue;

        donjons[d.id] = d;
        poserMarqueur(d);
        nouveaux++;
      }

      sauvegarder();
      etat(nouveaux + " nouveau(x) lieu(x) éveillé(s)");

      if (dernierePosition) mettreAJourHud(dernierePosition[0], dernierePosition[1]);
    })
    .catch(function () {
      // Ce miroir n'a pas repondu : on passe au suivant
      chargerDonjons(lat, lon, indexServeur + 1);
    });
}


/* ------------------------------------------------------------
   SAUVEGARDE DES DONJONS
   ------------------------------------------------------------ */

function sauvegarder() {
  try { localStorage.setItem(CLE_DONJONS, JSON.stringify(donjons)); } catch (e) {}
}

function charger() {
  try {
    var brut = localStorage.getItem(CLE_DONJONS);
    if (!brut) return;
    donjons = JSON.parse(brut);
    for (var id in donjons) poserMarqueur(donjons[id]);
  } catch (e) { donjons = {}; }
}
