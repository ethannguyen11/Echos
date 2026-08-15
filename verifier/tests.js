/* ============================================================
   LES TESTS
   Chaque test compare le resultat d'une fonction du jeu a une
   valeur relevee AVANT le decoupage en modules. Si un test
   passe au rouge, c'est que le comportement a change.

   Ce fichier est utilise par verifier/index.html (navigateur)
   et par verifier.js (Node). Il ne touche jamais a l'ecran.
   ============================================================ */

function lancerTests() {
  var resultats = [];
  var section = "";

  function bloc(titre) { section = titre; }

  function verifie(quoi, obtenu, attendu) {
    var a = JSON.stringify(attendu);
    var o = JSON.stringify(obtenu);
    resultats.push({ section: section, quoi: quoi, ok: a === o, obtenu: o, attendu: a });
  }

  // Meme suite de nombres "au hasard" a chaque execution, pour que
  // les formules qui tirent un alea restent verifiables.
  function suite(graine) {
    var e = graine;
    return function () {
      e = (e + 0x6D2B79F5) | 0;
      var t = Math.imul(e ^ (e >>> 15), 1 | e);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }


  /* --- Le bestiaire tient debout --- */

  bloc("Bestiaire");

  verifie("16 especes", Object.keys(ESPECES).length, 16);

  var champsManquants = [];
  for (var id in ESPECES) {
    var e = ESPECES[id];
    ["img", "famille", "nom", "titre", "pv", "atq", "def", "trait",
     "affinite", "nature"].forEach(function (champ) {
      if (e[champ] === undefined) champsManquants.push(id + "." + champ);
    });
    if (!COULEURS[e.famille]) champsManquants.push(id + " : famille sans couleur");
    if (!AFFINITE_BAT[e.affinite]) champsManquants.push(id + " : affinite inconnue");
    if (!FIGEMENT_NATURES[e.nature]) champsManquants.push(id + " : nature inconnue");
  }
  verifie("aucun champ manquant", champsManquants, []);

  var especesIntrouvables = [];
  for (var cat in ESPECES_PAR_LIEU) {
    if (!CATEGORIES[cat]) especesIntrouvables.push("categorie " + cat + " sans prefixe");
    ESPECES_PAR_LIEU[cat].forEach(function (nom) {
      if (!ESPECES[nom]) especesIntrouvables.push(nom);
    });
  }
  verifie("chaque lieu pointe vers des especes connues", especesIntrouvables, []);

  verifie("4 categories de lieu", Object.keys(CATEGORIES).length, 4);
  verifie("prefixes de nommage",
    Object.keys(CATEGORIES).map(function (k) { return k + ":" + CATEGORIES[k].prefixe; }),
    ["monument:Seuil de", "parc:Clairière du parc",
     "metro:Tunnel d'entrée de", "temple:Porte du Temple de"]);


  /* --- Statistiques par niveau --- */

  bloc("Statistiques");

  var stats = [];
  ["komainu", "sunwukong", "jinchan", "mechadrill"].forEach(function (id) {
    [1, 3, 8, 20, 50].forEach(function (n) {
      var s = statsAuNiveau(id, n);
      stats.push(id + "@" + n + " = " + s.pvMax + "/" + s.atq + "/" + s.def);
    });
  });
  verifie("statsAuNiveau", stats, [
    "komainu@1 = 26/5/9", "komainu@3 = 40/8/14", "komainu@8 = 73/14/25",
    "komainu@20 = 154/30/53", "komainu@50 = 357/69/124",
    "sunwukong@1 = 14/11/2", "sunwukong@3 = 21/17/3", "sunwukong@8 = 39/31/6",
    "sunwukong@20 = 83/65/12", "sunwukong@50 = 192/151/27",
    "jinchan@1 = 17/4/3", "jinchan@3 = 26/6/5", "jinchan@8 = 48/11/8",
    "jinchan@20 = 101/24/18", "jinchan@50 = 234/55/41",
    "mechadrill@1 = 31/8/6", "mechadrill@3 = 47/12/9", "mechadrill@8 = 87/23/17",
    "mechadrill@20 = 184/48/36", "mechadrill@50 = 426/110/82"
  ]);


  /* --- Reconnaissance et nommage des lieux --- */

  bloc("Lieux");

  verifie("categorieDuLieu", [
    categorieDuLieu({ amenity: "place_of_worship" }),
    categorieDuLieu({ leisure: "park" }),
    categorieDuLieu({ station: "subway" }),
    categorieDuLieu({ railway: "station", subway: "yes" }),
    categorieDuLieu({ historic: "memorial" }),
    categorieDuLieu({ man_made: "tower" }),
    categorieDuLieu({ tourism: "attraction" }),
    categorieDuLieu({ shop: "bakery" })
  ], ["temple", "parc", "metro", "metro", "monument", "monument", "monument", null]);

  verifie("nettoyerNom", [
    "Taipei 101", "Daan Forest Park", "Zhongxiao Fuxing MRT Station",
    "Longshan Temple", "Temple Longshan", "Station", "Chiang Kai-shek Memorial Hall"
  ].map(nettoyerNom),
    ["Taipei 101", "Daan Forest", "Zhongxiao Fuxing",
     "Longshan", "Longshan", "Station", "Chiang Kai-shek"]);

  verifie("nomDuLieu prefere le francais puis l'anglais", [
    nomDuLieu({ "name:fr": "Tour", "name:en": "Tower", name: "Ta" }),
    nomDuLieu({ "name:en": "Tower", name: "Ta" }),
    nomDuLieu({ name: "Ta" }),
    nomDuLieu({})
  ], ["Tour", "Tower", "Ta", ""]);


  /* --- Generation deterministe : le coeur du jeu --- */

  bloc("Generation deterministe");

  verifie("grainePourTexte",
    ["node/1", "way/42", "relation/7", ""].map(grainePourTexte),
    [3771305237, 2687123831, 3644585095, 2166136261]);

  var echantillons = [
    { type: "node", id: 1, lat: 25.033, lon: 121.565,
      tags: { name: "Longshan Temple", amenity: "place_of_worship" } },
    { type: "way", id: 42, lat: 25.04, lon: 121.53,
      tags: { name: "Daan Forest Park", leisure: "park" } },
    { type: "node", id: 999999, lat: 25.05, lon: 121.51,
      tags: { name: "Taipei Main Station", station: "subway" } },
    { type: "relation", id: 7, center: { lat: 25.02, lon: 121.56 },
      tags: { "name:fr": "Tour Taipei 101", name: "Taipei 101", man_made: "tower" } },
    { type: "node", id: 123456789, lat: 25.01, lon: 121.54,
      tags: { "name:en": "Sun Yat-sen Memorial Hall", historic: "memorial" } }
  ];

  verifie("donjonDepuisLieu (meme lieu, meme Echo, meme niveau)",
    echantillons.map(function (el) {
      var d = donjonDepuisLieu(el);
      return d.id + " | " + d.nom + " | " + d.categorie + " | " + d.espece + " | niv " + d.niveau;
    }), [
      "node/1 | Porte du Temple de Longshan | temple | palantir | niv 3",
      "way/42 | Clairière du parc Daan Forest | parc | penghou | niv 8",
      "node/999999 | Tunnel d'entrée de Taipei Main | metro | mechadrill | niv 3",
      "relation/7 | Seuil de Tour Taipei 101 | monument | tortuedragon | niv 7",
      "node/123456789 | Seuil de Sun Yat-sen | monument | tortuedragon | niv 8"
    ]);

  verifie("un lieu sans nom ou sans categorie est ignore", [
    donjonDepuisLieu({ type: "node", id: 5, lat: 25, lon: 121, tags: { shop: "bakery", name: "Boulangerie" } }),
    donjonDepuisLieu({ type: "node", id: 6, lat: 25, lon: 121, tags: { leisure: "park" } }),
    donjonDepuisLieu({ type: "node", id: 7, tags: { leisure: "park", name: "Parc" } })
  ], [null, null, null]);

  verifie("un donjon neuf n'est ni capture ni dissipe",
    [donjonDepuisLieu(echantillons[0]).capture, donjonDepuisLieu(echantillons[0]).dissipe],
    [false, false]);


  /* --- Distances et doublons --- */

  bloc("Distances");

  verifie("distanceMetres", [
    Math.round(distanceMetres(25.033, 121.565, 25.033, 121.565)),
    Math.round(distanceMetres(25.033, 121.565, 25.043, 121.565)),
    Math.round(distanceMetres(25.033, 121.565, 25.033, 121.575))
  ], [0, 1112, 1007]);

  var donjonsAvant = donjons;
  donjons = { a: { categorie: "parc", lat: 25.0, lon: 121.0 } };
  verifie("estUnDoublon", [
    estUnDoublon({ categorie: "parc", lat: 25.0, lon: 121.0 }),
    estUnDoublon({ categorie: "parc", lat: 25.0005, lon: 121.0 }),
    estUnDoublon({ categorie: "parc", lat: 25.002, lon: 121.0 }),
    estUnDoublon({ categorie: "temple", lat: 25.0, lon: 121.0 })
  ], [true, true, false, false]);
  donjons = donjonsAvant;

  verifie("requeteOverpass", requeteOverpass(25.033, 121.565),
    '[out:json][timeout:25];(nwr["amenity"="place_of_worship"](around:700,25.033,121.565);' +
    'nwr["leisure"="park"](around:700,25.033,121.565);' +
    'nwr["station"="subway"](around:700,25.033,121.565);' +
    'nwr["railway"="station"]["subway"="yes"](around:700,25.033,121.565);' +
    'nwr["historic"](around:700,25.033,121.565);' +
    'nwr["man_made"="tower"](around:700,25.033,121.565);' +
    'nwr["tourism"="attraction"](around:700,25.033,121.565););out center 80;');


  /* --- Formules de combat --- */

  bloc("Combat");

  var alea = suite(1234);
  var coups = [];
  [[5, 9], [11, 2], [8, 6], [3, 20], [7, 4]].forEach(function (p) {
    for (var i = 0; i < 3; i++) coups.push(degats(p[0], p[1], alea()));
  });
  verifie("degats", coups, [1, 1, 1, 11, 9, 9, 4, 5, 5, 1, 1, 1, 6, 5, 5]);

  verifie("degats : jamais moins de 1", degats(1, 100, 0), 1);

  verifie("adversaireDe (il se renforce avec la taille de l'equipe)",
    [1, 2, 3].map(function (t) {
      var adv = adversaireDe({ espece: "komainu", niveau: 5 }, t);
      return t + " -> " + adv.pv + "/" + adv.atq + "/" + adv.def;
    }), ["1 -> 53/10/18", "2 -> 90/12/18", "3 -> 127/13/18"]);

  function faussCombat(pvAdv, pvMaxAdv, nivAdv, niveaux, tentatives) {
    return {
      adversaire: { pv: pvAdv, pvMax: pvMaxAdv, niveau: nivAdv },
      equipe: niveaux.map(function (n) { return { niveau: n }; }),
      tentatives: tentatives
    };
  }
  verifie("chanceAssimilation", [
    chanceAssimilation(faussCombat(30, 30, 5, [3], 0)),
    chanceAssimilation(faussCombat(15, 30, 5, [3], 0)),
    chanceAssimilation(faussCombat(1, 30, 5, [3], 0)),
    chanceAssimilation(faussCombat(1, 30, 5, [3, 4, 5], 0)),
    chanceAssimilation(faussCombat(1, 30, 5, [3, 4, 5], 6)),
    chanceAssimilation(faussCombat(30, 30, 40, [1], 0)),
    chanceAssimilation(faussCombat(0, 30, 1, [20, 20, 20], 0)),
    chanceAssimilation(faussCombat(-5, 30, 5, [3], 1))
  ], [2, 26, 51, 68, 44, 2, 95, 49]);

  verifie("chanceAssimilation reste entre 2 et 95",
    [chanceAssimilation(faussCombat(30, 30, 50, [1], 20)),
     chanceAssimilation(faussCombat(0, 30, 1, [50, 50, 50], 0))],
    [2, 95]);


  /* --- Le Figement --- */

  bloc("Figement");

  // komainu organique, eiffel mecanique, jinchan hybride
  verifie("multiplicateur organique : 1.25 -> 1.00 -> 0.75",
    [0, 5, 10].map(function (p) { return multiplicateurFigement("komainu", p); }),
    [1.25, 1, 0.75]);

  verifie("multiplicateur mecanique : 0.75 -> 1.00 -> 1.25",
    [0, 5, 10].map(function (p) { return multiplicateurFigement("eiffel", p); }),
    [0.75, 1, 1.25]);

  verifie("multiplicateur hybride : 1.00 partout",
    [0, 3, 5, 8, 10].map(function (p) { return multiplicateurFigement("jinchan", p); }),
    [1, 1, 1, 1, 1]);

  verifie("le palier va de 0 a 10 et ne deborde jamais",
    [-30, 0, 9, 10, 74, 99, 100, 250].map(palierFigement),
    [0, 0, 0, 1, 7, 9, 10, 10]);

  // matiere bat recit, recit bat oubli, oubli bat matiere
  verifie("triangle d'affinites : les trois avantages",
    [multiplicateurAffinite("komainu", "sunwukong"),    // matiere frappe recit
     multiplicateurAffinite("sunwukong", "baku"),       // recit   frappe oubli
     multiplicateurAffinite("baku", "komainu")          // oubli   frappe matiere
    ], [1.3, 1.3, 1.3]);

  verifie("triangle d'affinites : les trois desavantages",
    [multiplicateurAffinite("sunwukong", "komainu"),    // recit   frappe matiere
     multiplicateurAffinite("baku", "sunwukong"),       // oubli   frappe recit
     multiplicateurAffinite("komainu", "baku")          // matiere frappe oubli
    ], [0.75, 0.75, 0.75]);

  verifie("meme affinite : rien ne change",
    [multiplicateurAffinite("komainu", "tortuedragon"),
     multiplicateurAffinite("baku", "penghou")],
    [1, 1]);

  // L'ordre impose : base x affinite x figement, arrondi, plancher a 1
  verifie("degatsAjustes suit l'ordre de calcul",
    [degatsAjustes(10, "komainu", "tortuedragon", 0),   // 10 x 1    x 1.25
     degatsAjustes(10, "komainu", "tortuedragon", 10),  // 10 x 1    x 0.75
     degatsAjustes(10, "eiffel", "tortuedragon", 0),    // 10 x 1    x 0.75
     degatsAjustes(10, "eiffel", "tortuedragon", 10),   // 10 x 1    x 1.25
     degatsAjustes(10, "komainu", "sunwukong", 0),      // 10 x 1.3  x 1.25
     degatsAjustes(10, "sunwukong", "komainu", 10)      // 10 x 0.75 x 0.75
    ], [13, 8, 8, 13, 16, 6]);

  verifie("les degats ne descendent jamais sous 1",
    [degatsAjustes(1, "sunwukong", "komainu", 10),
     degatsAjustes(0, "eiffel", "tortuedragon", 0)],
    [1, 1]);

  // Criteres d'acceptation : l'organique faiblit, le mecanique monte
  verifie("un organique frappe moins fort au tour 8 qu'au tour 1",
    degatsAjustes(20, "komainu", "tortuedragon", 8) <
    degatsAjustes(20, "komainu", "tortuedragon", 1), true);

  verifie("un mecanique frappe plus fort au tour 8 qu'au tour 1",
    degatsAjustes(20, "eiffel", "tortuedragon", 8) >
    degatsAjustes(20, "eiffel", "tortuedragon", 1), true);

  // Le meme lieu doit toujours rendre le meme Figement de depart
  var lieuTemoin = { id: "node/1", espece: "komainu", niveau: 3 };
  verifie("un meme lieu donne toujours le meme Figement",
    [figementDuLieu(lieuTemoin), figementDuLieu(lieuTemoin), figementDuLieu({ id: "node/1" })],
    [figementDuLieu({ id: "node/1" }), figementDuLieu({ id: "node/1" }),
     figementDuLieu({ id: "node/1" })]);

  verifie("des lieux differents donnent des Figements differents",
    ["node/1", "way/42", "relation/7", "node/999999"].map(function (id) {
      return figementDuLieu({ id: id });
    }), [55, 24, 54, 53]);

  verifie("une valeur deja posee sur le lieu l'emporte",
    [figementDuLieu({ id: "node/1", figement: 90 }),
     figementDuLieu({ id: "node/1", figement: 150 }),   // borne haute
     figementDuLieu({ id: "node/1", figement: -5 })],   // borne basse
    [90, 100, 0]);

  verifie("un lieu sans identifiant ne casse rien", figementDuLieu({}), 0);

  // avancerFigement travaille sur la variable globale combat
  var combatAvant = combat;
  combat = { figement: 74 };
  var montee = [];
  for (var t = 0; t < 4; t++) { avancerFigement(); montee.push(combat.figement); }
  combat = combatAvant;
  verifie("le Figement monte d'un palier par tour et plafonne a 100",
    montee, [84, 94, 100, 100]);


  /* --- Collection, equipe, experience --- */

  bloc("Joueur");

  var collectionAvant = collection, equipeAvant = equipe;
  collection = {};
  equipe = [];

  verifie("ajouterAlaCollection", [
    ajouterAlaCollection("komainu", 4),
    ajouterAlaCollection("komainu", 2),
    ajouterAlaCollection("komainu", 7),
    ajouterAlaCollection("baku", 1),
    ajouterAlaCollection("peng", 2),
    ajouterAlaCollection("vinci", 9)
  ], ["nouveau", "connu", "renforce", "nouveau", "nouveau", "nouveau"]);

  verifie("l'equipe s'arrete a 3", equipe, ["komainu", "baku", "peng"]);
  verifie("un doublon plus fort remplace l'ancien",
    collection.komainu, { espece: "komainu", niveau: 7, xp: 0, pv: 67 });

  verifie("xpRequis", [1, 2, 5, 10, 49].map(xpRequis), [26, 40, 82, 152, 698]);
  verifie("gagnerXp (montees de niveau)",
    [gagnerXp("baku", 25), gagnerXp("baku", 500), gagnerXp("inconnu", 10)],
    [0, 7, null]);
  verifie("gagnerXp soigne a la montee",
    collection.baku, { espece: "baku", niveau: 8, xp: 49, pv: 65 });

  // basculerEquipe ecrit normalement la sauvegarde et redessine le
  // grimoire : on neutralise ces deux effets, pour que lancer les
  // tests n'efface jamais une vraie partie.
  var vraiSauver = sauverJoueur, vraieFiche = majFiche, vraiGrimoire = ouvrirGrimoire;
  sauverJoueur = function () {};
  majFiche = function () {};
  ouvrirGrimoire = function () {};

  equipe = [];
  basculerEquipe("komainu");
  basculerEquipe("baku");
  basculerEquipe("peng");
  basculerEquipe("vinci");                    // la 4e est refusee
  verifie("basculerEquipe : 3 maximum", equipe.slice(), ["komainu", "baku", "peng"]);
  basculerEquipe("baku");                     // un 2e appui retire l'Echo
  verifie("basculerEquipe : retirer", equipe.slice(), ["komainu", "peng"]);

  sauverJoueur = vraiSauver;
  majFiche = vraieFiche;
  ouvrirGrimoire = vraiGrimoire;

  collection = collectionAvant;
  equipe = equipeAvant;


  /* --- Cinematique d'ouverture --- */

  bloc("Intro");

  var f = Intro.formater;

  verifie("formater : accord de genre",
    ["m", "f", "n"].map(function (g) { return f("Tu es un[|e|·e] {voie}.", { genre: g, voie: "archiviste" }); }),
    ["Tu es un archiviste.", "Tu es une archiviste.", "Tu es un·e archiviste."]);

  verifie("formater : les quatre lignes accordees au feminin",
    ["Tu n'étais pas réveillé[|e|·e] non plus.",
     "Tu es sûr[|e|·e] de l'avoir connu.",
     "Tu es un[|e|·e] {voie}.",
     "Tu n'iras pas seul[|e|·e]."].map(function (t) { return f(t, { genre: "f", voie: "gardien" }); }),
    ["Tu n'étais pas réveillée non plus.",
     "Tu es sûre de l'avoir connu.",
     "Tu es une gardien.",
     "Tu n'iras pas seule."]);

  verifie("formater : {nom} et {voie}",
    f("Et {nom} — tu es un[|e|·e] {voie}.", { nom: "Ethan", genre: "n", voie: "arpenteur" }),
    "Et Ethan — tu es un·e arpenteur.");

  verifie("formater : un genre absent retombe sur le masculin, sans casser",
    [f("seul[|e|·e]", {}), f("seul[|e|·e]", { genre: "?" }), f("rien a formater", { genre: "f" })],
    ["seul", "seul", "rien a formater"]);

  verifie("formater : ce qui n'est pas un accord n'est pas touche",
    f("un tableau [1|2] et [a|b|c|d]", { genre: "f" }),
    "un tableau [1|2] et [a|b|c|d]");

  var voie = Intro.calculerVoie;
  verifie("calculerVoie : majorite et egalite", [
    voie("archiviste", "archiviste", "gardien"),      // 2 sur 3
    voie("gardien", "arpenteur", "gardien"),          // 2 sur 3, non adjacentes
    voie("arpenteur", "arpenteur", "arpenteur"),      // unanimite
    voie("archiviste", "arpenteur", "gardien"),       // egalite parfaite : la 3e tranche
    voie("gardien", "archiviste", "arpenteur")        // egalite parfaite : la 3e tranche
  ], ["archiviste", "gardien", "arpenteur", "gardien", "arpenteur"]);

  // Toutes les lignes du script doivent se formater completement,
  // quel que soit le genre : aucun {...} ni [...] ne doit survivre.
  var restes = [];
  ["m", "f", "n"].forEach(function (g) {
    Intro.SCRIPT.forEach(function (e, i) {
      var textes = [];
      if (e.texte) textes.push(e.texte);
      if (e.options) e.options.forEach(function (o) { textes.push(o.texte); });

      textes.forEach(function (t) {
        var sortie = f(t, { genre: g, nom: "Ethan", voie: "archiviste" });
        if (/[\[\]]/.test(sortie) || /\{[a-z]+\}/.test(sortie)) restes.push(g + " #" + i + " : " + sortie);
      });
    });
  });
  verifie("aucun accord ni {nom} oublie dans tout le script", restes, []);

  // Le moteur ne sait traiter que ces types-la
  var TYPES = ["pause", "recit", "ico", "lieu", "apparition", "saisie",
               "choix", "calculVoie", "echoDepart", "musique", "fin"];
  var malFormees = [];
  Intro.SCRIPT.forEach(function (e, i) {
    if (TYPES.indexOf(e.type) === -1) malFormees.push("#" + i + " type " + e.type);
    if (e.type === "pause" && !(e.duree > 0)) malFormees.push("#" + i + " sans duree");
    if (e.type === "saisie" && (!e.cle || !(e.max > 0))) malFormees.push("#" + i + " saisie incomplete");
    if (e.type === "choix") {
      if (!e.cle) malFormees.push("#" + i + " choix sans cle");
      if (!e.options || e.options.length < 2) malFormees.push("#" + i + " choix sans options");
      (e.options || []).forEach(function (o) {
        if (!o.texte || !o.valeur) malFormees.push("#" + i + " option incomplete");
      });
    }
  });
  verifie("chaque etape est bien formee", malFormees, []);

  var parType = {};
  Intro.SCRIPT.forEach(function (e) { parType[e.type] = (parType[e.type] || 0) + 1; });
  verifie("le script contient bien une saisie, quatre choix et une fin",
    [parType.saisie, parType.choix, parType.calculVoie, parType.echoDepart, parType.fin],
    [1, 4, 1, 1, 1]);

  var blocs = { lieu: 0, repli: 0 };
  Intro.SCRIPT.forEach(function (e) { if (e.bloc) blocs[e.bloc]++; });
  verifie("la bifurcation lieu / repli existe des deux cotes",
    [blocs.lieu > 0, blocs.repli > 0], [true, true]);

  return resultats;
}
