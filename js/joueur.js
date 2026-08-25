/* ============================================================
   LE JOUEUR : sa collection et son equipe
   ============================================================ */

var collection = {};   // { komainu: { espece, niveau, xp, pv } }
var equipe = [];       // jusqu'a 3 identifiants d'espece

// Ce que la cinematique d'ouverture a appris du joueur.
// Attention : la variable ne s'appelle pas "joueur", ce nom est
// deja pris par le rond bleu de la carte (js/carte.js). Dans la
// sauvegarde, en revanche, le bloc s'appelle bien "joueur".
var profil = profilParDefaut();

/* Ce qu'Ico a deja dit et ce qu'il a deja retrouve.

   Attention au nom, comme pour profil / joueur plus haut : la
   VARIABLE s'appelle suiviIco, le BLOC de sauvegarde s'appelle
   "ico", et le namespace du guide s'appelle Ico avec une
   majuscule (js/ico.js). Trois choses differentes ; melanger les
   deux dernieres serait facile et penible a debusquer. */
var suiviIco = icoParDefaut();

function profilParDefaut() {
  return {
    nom: "",
    genre: "",          // m | f | n
    voie: "",           // archiviste | arpenteur | gardien
    lieuZero: null,     // { nom, lat, lon }
    introVue: false
  };
}

function icoParDefaut() {
  return {
    didacticiensVus: [],   // identifiants des interventions deja jouees
    palierLu: 0,           // dernier fragment d'identite consulte
    palierAtteint: 0       // dernier palier franchi, pour la pastille
  };
}

function nouvelEcho(especeId, niveau) {
  var s = statsAuNiveau(especeId, niveau);
  return { espece: especeId, niveau: niveau, xp: 0, pv: s.pvMax };
}

function ajouterAlaCollection(especeId, niveau) {
  var existant = collection[especeId];

  if (!existant) {
    collection[especeId] = nouvelEcho(especeId, niveau);
    if (equipe.length < EQUIPE_MAX) equipe.push(especeId);
    return "nouveau";
  }

  if (niveau > existant.niveau) {
    existant.niveau = niveau;
    existant.pv = statsAuNiveau(especeId, niveau).pvMax;
    return "renforce";
  }

  return "connu";
}

/* L'experience du gardien : le nombre d'especes DISTINCTES qu'il a
   assimilees, pas le niveau de son meilleur Echo. Ce qui compte
   n'est pas d'avoir pousse une creature loin, c'est d'avoir compris
   beaucoup de choses differentes.

   La collection est indexee par espece : une espece = une entree,
   les doublons n'y sont jamais ajoutes (voir ajouterAlaCollection).
   Il suffit donc de compter les entrees.

   C'est cette valeur qui decide de ce que le joueur sait lire du
   Figement en combat. */
function experienceDuGardien() {
  return Object.keys(collection).length;
}

function xpRequis(niveau) { return 12 + niveau * 14; }

function gagnerXp(especeId, gain) {
  var e = collection[especeId];
  if (!e) return null;

  e.xp += gain;
  var montees = 0;

  while (e.xp >= xpRequis(e.niveau) && e.niveau < 50) {
    e.xp -= xpRequis(e.niveau);
    e.niveau++;
    montees++;
    e.pv = statsAuNiveau(especeId, e.niveau).pvMax;   // soin a la montee
  }

  return montees;
}


/* ------------------------------------------------------------
   SAUVEGARDE DU JOUEUR
   ------------------------------------------------------------ */

function sauverJoueur() {
  try {
    localStorage.setItem(CLE_JOUEUR, JSON.stringify({
      version: VERSION_JOUEUR,
      collection: collection,
      equipe: equipe,
      joueur: profil,
      ico: suiviIco
    }));
  } catch (e) {}
}

/* --- Migration : on ne suppose jamais qu'un champ existe ---
   Une sauvegarde peut venir d'une version anterieure, avoir ete
   modifiee a la main, ou contenir une espece qui n'existe plus.
   Chaque valeur est donc verifiee avant d'etre reprise. */

function normaliserCollection(brut) {
  var propre = {};
  if (!brut || typeof brut !== "object") return propre;

  for (var id in brut) {
    var e = brut[id];
    if (!e || typeof e !== "object") continue;

    var espece = typeof e.espece === "string" ? e.espece : id;
    if (!ESPECES[espece]) continue;                 // espece disparue : on l'ecarte

    var niveau = Math.round(Number(e.niveau));
    if (!(niveau >= 1)) niveau = 1;
    if (niveau > 50) niveau = 50;

    var xp = Math.round(Number(e.xp));
    if (!(xp >= 0)) xp = 0;

    var pv = Math.round(Number(e.pv));
    var pvMax = statsAuNiveau(espece, niveau).pvMax;
    if (!(pv >= 0) || pv > pvMax) pv = pvMax;

    propre[espece] = { espece: espece, niveau: niveau, xp: xp, pv: pv };
  }

  return propre;
}

function normaliserEquipe(brut, collectionPropre) {
  var propre = [];
  if (!brut || typeof brut.length !== "number") return propre;

  for (var i = 0; i < brut.length; i++) {
    var id = brut[i];
    if (typeof id !== "string") continue;
    if (!collectionPropre[id]) continue;            // plus dans la collection
    if (propre.indexOf(id) !== -1) continue;        // doublon
    if (propre.length >= EQUIPE_MAX) break;
    propre.push(id);
  }

  return propre;
}

function normaliserProfil(brut) {
  var p = profilParDefaut();
  if (!brut || typeof brut !== "object") return p;

  if (typeof brut.nom === "string") p.nom = brut.nom.slice(0, 16);
  if (brut.genre === "m" || brut.genre === "f" || brut.genre === "n") p.genre = brut.genre;
  if (brut.voie === "archiviste" || brut.voie === "arpenteur" || brut.voie === "gardien") {
    p.voie = brut.voie;
  }

  var l = brut.lieuZero;
  if (l && typeof l === "object" && typeof l.nom === "string" &&
      isFinite(l.lat) && isFinite(l.lon)) {
    p.lieuZero = { nom: l.nom, lat: Number(l.lat), lon: Number(l.lon) };
  }

  p.introVue = brut.introVue === true;
  return p;
}

/* Le bloc d'Ico. Une sauvegarde v3 n'en a pas : brut vaut alors
   undefined, et on rend les valeurs par defaut sans broncher.

   Comme pour la collection, on ne suppose jamais qu'un champ
   existe ni qu'il a le bon type. Un palier absurde (negatif, 900,
   "sept") ne doit pas pouvoir bloquer l'ecran d'Ico. */
function normaliserIco(brut) {
  var i = icoParDefaut();
  if (!brut || typeof brut !== "object") return i;

  var vus = brut.didacticiensVus;
  if (vus && typeof vus.length === "number") {
    for (var k = 0; k < vus.length; k++) {
      var id = vus[k];
      if (typeof id !== "string") continue;              // pas un identifiant
      if (i.didacticiensVus.indexOf(id) !== -1) continue; // doublon
      i.didacticiensVus.push(id);
    }
  }

  i.palierLu      = palierValide(brut.palierLu);
  i.palierAtteint = palierValide(brut.palierAtteint);

  return i;
}

function palierValide(valeur) {
  var p = Math.round(Number(valeur));
  if (!(p >= 0)) return 0;                    // absent, negatif, ou pas un nombre
  return Math.min(p, ICO_PALIER_MAX);
}

function chargerJoueur() {
  var d = null;

  try {
    var brut = localStorage.getItem(CLE_JOUEUR);

    /* Rien en v4 : on descend les cles anciennes, de la plus
       recente a la plus vieille, et on prend la premiere qui
       repond. Une v3 n'a pas de bloc "ico" : il sera cree avec ses
       valeurs par defaut. Une v2 n'a pas non plus de bloc
       "joueur", donc introVue reste faux et l'intro se rejouera :
       c'est le comportement voulu depuis la v3. */
    for (var i = 0; !brut && i < CLES_JOUEUR_ANCIENNES.length; i++) {
      brut = localStorage.getItem(CLES_JOUEUR_ANCIENNES[i]);
    }

    if (brut) d = JSON.parse(brut);
  } catch (e) { d = null; }

  if (d && typeof d === "object") {
    collection = normaliserCollection(d.collection);
    equipe     = normaliserEquipe(d.equipe, collection);
    profil     = normaliserProfil(d.joueur);
    suiviIco   = normaliserIco(d.ico);
  } else {
    collection = {};
    equipe     = [];
    profil     = profilParDefaut();
    suiviIco   = icoParDefaut();
  }

  // Premier lancement : Jin Chan te suit deja, au niveau 3.
  // En dessous, un Echo seul ne survit a aucune rencontre.
  if (Object.keys(collection).length === 0) {
    ajouterAlaCollection("jinchan", 3);
    sauverJoueur();
  }

  majFiche();
}

function majFiche() {
  /* Le seul endroit appele a chaque fois que la collection peut
     avoir change : chargerJoueur, basculerEquipe, finDeCombat.
     C'est donc ici qu'Ico verifie s'il vient de se rappeler
     quelque chose. Le garde protege l'ordre de chargement :
     joueur.js est lu avant ico.js. */
  if (typeof Ico !== "undefined") Ico.majPastille();

  var f = document.getElementById("fiche");

  if (equipe.length === 0) {
    f.textContent = "Équipe vide";
    return;
  }

  var noms = [];
  for (var i = 0; i < equipe.length; i++) {
    var e = collection[equipe[i]];
    noms.push(ESPECES[e.espece].nom + " " + e.niveau);
  }

  f.textContent = noms.join(" \u00b7 ");
}
