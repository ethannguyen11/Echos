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
    ["image", "famille", "nom", "titre", "pv", "atq", "def", "trait",
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
    "komainu@1 = 28/6/6", "komainu@3 = 43/9/9", "komainu@8 = 79/17/17",
    "komainu@20 = 166/36/36", "komainu@50 = 385/82/82",
    "sunwukong@1 = 22/9/3", "sunwukong@3 = 33/14/5", "sunwukong@8 = 62/25/8",
    "sunwukong@20 = 131/53/18", "sunwukong@50 = 302/124/41",
    "jinchan@1 = 20/6/4", "jinchan@3 = 30/9/6", "jinchan@8 = 56/17/11",
    "jinchan@20 = 119/36/24", "jinchan@50 = 275/82/55",
    "mechadrill@1 = 29/8/5", "mechadrill@3 = 44/12/8", "mechadrill@8 = 82/23/14",
    "mechadrill@20 = 172/48/30", "mechadrill@50 = 398/110/69"
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
      // Les especes suivent le Figement du lieu : au palier 5, le
      // metro ne peut plus sortir Mecha Drill (rang S), et le
      // monument sort Eiffel (B) au lieu de Tortue Dragon (S).
      "node/1 | Porte du Temple de Longshan | temple | palantir | niv 3",
      "way/42 | Clairière du parc Daan Forest | parc | penghou | niv 8",
      "node/999999 | Tunnel d'entrée de Taipei Main | metro | teketeke | niv 3",
      "relation/7 | Seuil de Tour Taipei 101 | monument | eiffel | niv 7",
      "node/123456789 | Seuil de Sun Yat-sen | monument | hephaistos | niv 8"
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
  verifie("degats", coups, [1, 1, 2, 12, 9, 9, 5, 6, 5, 1, 1, 1, 6, 5, 5]);

  verifie("degats : jamais moins de 1", degats(1, 100, 0), 1);

  verifie("adversaireDe (il se renforce avec la taille de l'equipe)",
    [1, 2, 3].map(function (t) {
      var adv = adversaireDe({ espece: "komainu", niveau: 5 }, t);
      return t + " -> " + adv.pv + "/" + adv.atq + "/" + adv.def;
    }), ["1 -> 57/12/12", "2 -> 97/19/12", "3 -> 137/26/12"]);

  /* --- Assimiler ---
     Nouvelle formule, visible sur le bouton :
       socle 30 + PV manquants x 0.4 + ecart de niveau x 3 (borne +/-20)
       + Appel + Defendre - malus de rang, borne entre 5 et 95.
     Les rangs viennent des especes : jinchan D, vinci C, baku B,
     komainu A, tortuedragon S. */

  function faussCombat(espece, pv, pvMax, nivCible, niveaux, bonusAppel, bonusDefense) {
    return {
      adversaire: { espece: espece, pv: pv, pvMax: pvMax, niveau: nivCible },
      equipe: niveaux.map(function (n) { return { niveau: n, pv: 1 }; }),
      bonusAppel: bonusAppel || 0,
      bonusDefense: bonusDefense || 0
    };
  }

  // Cible rang D, meme niveau que l'equipe : on isole le poids des PV
  verifie("assimiler : le taux monte quand la cible faiblit",
    [chanceAssimilation(faussCombat("jinchan", 100, 100, 10, [10])),   // 30 + 0
     chanceAssimilation(faussCombat("jinchan", 50, 100, 10, [10])),    // 30 + 20
     chanceAssimilation(faussCombat("jinchan", 10, 100, 10, [10])),    // 30 + 36
     chanceAssimilation(faussCombat("jinchan", 0, 100, 10, [10]))],    // 30 + 40
    [30, 50, 66, 70]);

  verifie("assimiler : c'est le meilleur Echo DEBOUT qui mene l'appel",
    [chanceAssimilation(faussCombat("jinchan", 100, 100, 10, [10, 14])),   // +4 x 3 = +12
     chanceAssimilation(faussCombat("jinchan", 100, 100, 10, [6]))],       // -4 x 3 = -12
    [42, 18]);

  verifie("assimiler : l'ecart de niveau est borne a +/- 20",
    [chanceAssimilation(faussCombat("jinchan", 100, 100, 1, [50])),
     chanceAssimilation(faussCombat("jinchan", 100, 100, 50, [1]))],
    [50, 10]);

  verifie("assimiler : le malus de rang D C B A S",
    ["jinchan", "vinci", "baku", "komainu", "tortuedragon"].map(function (id) {
      return chanceAssimilation(faussCombat(id, 100, 100, 10, [10]));
    }), [30, 25, 20, 15, 5]);

  verifie("assimiler : Appel et Defendre s'ajoutent",
    [chanceAssimilation(faussCombat("baku", 50, 100, 10, [10])),
     chanceAssimilation(faussCombat("baku", 50, 100, 10, [10], 20)),
     chanceAssimilation(faussCombat("baku", 50, 100, 10, [10], 0, 10)),
     chanceAssimilation(faussCombat("baku", 50, 100, 10, [10], 20, 10))],
    [40, 60, 50, 70]);

  verifie("assimiler : le taux ne sort jamais de 5 - 95",
    [chanceAssimilation(faussCombat("tortuedragon", 100, 100, 50, [1])),
     chanceAssimilation(faussCombat("jinchan", 0, 100, 1, [50], 20, 10))],
    [ASSIMILATION_MIN, ASSIMILATION_MAX]);

  verifie("assimiler : aucune espece n'est de rang X aujourd'hui",
    Object.keys(ESPECES).filter(function (id) {
      return ESPECES[id].rang === RANG_INASSIMILABLE;
    }), []);

  /* --- Le Figement comme difficulte du lieu ---
     Trois effets, et trois seulement : le niveau des adversaires,
     l'experience gagnee, et les rangs qui peuvent apparaitre.
     Il agit meme quand la mecanique de combat est en sommeil. */

  verifie("difficulte : +1 niveau tous les 2 paliers, de +0 a +5",
    [0, 1, 2, 5, 8, 10].map(function (p) {
      return niveauAdversaire({ id: "x", niveau: 10, figement: p * 10 });
    }), [10, 10, 11, 12, 14, 15]);

  verifie("difficulte : l'XP monte jusqu'a x1.50",
    [0, 5, 10].map(function (p) {
      return Math.round(multiplicateurXp({ id: "x", figement: p * 10 }) * 100) / 100;
    }), [1, 1.25, 1.5]);

  verifie("difficulte : les rangs autorises suivent le palier",
    [0, 2, 3, 5, 6, 8, 9, 10].map(function (p) { return rangsAuPalier(p).join(""); }),
    ["DC", "DC", "DCB", "DCB", "CBA", "CBA", "BAS", "BAS"]);

  verifie("difficulte : un lieu vivant ne sort jamais de rang S",
    [0, 1, 2].map(function (p) {
      return especesDisponibles("metro", p).indexOf("mechadrill");   // mechadrill est S
    }), [-1, -1, -1]);


  /* --- Le mode test ---
     Le contrat est d'abord un contrat d'absence : a false, rien
     n'existe. Ces tests le rallument pour verifier qu'il marche,
     puis le rendorment. */

  var modeTestRegle = MODE_TEST, localRegle = MODE_TEST_LOCAL_SEULEMENT;

  function avecModeTest(allume, f) {
    MODE_TEST = allume;
    MODE_TEST_LOCAL_SEULEMENT = false;   // le faux navigateur n'a pas de hostname
    try { return f(); }
    finally { MODE_TEST = modeTestRegle; MODE_TEST_LOCAL_SEULEMENT = localRegle; }
  }

  verifie("mode test : livre a l'arret, et local seulement",
    [modeTestRegle, localRegle], [false, true]);

  verifie("mode test eteint : aucun donjon fictif, panneau muet",
    [ModeTest.actif(), ModeTest.donjonDeTest(25, 121)],
    [false, null]);

  verifie("mode test allume : un donjon fictif est fabrique",
    avecModeTest(true, function () {
      var d = ModeTest.donjonDeTest(25.03, 121.56);
      return [ModeTest.actif(), d.fictif, d.lat, d.lon, d.id];
    }), [true, true, 25.03, 121.56, "test/fictif"]);

  verifie("mode test : le panneau pilote palier, niveau et espece",
    avecModeTest(true, function () {
      ModeTest.reglages.palier = 8;
      ModeTest.reglages.niveau = 22;
      ModeTest.reglages.espece = "baku";
      var d = ModeTest.donjonDeTest(0, 0);
      var lu = [palierFigement(figementDuLieu(d)), d.niveau, d.espece];
      ModeTest.reglages.palier = 5;
      ModeTest.reglages.niveau = 5;
      ModeTest.reglages.espece = "sunwukong";
      return lu;
    }), [8, 22, "baku"]);

  verifie("mode test : le donjon fictif n'entre jamais dans donjons",
    avecModeTest(true, function () {
      var avant = Object.keys(donjons).length;
      ModeTest.donjonDeTest(0, 0);
      return Object.keys(donjons).length === avant;
    }), true);

  verifie("un combat fictif est reconnu comme tel", (function () {
    var avant = combat;
    combat = { donjon: { fictif: true } };
    var oui = estCombatFictif();
    combat = { donjon: { id: "node/1" } };
    var non = estCombatFictif();
    combat = avant;
    return [oui, non];
  })(), [true, false]);


  /* --- Le rang est une tendance, pas un mur ---
     Avec 4 especes par categorie, la bande brute laissait parfois
     une seule espece possible. Elle s'elargit maintenant jusqu'a
     RANGS_MINIMUM_ESPECES. */

  var casesMaigres = [];
  Object.keys(ESPECES_PAR_LIEU).forEach(function (cat) {
    for (var p = 0; p <= FIGEMENT_PALIER_MAX; p++) {
      var n = especesDisponibles(cat, p).length;
      if (n < RANGS_MINIMUM_ESPECES) casesMaigres.push(cat + " palier " + p + " : " + n);
    }
  });
  verifie("aucune case categorie x palier sous le minimum", casesMaigres, []);

  // Les deux cas qui ont motive la correction
  verifie("un monument peu fige ne donne plus toujours Vinci",
    especesDisponibles("monument", 1).length >= RANGS_MINIMUM_ESPECES, true);

  verifie("un parc tres fige ne donne plus toujours Peng",
    especesDisponibles("parc", 10).length >= RANGS_MINIMUM_ESPECES, true);

  // La bande s'elargit vers le bas en premier
  verifie("l'elargissement commence par le bas",
    especesDisponibles("temple", 10).map(function (id) { return ESPECES[id].rang; }).sort(),
    ["A", "B", "C"]);          // BAS ne donnait que A et B : C rejoint par le bas

  // Quand la bande suffit, elle n'est pas elargie : la tendance tient
  verifie("une bande deja suffisante n'est pas elargie",
    [especesDisponibles("parc", 0).map(function (id) { return ESPECES[id].rang; }).join(""),
     especesDisponibles("metro", 10).indexOf("mechadrill") !== -1],
    ["DDD", true]);            // parc vivant : que du D. metro mort : le S est la.

  // Meme categorie, meme palier, meme liste : le tirage reste sur
  var listeA = especesDisponibles("monument", 4).join(",");
  var listeB = especesDisponibles("monument", 4).join(",");
  verifie("le filtre rend toujours la meme liste, donc la meme espece",
    listeA === listeB && listeA.length > 0, true);

  /* Le point le plus important de tout ce bloc : le renfort du lieu
     ne doit JAMAIS se retrouver dans la collection du joueur. */
  verifie("un Echo capture garde son niveau de base, pas le niveau renforce",
    (function () {
      var collAvant = collection, eqAvant = equipe, combatAvant = combat;
      collection = {}; equipe = [];

      var donjon = { id: "node/1", espece: "komainu", niveau: 4 };   // palier 5 -> +2
      var renforce = niveauAdversaire(donjon);
      ajouterAlaCollection(donjon.espece, donjon.niveau);            // ce que fait capture()
      var enCollection = collection.komainu.niveau;

      collection = collAvant; equipe = eqAvant; combat = combatAvant;
      return [donjon.niveau, renforce, enCollection];
    })(), [4, 6, 4]);

  verifie("assimiler : un lieu marque rang X refuse la commande",
    [assimilable({ espece: "jinchan" }),
     assimilable({ espece: "jinchan", rang: RANG_INASSIMILABLE }),
     assimilable(null)],
    [true, false, false]);


  /* --- Les aptitudes --- */

  verifie("les 8 archetypes existent",
    Object.keys(APTITUDES).sort(),
    ["appel", "doubleFrappe", "fissure", "frappeLourde",
     "percee", "rempart", "sceau", "seve"]);

  var aptitudesInconnues = [];
  for (var idEspece in ESPECES) {
    var listeApt = ESPECES[idEspece].aptitudes;
    if (!listeApt || listeApt.length !== 3) { aptitudesInconnues.push(idEspece + " : pas 3 aptitudes"); continue; }
    listeApt.forEach(function (cle) {
      if (!APTITUDES[cle]) aptitudesInconnues.push(idEspece + " : " + cle + " inconnue");
    });
    // Attention : le malus du rang D vaut 0, donc on teste l'absence
    // et pas la faussete, sinon D passerait pour un rang inconnu.
    if (ASSIMILATION_MALUS_RANG[ESPECES[idEspece].rang] === undefined) {
      aptitudesInconnues.push(idEspece + " : rang " + ESPECES[idEspece].rang + " inconnu");
    }
  }
  verifie("chaque espece a 3 aptitudes connues et un rang valide", aptitudesInconnues, []);

  verifie("deblocage : rien avant 5, une a 5, deux a 10, trois a 15",
    [1, 4, 5, 9, 10, 14, 15, 40].map(function (n) {
      return aptitudesConnues("komainu", n).length;
    }), [0, 0, 1, 1, 2, 2, 3, 3]);

  verifie("deblocage : c'est bien l'ordre du bestiaire qui est suivi",
    [aptitudesConnues("komainu", 5), aptitudesConnues("komainu", 10),
     aptitudesConnues("komainu", 15)],
    [["rempart"], ["rempart", "sceau"], ["rempart", "sceau", "fissure"]]);

  verifie("Peng n'a plus le kit de Sun Wukong",
    [ESPECES.peng.aptitudes, ESPECES.sunwukong.aptitudes],
    [["percee", "sceau", "frappeLourde"],
     ["doubleFrappe", "percee", "frappeLourde"]]);

  // La recharge : 3 tours, et une aptitude en recharge n'est pas jouable
  verifie("recharge : indisponible 3 tours, puis de nouveau prete", (function () {
    var c = { pv: 10, immobilise: 0, recharges: {} };
    var vus = [aptitudeDisponible(c, "rempart")];      // avant emploi
    c.recharges.rempart = APTITUDE_RECHARGE;
    for (var t = 0; t < 4; t++) {
      vus.push(rechargeRestante(c, "rempart"));
      if (c.recharges.rempart > 0) c.recharges.rempart--;
    }
    vus.push(aptitudeDisponible(c, "rempart"));        // apres 3 tours
    return vus;
  })(), [true, 3, 2, 1, 0, true]);

  verifie("un Echo immobilise ou a terre ne peut rien employer",
    [aptitudeDisponible({ pv: 10, immobilise: 0, recharges: {} }, "rempart"),
     aptitudeDisponible({ pv: 10, immobilise: 1, recharges: {} }, "rempart"),
     aptitudeDisponible({ pv: 0,  immobilise: 0, recharges: {} }, "rempart")],
    [true, false, false]);

  // Les aptitudes se deduisent de l'espece et du niveau : rien en sauvegarde
  verifie("les aptitudes ne sont jamais ecrites dans la sauvegarde", (function () {
    var avant = collection;
    collection = {};
    ajouterAlaCollection("komainu", 20);
    var champs = Object.keys(collection.komainu).sort();
    collection = avant;
    return champs;
  })(), ["espece", "niveau", "pv", "xp"]);


  /* --- Le Figement --- */

  bloc("Figement");

  /* Le Figement est en sommeil (VITESSE_FIGEMENT = 0). Les tests qui
     suivent le rallument le temps de verifier que le code dort mais
     n'est pas casse, puis le rendorment. C'est ce va-et-vient qui
     garantit qu'on peut revenir en arriere d'une seule constante. */

  var vitesseReglee = VITESSE_FIGEMENT, barreReglee = AFFICHER_BARRE_FIGEMENT;

  function avecFigement(actif, f) {
    VITESSE_FIGEMENT = actif ? 1 : 0;
    AFFICHER_BARRE_FIGEMENT = actif;
    try { return f(); }
    finally { VITESSE_FIGEMENT = vitesseReglee; AFFICHER_BARRE_FIGEMENT = barreReglee; }
  }

  verifie("en sommeil : le reglage livre est bien a l'arret",
    [vitesseReglee, barreReglee], [0, false]);

  verifie("en sommeil : tous les multiplicateurs valent 1.00",
    ["komainu", "eiffel", "jinchan"].map(function (id) {
      return [0, 5, 10].map(function (p) { return multiplicateurFigement(id, p); });
    }), [[1, 1, 1], [1, 1, 1], [1, 1, 1]]);

  verifie("en sommeil : aucune fleche",
    [flecheFigement("komainu", 0), flecheFigement("eiffel", 10)], ["", ""]);

  verifie("en sommeil : le compteur ne bouge plus", (function () {
    var avant = combat;
    combat = { figement: 40 };
    avancerFigement(); avancerFigement();
    var apres = combat.figement;
    combat = avant;
    return apres;
  })(), 40);

  verifie("en sommeil : les degats ne dependent plus que de l'affinite",
    [degatsAjustes(10, "komainu", "tortuedragon", 0),    // neutre
     degatsAjustes(10, "komainu", "tortuedragon", 10),   // neutre, palier max
     degatsAjustes(10, "komainu", "sunwukong", 0),       // avantage 1.3
     degatsAjustes(10, "sunwukong", "komainu", 10)],     // desavantage 0.75
    [10, 10, 13, 9]);

  // Et maintenant : rallume, tout doit revenir exactement comme avant
  verifie("rallume : l'ancien comportement revient a l'identique",
    avecFigement(true, function () {
      return [multiplicateurFigement("komainu", 0),
              multiplicateurFigement("komainu", 10),
              multiplicateurFigement("eiffel", 0),
              multiplicateurFigement("eiffel", 10),
              degatsAjustes(10, "komainu", "sunwukong", 0),
              flecheFigement("komainu", 0) !== ""];
    }), [1.25, 0.75, 0.75, 1.25, 16, true]);


  /* Les tests qui suivent decrivent la mecanique telle qu'elle
     fonctionne quand elle tourne : ils la rallument le temps de
     l'appel. Ils restent la meme garantie qu'avant sa mise en
     sommeil, et ce sont eux qui rendent le retour en arriere sur. */

  // komainu organique, eiffel mecanique, jinchan hybride
  verifie("multiplicateur organique : 1.25 -> 1.00 -> 0.75",
    avecFigement(true, function () {
      return [0, 5, 10].map(function (p) { return multiplicateurFigement("komainu", p); });
    }), [1.25, 1, 0.75]);

  verifie("multiplicateur mecanique : 0.75 -> 1.00 -> 1.25",
    avecFigement(true, function () {
      return [0, 5, 10].map(function (p) { return multiplicateurFigement("eiffel", p); });
    }), [0.75, 1, 1.25]);

  verifie("multiplicateur hybride : 1.00 partout",
    avecFigement(true, function () {
      return [0, 3, 5, 8, 10].map(function (p) { return multiplicateurFigement("jinchan", p); });
    }), [1, 1, 1, 1, 1]);

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
    ], [AFFINITE_DESAVANTAGE, AFFINITE_DESAVANTAGE, AFFINITE_DESAVANTAGE]);

  verifie("meme affinite : rien ne change",
    [multiplicateurAffinite("komainu", "tortuedragon"),
     multiplicateurAffinite("baku", "penghou")],
    [1, 1]);

  // L'ordre impose : base x affinite x figement, arrondi, plancher a 1
  verifie("degatsAjustes suit l'ordre de calcul",
    avecFigement(true, function () {
      return [degatsAjustes(10, "komainu", "tortuedragon", 0),   // 10 x 1    x 1.25
              degatsAjustes(10, "komainu", "tortuedragon", 10),  // 10 x 1    x 0.75
              degatsAjustes(10, "eiffel", "tortuedragon", 0),    // 10 x 1    x 0.75
              degatsAjustes(10, "eiffel", "tortuedragon", 10),   // 10 x 1    x 1.25
              degatsAjustes(10, "komainu", "sunwukong", 0),      // 10 x 1.3  x 1.25
              degatsAjustes(10, "sunwukong", "komainu", 10)];    // 10 x 0.75 x 0.75
    }), [13, 8, 8, 13, 16, 6]);

  verifie("les degats ne descendent jamais sous 1",
    avecFigement(true, function () {
      return [degatsAjustes(1, "sunwukong", "komainu", 10),
              degatsAjustes(0, "eiffel", "tortuedragon", 0)];
    }), [1, 1]);

  // Criteres d'acceptation : l'organique faiblit, le mecanique monte
  verifie("un organique frappe moins fort au tour 8 qu'au tour 1",
    avecFigement(true, function () {
      return degatsAjustes(20, "komainu", "tortuedragon", 8) <
             degatsAjustes(20, "komainu", "tortuedragon", 1);
    }), true);

  verifie("un mecanique frappe plus fort au tour 8 qu'au tour 1",
    avecFigement(true, function () {
      return degatsAjustes(20, "eiffel", "tortuedragon", 8) >
             degatsAjustes(20, "eiffel", "tortuedragon", 1);
    }), true);

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
  verifie("le Figement monte d'un palier par tour et plafonne a 100",
    avecFigement(true, function () {
      var combatAvant = combat;
      combat = { figement: 74 };
      var montee = [];
      for (var t = 0; t < 4; t++) { avancerFigement(); montee.push(combat.figement); }
      combat = combatAvant;
      return montee;
    }), [84, 94, 100, 100]);


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
    collection.komainu, { espece: "komainu", niveau: 7, xp: 0, pv: 72 });

  verifie("xpRequis", [1, 2, 5, 10, 49].map(xpRequis), [26, 40, 82, 152, 698]);
  verifie("gagnerXp (montees de niveau)",
    [gagnerXp("baku", 25), gagnerXp("baku", 500), gagnerXp("inconnu", 10)],
    [0, 7, null]);
  verifie("gagnerXp soigne a la montee",
    collection.baku, { espece: "baku", niveau: 8, xp: 49, pv: 79 });

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


  /* --- Le grimoire : ce qu'il montre du bestiaire ---
     bestiaire() ne touche pas a l'ecran, on peut donc l'appeler
     ici directement. On lui donne une collection connue, et on
     verifie ce qu'il en dit. */

  bloc("Grimoire");

  var collectionAvantG = collection, equipeAvantG = equipe;

  // Grimoire vierge : les seize especes sont la, aucune n'est liee.
  collection = {};
  equipe = [];
  var vierge = bestiaire();

  verifie("un grimoire vierge montre quand meme tout le bestiaire",
    [vierge.lies, vierge.total, vierge.familles.length], [0, 16, 4]);

  verifie("les familles sont dans l'ordre d'especes.js",
    vierge.familles.map(function (f) { return f.famille; }),
    ["temple", "metro", "monument", "parc"]);

  // Chaque famille doit avoir un titre affichable et une couleur.
  var famillesSansLibelle = [];
  vierge.familles.forEach(function (f) {
    if (!LIBELLES_FAMILLE[f.famille]) famillesSansLibelle.push(f.famille + " : sans libelle");
    if (!COULEURS[f.famille]) famillesSansLibelle.push(f.famille + " : sans couleur");
  });
  verifie("chaque famille a un libelle et une couleur", famillesSansLibelle, []);

  /* Une espece presente dans ESPECES mais absente d'ESPECES_PAR_LIEU
     n'apparaitrait dans aucune section : elle serait introuvable
     pour le joueur. C'est le sens inverse du test du bloc
     "Bestiaire", qui verifie que les lieux ne pointent que vers
     des especes connues. */
  var horsGrimoire = Object.keys(ESPECES);
  vierge.familles.forEach(function (f) {
    f.lignes.forEach(function (l) {
      var i = horsGrimoire.indexOf(l.espece);
      if (i !== -1) horsGrimoire.splice(i, 1);
    });
  });
  verifie("aucune espece n'echappe au grimoire", horsGrimoire, []);

  // Une collection connue : trois especes liees, dans trois familles.
  collection = {};
  ajouterAlaCollection("komainu", 7);    // temple
  ajouterAlaCollection("baku", 4);       // metro
  ajouterAlaCollection("vinci", 2);      // monument
  equipe = ["baku"];

  var b = bestiaire();
  verifie("la progression compte les especes liees", [b.lies, b.total], [3, 16]);

  verifie("chaque famille compte les siennes",
    b.familles.map(function (f) { return f.famille + " " + f.lies + "/" + f.total; }),
    ["temple 1/4", "metro 1/4", "monument 1/4", "parc 0/4"]);

  verifie("les especes gardent l'ordre d'especes.js",
    b.familles[0].lignes.map(function (l) { return l.espece; }),
    ["komainu", "chiguo", "sunwukong", "palantir"]);

  verifie("une espece liee porte son niveau",
    b.familles[0].lignes[0], { espece: "komainu", lie: true, niveau: 7, dansEquipe: false });

  verifie("une espece inconnue ne porte aucun niveau",
    b.familles[0].lignes[1], { espece: "chiguo", lie: false, niveau: 0, dansEquipe: false });

  verifie("l'equipe est signalee sur la ligne",
    b.familles[1].lignes[3], { espece: "baku", lie: true, niveau: 4, dansEquipe: true });

  collection = collectionAvantG;
  equipe = equipeAvantG;


  /* --- Le journal de combat : le rythme et l'appui ---

     On remplace l'horloge par une fausse, dont on declenche les
     reveils a la main. Sans ca, impossible de verifier "un appui
     fait avancer d'exactement une ligne" : tout se joue entre deux
     minuteurs. */

  bloc("Journal de combat");

  verifie("le delai par defaut est de 900 ms", DELAI_JOURNAL, 900);

  var vraiSetTimeout = setTimeout, vraiClearTimeout = clearTimeout;
  var reveils = {}, prochainId = 1;

  setTimeout = function (f, delai) {
    reveils[prochainId] = { f: f, delai: delai };
    return prochainId++;
  };
  clearTimeout = function (id) { delete reveils[id]; };

  // Declenche le reveil en attente dont le delai vaut exactement d.
  function sonner(d) {
    for (var id in reveils) {
      if (reveils[id].delai === d) {
        var f = reveils[id].f;
        delete reveils[id];
        f();
        return true;
      }
    }
    return false;
  }

  viderJournal();
  var suiteAppelee = 0;
  raconter(["une", "deux", "trois", "quatre"], function () { suiteAppelee++; });

  verifie("raconter affiche la premiere ligne tout de suite",
    journalVisible.slice(), ["une"]);

  avancerJournal();
  verifie("un appui fait avancer d'une ligne",
    journalVisible.slice(), ["une", "deux"]);

  // Le clic fantome du tactile : deuxieme evenement pour un seul doigt.
  avancerJournal();
  verifie("un deuxieme appui immediat ne consomme rien",
    journalVisible.slice(), ["une", "deux"]);

  sonner(DELAI_APPUI);                    // le verrou se rouvre
  avancerJournal();
  verifie("apres le verrou, l'appui suivant avance d'une seule ligne",
    journalVisible.slice(), ["une", "deux", "trois"]);

  // L'attente normale marche toujours : le minuteur du journal sonne.
  sonner(DELAI_APPUI);
  sonner(DELAI_JOURNAL);
  verifie("sans appui, le journal defile tout seul",
    journalVisible.slice(), ["une", "deux", "trois", "quatre"]);

  verifie("la suite du combat n'a pas encore ete appelee", suiteAppelee, 0);

  sonner(DELAI_JOURNAL);                  // le fil est vide
  verifie("la suite est appelee une fois le fil epuise", suiteAppelee, 1);

  // Fil vide : l'appui ne doit plus rien declencher.
  avancerJournal();
  verifie("un appui sur un journal vide ne rappelle pas la suite", suiteAppelee, 1);

  setTimeout = vraiSetTimeout;
  clearTimeout = vraiClearTimeout;
  viderJournal();


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
