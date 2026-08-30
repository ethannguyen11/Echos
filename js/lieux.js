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

/* Les rangs d'especes qu'un palier de Figement autorise. */
function rangsAuPalier(palier) {
  for (var i = 0; i < FIGEMENT_RANGS_PAR_PALIER.length; i++) {
    if (palier <= FIGEMENT_RANGS_PAR_PALIER[i].jusqua) {
      return FIGEMENT_RANGS_PAR_PALIER[i].rangs;
    }
  }
  return FIGEMENT_RANGS_PAR_PALIER[FIGEMENT_RANGS_PAR_PALIER.length - 1].rangs;
}

/* ------------------------------------------------------------
   LES CHAPITRES

   Le chapitre atteint decide de ce qui peut habiter un lieu,
   AVANT que le Figement decide des rangs.

   Rien ne le fait encore progresser : il vaut CHAPITRE_DEPART,
   sauf quand le panneau du mode test le force. C'est le seul
   endroit a reprendre le jour ou la progression existera.
   ------------------------------------------------------------ */

function chapitreAtteint() {
  /* Le garde protege l'ordre de chargement : lieux.js est lu
     avant modetest.js. A l'execution, tout est en place. */
  if (typeof ModeTest !== "undefined" && ModeTest.actif()) {
    var force = ModeTest.chapitreForce();
    if (force >= 1) return Math.min(force, CHAPITRE_MAX);
  }

  return CHAPITRE_DEPART;
}

/* Les especes de cette categorie qu'un joueur au chapitre donne
   peut rencontrer.

   Si le chapitre ne laisse RIEN dans une categorie, on rend la
   liste entiere plutot qu'une liste vide : un lieu sans espece
   ferait un donjon sans adversaire, et le jeu casserait a
   l'entree. Un mauvais etiquetage doit se voir comme une espece
   inattendue, jamais comme un ecran noir. */
function especesDuChapitre(categorie, chapitre) {
  var toutes = ESPECES_PAR_LIEU[categorie] || [];

  var ouvertes = toutes.filter(function (id) {
    return ESPECES[id].chapitre <= chapitre;
  });

  return ouvertes.length ? ouvertes : toutes;
}


/* Les especes de cette categorie de lieu que le Figement laisse
   apparaitre.

   Le rang est une tendance, pas un mur. Une bande de rangs est une
   tranche continue de ECHELLE_RANGS : tant qu'elle ne laisse pas au
   moins RANGS_MINIMUM_ESPECES especes dans cette categorie, on
   l'elargit d'un cran vers le bas, puis vers le haut, et on
   recommence. Sans ca, un monument peu fige n'avait qu'une seule
   espece possible, et tous se ressemblaient.

   Le resultat ne depend que de la categorie, du palier et du
   chapitre : deux appareils au meme chapitre qui regardent le meme
   lieu obtiennent la meme liste, donc la meme espece. Le tirage
   reste deterministe.

   Le chapitre s'applique AVANT les rangs : on part du vivier
   ouvert, puis la bande s'elargit dedans. Un chapitre etroit rend
   donc peu d'especes, et c'est exactement ce qu'on lui demande --
   RANGS_MINIMUM_ESPECES ne peut pas inventer ce que le chapitre
   n'a pas encore ouvert. */
function especesDisponibles(categorie, palier, chapitre) {
  /* Le chapitre est un PARAMETRE et non une lecture directe de
     chapitreAtteint() : le jeu n'en passe jamais, et prend donc le
     chapitre courant ; verifier/tests.js en passe un, et peut ainsi
     verifier la logique des rangs sur le bestiaire entier sans
     dependre de la progression. */
  if (chapitre === undefined) chapitre = chapitreAtteint();

  var toutes = especesDuChapitre(categorie, chapitre);
  var bande = rangsAuPalier(palier);

  var bas = ECHELLE_RANGS.indexOf(bande[0]);
  var haut = ECHELLE_RANGS.indexOf(bande[bande.length - 1]);
  var dernier = ECHELLE_RANGS.length - 1;

  function retenues() {
    return toutes.filter(function (id) {
      var r = ECHELLE_RANGS.indexOf(ESPECES[id].rang);
      return r >= bas && r <= haut;
    });
  }

  var versLeBas = true;
  var liste = retenues();

  while (liste.length < RANGS_MINIMUM_ESPECES && (bas > 0 || haut < dernier)) {
    if (versLeBas && bas > 0) bas--;          // un cran vers le bas
    else if (haut < dernier) haut++;          // puis un cran vers le haut
    else bas--;                               // le haut est epuise

    versLeBas = !versLeBas;
    liste = retenues();
  }

  // Ceinture et bretelles : une categorie vide serait pire que tout.
  return liste.length ? liste : toutes;
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

  // Le Figement du lieu se LIT (meme graine, troisieme tirage), il ne
  // se recalcule pas ici. Il decide des rangs qui peuvent habiter le
  // lieu avant meme qu'on tire l'espece.
  var liste = especesDisponibles(cat, palierFigement(figementDuLieu({ id: id })));

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


/* ------------------------------------------------------------
   OUTIL DE CONSOLE
   Ouvre la console et tape :   Lieux.testerFiltreRang()

   Pour chaque categorie et chaque palier, la liste des especes
   finalement possibles. Aucune case ne doit tomber sous
   RANGS_MINIMUM_ESPECES : si c'est le cas, la ligne est marquee.
   ------------------------------------------------------------ */

function testerFiltreRang() {
  function colonne(t, largeur) {
    t = String(t);
    while (t.length < largeur) t += " ";
    return t;
  }

  var categories = Object.keys(ESPECES_PAR_LIEU);
  var sousLeMinimum = 0;

  console.log("FILTRE DE RANG — especes possibles par categorie et par palier");
  console.log("(minimum exige : " + RANGS_MINIMUM_ESPECES + " especes par case)");

  categories.forEach(function (cat) {
    console.log("");
    console.log("--- " + cat.toUpperCase() + " ---");
    console.log(colonne("palier", 8) + colonne("bande", 10) + colonne("nb", 4) + "especes possibles");

    for (var p = 0; p <= FIGEMENT_PALIER_MAX; p++) {
      var liste = especesDisponibles(cat, p);
      var noms = liste.map(function (id) {
        return ESPECES[id].nom + " (" + ESPECES[id].rang + ")";
      });

      var alerte = liste.length < RANGS_MINIMUM_ESPECES;
      if (alerte) sousLeMinimum++;

      console.log(colonne(p, 8) + colonne(rangsAuPalier(p).join(""), 10) +
                  colonne(liste.length, 4) + noms.join(", ") +
                  (alerte ? "   <-- SOUS LE MINIMUM" : ""));
    }
  });

  console.log("");
  console.log(sousLeMinimum === 0 ?
              "Aucune case sous le minimum." :
              sousLeMinimum + " case(s) sous le minimum.");
}

/* Le seul global que ce fichier expose. Le reste du jeu continue
   d'appeler les fonctions directement, rien n'a change pour lui. */
window.Lieux = {
  testerFiltreRang: testerFiltreRang,
  especesDisponibles: especesDisponibles,
  rangsAuPalier: rangsAuPalier
};
