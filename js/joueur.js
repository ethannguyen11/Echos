/* ============================================================
   LE JOUEUR : sa collection et son equipe
   ============================================================ */

var collection = {};   // { komainu: { espece, niveau, xp, pv, conscience, fragments } }
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

/* Les fragments des especes PAS ENCORE assimilees.

   Un Echo assimile garde les siens sur lui, dans
   collection[espece].fragments. La gourde n'est donc pas un
   inventaire general : c'est une salle d'attente, et elle se vide
   dans l'Echo le jour ou l'espece entre au Grimoire.

   { peng: { mince: 3, grand: 1, complet: 0 } } */
var gourde = {};

// Ce que le joueur a compris du monde. Les listes servent a
// compter des choses DISTINCTES : sans elles, on ne saurait pas
// qu'on est deja venu ici, ni qu'on a deja joue aujourd'hui.
var savoir = savoirParDefaut();

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

function savoirParDefaut() {
  return {
    combats: 0,   // combats menes, victoire ou non
    jours: [],    // journees distinctes, en "AAAA-MM-JJ"
    lieux: []     // identifiants de lieux distincts visites
  };
}

// Le sac de fragments d'une espece, vide. Une seule forme dans
// tout le jeu : celle-ci. Elle sert a l'Echo comme a la gourde.
function fragmentsVides() {
  var sac = {};
  FRAGMENT_TAILLES.forEach(function (t) { sac[t] = 0; });
  return sac;
}

function nouvelEcho(especeId, niveau) {
  var s = statsAuNiveau(especeId, niveau);
  return {
    espece: especeId, niveau: niveau, xp: 0, pv: s.pvMax,
    conscience: 1,               // de 1 a CONSCIENCE_MAX
    fragments: fragmentsVides()  // les siens, non fongibles
  };
}

function ajouterAlaCollection(especeId, niveau) {
  var existant = collection[especeId];

  if (!existant) {
    collection[especeId] = nouvelEcho(especeId, niveau);

    /* Le seul moment ou la gourde se vide. Ce que le joueur avait
       ramasse avant de rencontrer l'espece lui revient d'un coup,
       ici : c'est ce qui rend le ramassage anticipe utile plutot
       que frustrant. viderGourdeVers vit dans js/fragments.js,
       charge apres celui-ci ; l'appel n'a lieu qu'a l'execution. */
    viderGourdeVers(especeId);

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
      ico: suiviIco,
      gourde: gourde,
      savoir: savoir
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

    /* ATTENTION EN RELISANT : cette ligne reconstruit l'Echo a
       neuf, elle ne le recopie pas. Tout champ absent d'ici est
       PERDU au prochain chargement, en silence. C'est ce qui
       protege la sauvegarde des champs inventes a la main, et
       c'est aussi le piege : ajouter un champ a un Echo veut dire
       l'ajouter ici, sinon il ne survit pas a un rechargement. */
    propre[espece] = {
      espece: espece, niveau: niveau, xp: xp, pv: pv,
      conscience: normaliserConscience(e.conscience),
      fragments: normaliserFragments(e.fragments)
    };
  }

  return propre;
}

/* Un Echo d'avant la v5 n'a pas de conscience : il demarre au
   premier palier, comme un Echo qu'on vient d'assimiler. On ne
   peut pas faire mieux -- rien dans une v4 ne dit ce qu'un joueur
   avait compris de sa creature. */
function normaliserConscience(valeur) {
  var c = Math.round(Number(valeur));
  if (!(c >= 1)) return 1;
  return Math.min(c, CONSCIENCE_MAX);
}

/* Un sac de fragments, toujours rendu complet : les trois tailles
   existent meme si elles valent zero. Le reste du jeu peut donc
   lire sac.complet sans se demander s'il est la. */
function normaliserFragments(brut) {
  var sac = fragmentsVides();
  if (!brut || typeof brut !== "object") return sac;

  FRAGMENT_TAILLES.forEach(function (taille) {
    var v = Math.round(Number(brut[taille]));
    if (v >= 0) sac[taille] = v;
  });

  return sac;
}

/* LA GOURDE

   Deux nettoyages, et un refus de nettoyer.

   On ecarte les especes disparues du jeu, comme pour la
   collection. On replie dans l'Echo les especes qui seraient a la
   fois dans la gourde et dans la collection : c'est une
   incoherence -- viderGourdeVers aurait du le faire -- et la
   reparer ici vaut mieux que garder des fragments invisibles.

   En revanche on NE RABOTE PAS une gourde trop pleine. Si la
   capacite baisse un jour, un joueur qui avait quinze fragments
   les garde ; il ne peut simplement plus en ajouter. Faire
   l'inverse ferait disparaitre des fragments au chargement, sans
   que personne ne l'ait demande. */
function normaliserGourde(brut, collectionPropre) {
  var propre = {};
  if (!brut || typeof brut !== "object") return propre;

  for (var id in brut) {
    if (!ESPECES[id]) continue;                   // espece disparue

    var sac = normaliserFragments(brut[id]);
    var echo = collectionPropre[id];

    if (echo) {                                   // deja assimilee : ca lui revient
      FRAGMENT_TAILLES.forEach(function (t) { echo.fragments[t] += sac[t]; });
      continue;
    }

    propre[id] = sac;
  }

  return propre;
}

/* LE SAVOIR

   Les doublons passent par un objet temoin et non par indexOf :
   une sauvegarde bricolee a la main peut contenir des milliers
   d'entrees, et un indexOf dans une boucle les relirait toutes a
   chaque tour. */
function normaliserSavoir(brut) {
  var sv = savoirParDefaut();
  if (!brut || typeof brut !== "object") return sv;

  var combats = Math.round(Number(brut.combats));
  if (combats >= 0) sv.combats = combats;

  sv.jours = listeDistincte(brut.jours);
  sv.lieux = listeDistincte(brut.lieux);

  return sv;
}

function listeDistincte(brut) {
  var propre = [], vus = {};
  if (!brut || typeof brut.length !== "number") return propre;

  for (var i = 0; i < brut.length; i++) {
    var v = brut[i];
    if (typeof v !== "string" || v === "") continue;
    if (Object.prototype.hasOwnProperty.call(vus, v)) continue;
    vus[v] = true;
    propre.push(v);
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

    /* Rien en v5 : on descend les cles anciennes, de la plus
       recente a la plus vieille, et on prend la premiere qui
       repond.

       Une v4 n'a ni "gourde" ni "savoir", et ses Echos n'ont ni
       conscience ni fragments : tout cela est cree vide, et la
       partie reprend exactement ou elle en etait. Une v3 n'a pas
       de bloc "ico". Une v2 n'a pas non plus de bloc "joueur",
       donc introVue reste faux et l'intro se rejouera : c'est le
       comportement voulu depuis la v3.

       La cle lue n'est jamais effacee. La prochaine sauvegarde
       ecrit sous CLE_JOUEUR et laisse l'ancienne ou elle est. */
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

    // Apres la collection : normaliserGourde a besoin de savoir
    // quelles especes sont deja assimilees pour leur rendre leurs
    // fragments au lieu de les laisser en attente.
    gourde     = normaliserGourde(d.gourde, collection);
    savoir     = normaliserSavoir(d.savoir);
  } else {
    collection = {};
    equipe     = [];
    profil     = profilParDefaut();
    suiviIco   = icoParDefaut();
    gourde     = {};
    savoir     = savoirParDefaut();
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
