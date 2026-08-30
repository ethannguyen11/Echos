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
  })(), ["conscience", "espece", "fragments", "niveau", "pv", "xp"]);


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
    collection.komainu,
    { espece: "komainu", niveau: 7, xp: 0, pv: 72,
      conscience: 1, fragments: { mince: 0, grand: 0, complet: 0 } });

  verifie("xpRequis", [1, 2, 5, 10, 49].map(xpRequis), [26, 40, 82, 152, 698]);
  verifie("gagnerXp (montees de niveau)",
    [gagnerXp("baku", 25), gagnerXp("baku", 500), gagnerXp("inconnu", 10)],
    [0, 7, null]);
  verifie("gagnerXp soigne a la montee",
    collection.baku,
    { espece: "baku", niveau: 8, xp: 49, pv: 79,
      conscience: 1, fragments: { mince: 0, grand: 0, complet: 0 } });

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


  /* --- Les fragments, la gourde et le savoir --- */

  bloc("Fragments");

  var collAvantF = collection, equipeAvantF = equipe;
  var gourdeAvantF = gourde, savoirAvantF = savoir;

  collection = {};
  equipe = [];
  gourde = {};
  savoir = savoirParDefaut();

  // Une espece inconnue du joueur : le fragment attend en gourde.
  var r1 = donnerFragment("peng", "mince", 3);
  verifie("un fragment d'espece non assimilee va en gourde",
    [r1.ou, r1.recus, r1.perdus, gourde.peng.mince], ["gourde", 3, 0, 3]);

  // La capacite de depart, sans un seul point de savoir.
  verifie("la gourde part a sa capacite de base",
    [pointsDeSavoir(), capaciteGourde()], [0, GOURDE_CAPACITE_BASE]);

  /* Le debordement. On en demande bien plus que la capacite : ce
     qui rentre rentre, le reste est PERDU, et donnerFragment le
     dit. C'est cette valeur qu'une interface devra montrer au
     joueur -- sans elle, il perdrait des fragments sans le
     savoir, ce qui serait le pire des deux mondes. */
  var r2 = donnerFragment("peng", "grand", 99);
  verifie("la gourde deborde, et le dit",
    [r2.recus, r2.perdus, totalFragments(gourde.peng)],
    [GOURDE_CAPACITE_BASE - 3, 99 - (GOURDE_CAPACITE_BASE - 3), GOURDE_CAPACITE_BASE]);

  verifie("une gourde pleine ne prend plus rien",
    donnerFragment("peng", "mince", 1).recus, 0);

  /* Le savoir agrandit la gourde. Trois sources, et le refus des
     doublons : le meme jour ou le meme lieu ne comptent qu'une
     fois, sinon rester chez soi rapporterait autant que sortir. */
  noterCombat(); noterCombat();
  verifie("un jour deja compte ne compte pas deux fois",
    [noterJour("2026-08-30"), noterJour("2026-08-30"), noterJour("2026-08-31")],
    [true, false, true]);
  verifie("un lieu deja visite ne compte pas deux fois",
    [noterLieu("node/1"), noterLieu("node/1"), noterLieu("")],
    [true, false, false]);

  verifie("les points de savoir suivent le bareme",
    pointsDeSavoir(),
    2 * SAVOIR_PAR_COMBAT + 2 * SAVOIR_PAR_JOUR + 1 * SAVOIR_PAR_LIEU);

  verifie("la capacite ne depasse jamais son plafond",
    (function () {
      var vrai = savoir;
      savoir = { combats: 100000, jours: [], lieux: [] };
      var c = capaciteGourde();
      savoir = vrai;
      return c;
    })(), GOURDE_CAPACITE_MAX);

  /* L'espece entre au Grimoire : la gourde se vide dans l'Echo,
     d'un coup, et la place se libere pour une autre espece. */
  var avantAssim = totalFragments(gourde.peng);
  ajouterAlaCollection("peng", 5);
  verifie("l'assimilation vide la gourde dans l'Echo",
    [gourde.peng === undefined, totalFragments(collection.peng.fragments)],
    [true, avantAssim]);

  verifie("un Echo assimile n'a plus de plafond",
    donnerFragment("peng", "mince", 500).perdus, 0);

  /* Un fragment ne sert qu'a SON espece. Komainu peut crouler
     sous les fragments de Peng, il n'en profitera jamais. */
  collection = {};
  gourde = {};
  ajouterAlaCollection("komainu", 5);
  ajouterAlaCollection("baku", 5);
  donnerFragment("komainu", "mince", 8);
  verifie("un fragment ne sert qu'a son espece",
    [collection.komainu.fragments.mince, collection.baku.fragments.mince], [8, 0]);

  /* Les quatre paliers de conscience, dans l'ordre et au prix
     exact. Komainu a ses 8 minces : il passe a 2, et il ne lui
     reste rien. */
  verifie("1 -> 2 : huit minces, exactement",
    [peutMonterConscience("komainu"), monterConscience("komainu"),
     collection.komainu.fragments.mince],
    [true, 2, 0]);

  verifie("le palier suivant se refuse tant qu'il manque une piece",
    [peutMonterConscience("komainu"), monterConscience("komainu")], [false, null]);

  donnerFragment("komainu", "mince", 5);
  donnerFragment("komainu", "grand", 1);
  verifie("manquePourConscience dit ce qui manque encore",
    manquePourConscience("komainu"), { mince: 0, grand: 1, complet: 0 });

  /* Tout ou rien : un paiement partiel laisserait l'Echo sans ses
     fragments et sans son palier. On verifie que le refus ne
     preleve rien du tout. */
  verifie("un refus ne preleve aucun fragment",
    [monterConscience("komainu"), collection.komainu.fragments.mince,
     collection.komainu.fragments.grand],
    [null, 5, 1]);

  donnerFragment("komainu", "grand", 1);
  verifie("2 -> 3 : cinq minces et deux grands",
    [monterConscience("komainu"), collection.komainu.fragments.mince,
     collection.komainu.fragments.grand],
    [3, 0, 0]);

  /* Le dernier passage demande un fragment complet, qui ne tombe
     jamais au combat. Sans lui, l'Echo reste a 3 quel que soit le
     nombre de grands accumules. */
  donnerFragment("komainu", "grand", 3);
  verifie("3 -> 4 se refuse sans le fragment complet",
    [peutMonterConscience("komainu"), manquePourConscience("komainu").complet],
    [false, 1]);

  donnerFragmentComplet("komainu");
  verifie("3 -> 4 : trois grands et un complet",
    [monterConscience("komainu"), collection.komainu.conscience], [4, 4]);

  verifie("le dernier palier n'a rien apres lui",
    [coutConscience(CONSCIENCE_MAX), manquePourConscience("komainu"),
     peutMonterConscience("komainu"), monterConscience("komainu")],
    [null, null, false, null]);

  // Ce qui n'existe pas ne fait rien planter.
  verifie("une espece ou une taille inconnue ne donne rien",
    [donnerFragment("cequinexistepas", "mince", 1).recus,
     donnerFragment("komainu", "enorme", 1).recus,
     manquePourConscience("cequinexistepas"),
     monterConscience("cequinexistepas")],
    [0, 0, null, null]);

  /* --- Le butin de la victoire par KO --- */

  /* Le fragment complet ne tombe JAMAIS au combat : c'est ce qui
     empeche le dernier palier de conscience de s'acheter a la
     sueur. Un bareme qui en contiendrait un ouvrirait la porte
     sans que personne ne s'en apercoive. */
  verifie("aucun fragment complet dans le butin de combat",
    BUTIN_KO.filter(function (b) { return b.taille === "complet"; }), []);

  verifie("chaque entree du bareme est utilisable",
    BUTIN_KO.filter(function (b) {
      return FRAGMENT_TAILLES.indexOf(b.taille) === -1 || !(b.nombre > 0) ||
             !(b.niveauMin >= 0);
    }), []);

  // La liste doit rester triee du plus haut au plus bas : sinon
  // butinDeKo prend la mauvaise entree, sans erreur.
  verifie("le bareme reste trie du plus haut niveau au plus bas",
    (function () {
      for (var i = 1; i < BUTIN_KO.length; i++) {
        if (BUTIN_KO[i].niveauMin >= BUTIN_KO[i - 1].niveauMin) return "desordre en " + i;
      }
      return "trie";
    })(), "trie");

  verifie("le dernier recours du bareme attrape le niveau 0",
    BUTIN_KO[BUTIN_KO.length - 1].niveauMin, 0);

  verifie("butinDeKo suit le niveau du vaincu",
    [1, 5, 6, 11, 12, 24, 25, 60].map(function (n) {
      var b = butinDeKo(n);
      return b.nombre + " " + b.taille;
    }),
    [1, 5, 6, 11, 12, 24, 25, 60].map(function (n) {
      for (var i = 0; i < BUTIN_KO.length; i++) {
        if (n >= BUTIN_KO[i].niveauMin) return BUTIN_KO[i].nombre + " " + BUTIN_KO[i].taille;
      }
    }));

  // Un niveau absurde ne doit pas rendre undefined.
  verifie("un niveau absurde retombe sur la derniere entree",
    [!!butinDeKo(-5), !!butinDeKo("trois"), !!butinDeKo(undefined)],
    [true, true, true]);


  /* --- Les libelles --- */

  verifie("un fragment se dit au singulier, deux au pluriel",
    [libelleFragments("mince", 1), libelleFragments("mince", 3),
     libelleFragments("grand", 1), libelleFragments("grand", 2),
     libelleFragments("complet", 1), libelleFragments("inconnue", 1)],
    ["1 fragment mince", "3 fragments minces",
     "1 grand fragment", "2 grands fragments",
     "1 fragment complet", ""]);

  verifie("un sac se dit d'une seule phrase, sans les tailles vides",
    [libelleSac({ mince: 0, grand: 0, complet: 0 }),
     libelleSac({ mince: 3, grand: 0, complet: 0 }),
     libelleSac({ mince: 3, grand: 1, complet: 0 }),
     libelleSac({ mince: 2, grand: 1, complet: 1 })],
    ["",
     "3 fragments minces",
     "3 fragments minces et 1 grand fragment",
     "2 fragments minces, 1 grand fragment et 1 fragment complet"]);


  /* --- Ce que le journal dit du butin ---

     lignesButin est la seule chose que le joueur verra de tout ce
     systeme tant qu'il n'y a pas d'interface. On verifie donc le
     TEXTE, pas seulement les nombres : une ligne qui ne dit pas ou
     partent les fragments serait un bug a part entiere. */

  var combatAvantB = combat;
  collection = {};
  equipe = [];
  gourde = {};
  savoir = savoirParDefaut();

  // figement fixe : niveauAdversaire devient previsible.
  var donjonKo = { id: "node/ko", espece: "peng", niveau: 4, figement: 0 };
  var niveauKo = niveauAdversaire(donjonKo);
  var butinKo = butinDeKo(niveauKo);

  // Espece inconnue : le butin part en gourde, et le journal le dit.
  var journalGourde = lignesButin(donjonKo);
  verifie("KO d'une espece inconnue : le journal annonce la gourde",
    [journalGourde.length >= 2,
     journalGourde[0].indexOf(libelleFragments(butinKo.taille, butinKo.nombre)) !== -1,
     journalGourde[0].indexOf(ESPECES.peng.nom) !== -1,
     journalGourde[1].indexOf("gourde") !== -1,
     totalFragments(gourde.peng)],
    [true, true, true, true, butinKo.nombre]);

  // Espece assimilee : le butin va droit a l'Echo, et le journal
  // ne parle plus de gourde du tout.
  gourde = {};
  ajouterAlaCollection("peng", 4);
  var journalEcho = lignesButin(donjonKo);
  verifie("KO d'une espece assimilee : le journal annonce l'Echo",
    [journalEcho[1].indexOf("Écho") !== -1,
     journalEcho[1].indexOf("gourde") === -1,
     collection.peng.fragments[butinKo.taille]],
    [true, true, butinKo.nombre]);

  /* Gourde pleine : le joueur perd quelque chose. C'est le seul
     endroit du jeu ou ca arrive, et il faut que le journal le
     dise. */
  collection = {};
  gourde = {};
  donnerFragment("peng", "mince", GOURDE_CAPACITE_BASE);
  var journalPerte = lignesButin(donjonKo);
  verifie("gourde pleine : la perte est annoncee au joueur",
    [journalPerte.length, journalPerte[journalPerte.length - 1].indexOf("se perd") !== -1,
     totalFragments(gourde.peng)],
    [1, true, GOURDE_CAPACITE_BASE]);

  combat = combatAvantB;

  collection = collAvantF;
  equipe = equipeAvantF;
  gourde = gourdeAvantF;
  savoir = savoirAvantF;


  /* --- Le grimoire : ce qu'il montre du bestiaire ---
     bestiaire() ne touche pas a l'ecran, on peut donc l'appeler
     ici directement. On lui donne une collection connue, et on
     verifie ce qu'il en dit. */

  bloc("Grimoire");

  /* La gourde et le savoir sont remis a neuf comme la collection :
     bestiaire() lit maintenant la capacite de la gourde, et cette
     capacite depend du savoir. Sans ce garde-fou, ces tests
     dependraient de l'ordre dans lequel les blocs precedents ont
     tourne. */
  var collectionAvantG = collection, equipeAvantG = equipe;
  var gourdeAvantG = gourde, savoirAvantG = savoir;
  gourde = {};
  savoir = savoirParDefaut();

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

  /* Ces trois-la comparent la LIGNE ENTIERE, exprès : c'est le
     seul endroit qui fige la forme de ce que bestiaire() rend, et
     un champ ajoute sans y penser se voit ici. */
  var sacVide = { mince: 0, grand: 0, complet: 0 };
  var premierPalier = { mince: 8, grand: 0, complet: 0 };

  verifie("une espece liee porte son niveau",
    b.familles[0].lignes[0],
    { espece: "komainu", lie: true, niveau: 7, dansEquipe: false,
      conscience: 1, fragments: sacVide, manque: premierPalier,
      enGourde: 0, capacite: GOURDE_CAPACITE_BASE });

  verifie("une espece inconnue ne porte aucun niveau",
    b.familles[0].lignes[1],
    { espece: "chiguo", lie: false, niveau: 0, dansEquipe: false,
      conscience: 0, fragments: sacVide, manque: null,
      enGourde: 0, capacite: GOURDE_CAPACITE_BASE });

  verifie("l'equipe est signalee sur la ligne",
    b.familles[1].lignes[3],
    { espece: "baku", lie: true, niveau: 4, dansEquipe: true,
      conscience: 1, fragments: sacVide, manque: premierPalier,
      enGourde: 0, capacite: GOURDE_CAPACITE_BASE });


  /* --- Ce que le grimoire dit des fragments --- */

  /* Un Echo qui a de quoi monter, et un autre qui n'a rien : les
     deux lignes doivent se lire d'un coup d'oeil sans qu'on ait a
     compter soi-meme ce qui manque. */
  collection = {};
  equipe = [];
  gourde = {};
  ajouterAlaCollection("komainu", 7);
  donnerFragment("komainu", "mince", 3);

  var bf = bestiaire();
  var ligneKomainu = bf.familles[0].lignes[0];

  verifie("une ligne liee porte sa conscience et ses fragments",
    [ligneKomainu.conscience, ligneKomainu.fragments.mince, ligneKomainu.enGourde],
    [1, 3, 0]);

  verifie("une ligne liee dit ce qui manque pour le palier suivant",
    ligneKomainu.manque, { mince: 5, grand: 0, complet: 0 });

  // Palier atteint : le manque tombe a zero, mais reste un sac.
  donnerFragment("komainu", "mince", 5);
  verifie("un palier reuni se signale par un manque a zero",
    totalFragments(bestiaire().familles[0].lignes[0].manque), 0);

  /* Dernier palier : manque vaut null et non un sac vide. C'est ce
     qui distingue "il ne manque rien" de "il n'y a plus rien
     apres", et l'affichage ne dit pas la meme chose des deux. */
  collection.komainu.conscience = CONSCIENCE_MAX;
  verifie("au dernier palier, il n'y a plus de manque du tout",
    bestiaire().familles[0].lignes[0].manque, null);

  /* Une espece jamais assimilee dont la gourde garde quelque
     chose. C'est le seul cas ou une ligne inconnue dit plus que
     sa silhouette. */
  collection = {};
  equipe = [];
  gourde = {};
  donnerFragment("chiguo", "mince", 2);
  donnerFragment("chiguo", "grand", 1);

  var ligneChiguo = bestiaire().familles[0].lignes[1];
  verifie("une ligne inconnue porte l'etat de la gourde",
    [ligneChiguo.lie, ligneChiguo.conscience, ligneChiguo.enGourde,
     ligneChiguo.capacite, ligneChiguo.manque],
    [false, 0, 3, GOURDE_CAPACITE_BASE, null]);

  /* Le texte, et pas seulement les nombres : une ligne inconnue ne
     doit JAMAIS laisser filtrer le nom de l'espece, meme quand
     elle annonce la gourde. C'est la regle du grimoire depuis le
     depart, et les fragments ne lui font pas exception. */
  var htmlChiguo = ligneInconnue(ligneChiguo);
  verifie("la ligne inconnue annonce la gourde sans rien nommer",
    [htmlChiguo.indexOf("gourde") !== -1,
     htmlChiguo.indexOf("3 / " + GOURDE_CAPACITE_BASE) !== -1,
     htmlChiguo.indexOf(ESPECES.chiguo.nom) !== -1,
     htmlChiguo.indexOf("data-espece") !== -1],
    [true, true, false, false]);

  // Sans rien en gourde, la silhouette reste muette comme avant.
  gourde = {};
  var htmlMuet = ligneInconnue(bestiaire().familles[0].lignes[1]);
  verifie("une silhouette sans gourde ne dit toujours rien de plus",
    [htmlMuet.indexOf("gourde") !== -1, htmlMuet.indexOf("fragments") !== -1],
    [false, false]);

  /* Les trois etats de la ligne "manque", dans le texte affiche.
     Ce sont trois phrases differentes parce que ce sont trois
     situations differentes pour le joueur. */
  verifie("les trois etats du palier se disent differemment",
    [blocConscience({ conscience: 1, fragments: fragmentsVides(),
                      manque: { mince: 8, grand: 0, complet: 0 } }).indexOf("Il manque") !== -1,
     blocConscience({ conscience: 2, fragments: fragmentsVides(),
                      manque: fragmentsVides() }).indexOf("réuni") !== -1,
     blocConscience({ conscience: CONSCIENCE_MAX, fragments: fragmentsVides(),
                      manque: null }).indexOf("Pleinement") !== -1],
    [true, true, true]);

  // Un Echo sans le moindre fragment ne montre pas une ligne vide.
  verifie("aucun fragment se dit, plutot que de laisser un blanc",
    blocConscience({ conscience: 1, fragments: fragmentsVides(),
                     manque: { mince: 8, grand: 0, complet: 0 } })
      .indexOf("Aucun fragment") !== -1, true);

  // Les pastilles suivent le palier : ni plus, ni moins.
  verifie("les pastilles dessinees suivent le palier",
    [1, 2, CONSCIENCE_MAX].map(function (c) {
      return (paliersDessines(c).match(/acquis/g) || []).length;
    }), [1, 2, CONSCIENCE_MAX]);

  collection = collectionAvantG;
  equipe = equipeAvantG;
  gourde = gourdeAvantG;
  savoir = savoirAvantG;


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


  /* --- Les affinites : les noms affiches et ce que dit le journal ---

     Les noms visibles sont Pierre, Flamme et Brume. Les CLES
     internes restent matiere, recit et oubli : elles sont ecrites
     dans les seize especes et dans la sauvegarde. Ce bloc verifie
     que le renommage n'a touche QUE l'affichage. */

  bloc("Affinites");

  verifie("les trois noms affiches",
    [LIBELLES_AFFINITE.matiere, LIBELLES_AFFINITE.recit, LIBELLES_AFFINITE.oubli],
    ["Pierre", "Flamme", "Brume"]);

  verifie("les cles internes n'ont pas bouge",
    Object.keys(AFFINITE_BAT).sort(), ["matiere", "oubli", "recit"]);

  verifie("le cycle n'a pas bouge",
    [AFFINITE_BAT.matiere, AFFINITE_BAT.recit, AFFINITE_BAT.oubli],
    ["recit", "oubli", "matiere"]);

  verifie("les multiplicateurs n'ont pas bouge",
    [AFFINITE_AVANTAGE, AFFINITE_NEUTRE, AFFINITE_DESAVANTAGE],
    [1.3, 1.0, 0.85]);

  // Chaque espece doit porter une cle connue, et chaque cle un nom.
  var affinitesOrphelines = [];
  for (var idA in ESPECES) {
    var aff = ESPECES[idA].affinite;
    if (!LIBELLES_AFFINITE[aff]) affinitesOrphelines.push(idA + " : " + aff + " sans libelle");
    if (!COULEURS_AFFINITE[aff]) affinitesOrphelines.push(idA + " : " + aff + " sans couleur");
  }
  verifie("chaque espece a un nom d'affinite et une couleur", affinitesOrphelines, []);

  // La pastille affiche le nom, jamais la cle.
  verifie("la pastille porte le nom affiche",
    pastilleAffinite("komainu").indexOf(">Pierre<") !== -1, true);

  /* La mention du journal : le TEXTE decrit le coup, la COULEUR dit
     qui en profite. Les deux se croisent quand c'est l'adversaire
     qui frappe, et c'est tout l'interet du correctif.

     komainu est Pierre, sunwukong est Flamme : Pierre etouffe
     Flamme. */
  function mention(attaquant, cible, joueurAttaque) {
    var html = mentionAffinite(attaquant, cible, joueurAttaque);
    if (!html) return "rien";
    var classe = html.indexOf("affinite-plus") !== -1 ? "vert" : "orange";
    var texte = html.replace(/<[^>]+>/g, "").trim();
    return classe + " / " + texte;
  }

  verifie("le joueur frappe avec l'avantage : vert",
    mention("komainu", "sunwukong", true), "vert / Coup renforcé.");

  verifie("le joueur frappe avec le desavantage : orange",
    mention("sunwukong", "komainu", true), "orange / Coup atténué.");

  verifie("l'adversaire frappe avec l'avantage : ORANGE",
    mention("komainu", "sunwukong", false), "orange / Coup renforcé.");

  verifie("l'adversaire frappe avec le desavantage : VERT",
    mention("sunwukong", "komainu", false), "vert / Coup atténué.");

  verifie("affinite neutre : aucune mention",
    [mention("komainu", "eiffel", true), mention("komainu", "eiffel", false)],
    ["rien", "rien"]);

  // Le journal ne doit plus jamais enoncer la regle.
  verifie("la mention ne nomme plus les affinites",
    [mentionAffinite("komainu", "sunwukong", true).indexOf("Pierre"),
     mentionAffinite("komainu", "sunwukong", true).indexOf("domine")],
    [-1, -1]);


  /* --- Ico : la couche reference --- */

  bloc("Ico");

  verifie("sept sections de reference", TEXTES_ICO_REFERENCE.length, 7);

  verifie("les sections, dans l'ordre",
    TEXTES_ICO_REFERENCE.map(function (s) { return s.cle; }),
    ["monde", "combat", "affinites", "assimilation", "aptitudes", "grimoire", "progression"]);

  /* LA REGLE CENTRALE : la couche reference est complete des le
     premier lancement. Aucune section ne porte de condition, de
     seuil ni de palier, et aucune n'est vide. */
  var sectionsFautives = [];
  TEXTES_ICO_REFERENCE.forEach(function (s) {
    if (s.condition !== undefined || s.palier !== undefined || s.seuil !== undefined) {
      sectionsFautives.push(s.cle + " : conditionnee");
    }
    if (!s.titre) sectionsFautives.push(s.cle + " : sans titre");

    var lignes = s.dynamique ? (s.avant || []).concat(s.apres || []) : s.lignes;
    if (!lignes || lignes.length === 0) sectionsFautives.push(s.cle + " : sans texte");
  });
  verifie("la couche reference ne debloque rien", sectionsFautives, []);

  verifie("une seule section se calcule",
    TEXTES_ICO_REFERENCE.filter(function (s) { return s.dynamique; })
                        .map(function (s) { return s.cle; }),
    ["progression"]);

  // Tout passe par formater() : ni {nom} ni accord ne doit rester.
  var restesIco = [];
  TEXTES_ICO_REFERENCE.forEach(function (s) {
    var lignes = s.dynamique ? s.avant.concat(s.apres) : s.lignes;
    lignes.forEach(function (l) {
      var t = Intro.formater(l, { nom: "Ethan", genre: "f", voie: "archiviste" });
      if (/\{[a-z]+\}/.test(t)) restesIco.push(s.cle + " : " + l);
      if (/\[[^\[\]]*\|[^\[\]]*\|[^\[\]]*\]/.test(t)) restesIco.push(s.cle + " : accord non resolu");
    });
  });
  verifie("aucun {nom} ni accord oublie", restesIco, []);

  /* ICO DIT TOUJOURS LA VERITE SUR LES MECANIQUES.

     Son texte annonce ces nombres-la, mot pour mot : "trente pour
     cent plus fort", "part de trente", "jamais zero, jamais cent",
     "trois tours a revenir", "niveau 5, 10, 15", "moitie moins",
     "trois Echos", "seize especes".

     Si un de ces nombres change, ce test passe au rouge : c'est le
     signal qu'il faut RELIRE TEXTES_ICO_REFERENCE, pas corriger le
     test. Une seule ligne fausse dans la couche reference detruit
     la confiance sur laquelle repose tout le personnage. */
  verifie("les nombres qu'Ico annonce sont ceux du jeu",
    [AFFINITE_AVANTAGE, ASSIMILATION_SOCLE, ASSIMILATION_MIN, ASSIMILATION_MAX,
     APTITUDE_RECHARGE, APTITUDE_NIVEAUX.join("/"), DEFENDRE_REDUCTION,
     EQUIPE_MAX, Object.keys(ESPECES).length],
    [1.3, 30, 5, 95, 3, "5/10/15", 0.5, 3, 16]);

  // Et le desavantage doit rester moins fort que l'avantage :
  // "tu perds moins que ce que tu gagnes dans l'autre sens".
  verifie("perdre coute moins que gagner ne rapporte",
    (AFFINITE_NEUTRE - AFFINITE_DESAVANTAGE) < (AFFINITE_AVANTAGE - AFFINITE_NEUTRE), true);

  /* Le palier de defigement suit experienceDuGardien(), donc le
     nombre d'especes distinctes. On fabrique des collections de
     taille croissante et on lit le palier. */
  var collectionAvantIco = collection;

  function collectionDe(n) {
    var c = {};
    Object.keys(ESPECES).slice(0, n).forEach(function (id) {
      c[id] = { espece: id, niveau: 1, xp: 0, pv: 1 };
    });
    return c;
  }

  var paliersLus = [];
  [0, 1, 2, 3, 4, 6, 7, 9, 10, 13, 14, 16].forEach(function (n) {
    collection = collectionDe(n);
    paliersLus.push(n + "->" + Ico.palier());
  });
  collection = collectionAvantIco;

  verifie("le palier suit le nombre d'especes distinctes", paliersLus,
    ["0->0", "1->0", "2->1", "3->1", "4->2", "6->2",
     "7->3", "9->3", "10->4", "13->4", "14->5", "16->5"]);


  /* --- Ico : la couche identite --- */

  bloc("Ico : identite");

  verifie("six fragments, un par palier",
    TEXTES_ICO_IDENTITE.map(function (f) { return f.palier; }),
    [0, 1, 2, 3, 4, 5]);

  var fragMalFormes = [];
  TEXTES_ICO_IDENTITE.forEach(function (f) {
    if (!f.titre) fragMalFormes.push("palier " + f.palier + " : sans titre");
    if (!f.lignes || f.lignes.length < 4) fragMalFormes.push("palier " + f.palier + " : moins de 4 lignes");
    if (f.lignes && f.lignes.length > 6) fragMalFormes.push("palier " + f.palier + " : plus de 6 lignes");

    f.lignes.forEach(function (l) {
      var t = Intro.formater(l, { nom: "Ethan", genre: "f", voie: "gardien" });
      if (/\{[a-z]+\}/.test(t)) fragMalFormes.push("palier " + f.palier + " : {nom} oublie");
    });
  });
  verifie("quatre a six lignes par fragment, aucun {nom} oublie", fragMalFormes, []);

  /* LE MENSONGE PAR OMISSION. La couche reference affirme trois
     choses sur le Figement qui ne sont vraies qu'en surface. Le
     dernier fragment doit les dementir : si quelqu'un reecrit l'un
     sans l'autre, la revelation tombe a plat. */
  var revelation = TEXTES_ICO_IDENTITE[5].lignes.join(" ");
  var monde = TEXTES_ICO_REFERENCE[0].lignes.join(" ");
  verifie("la reference dit 'maladie ancienne', le fragment 5 la dement",
    [monde.indexOf("maladie ancienne") !== -1,
     revelation.indexOf("n'est pas une maladie ancienne") !== -1],
    [true, true]);
  verifie("'quelqu'un a voulu bien faire' trouve sa reponse",
    [monde.indexOf("Quelqu'un a voulu bien faire") !== -1,
     revelation.indexOf("C'est mon travail") !== -1],
    [true, true]);

  /* Les fragments se debloquent, la reference JAMAIS. C'est la
     regle de conception centrale : on la verifie ici. */
  var collAvantFrag = collection;
  var icoAvantFrag = suiviIco;
  suiviIco = { didacticiensVus: [], palierLu: 0, palierAtteint: 0 };

  var obtenusParPalier = [];
  [0, 2, 4, 7, 10, 14].forEach(function (n) {
    collection = collectionDe(n);
    obtenusParPalier.push(Ico.fragmentsObtenus().length);
  });
  verifie("les fragments se debloquent un par un", obtenusParPalier, [1, 2, 3, 4, 5, 6]);

  collection = collectionDe(0);
  verifie("le fragment 0 est lisible des le depart",
    Ico.fragmentsObtenus()[0].palier, 0);

  // Au premier lancement : aucun franchissement, donc aucune pastille.
  suiviIco = { didacticiensVus: [], palierLu: 0, palierAtteint: 0 };
  Ico.majPastille();
  verifie("au depart, pas de pastille",
    [suiviIco.palierAtteint, suiviIco.palierLu], [0, 0]);

  // Deux especes : le palier 1 est franchi, la pastille doit s'allumer.
  collection = collectionDe(2);
  Ico.majPastille();
  verifie("un palier franchi allume la pastille",
    [suiviIco.palierAtteint, suiviIco.palierLu, suiviIco.palierAtteint > suiviIco.palierLu],
    [1, 0, true]);

  // Le palier atteint ne redescend jamais, meme si on relit un vieux fragment.
  collection = collectionDe(10);
  Ico.majPastille();
  verifie("le palier atteint ne fait que monter", suiviIco.palierAtteint, 4);

  collection = collAvantFrag;
  suiviIco = icoAvantFrag;


  /* --- Ico : le didacticiel contextuel ---

     On remplace l'horloge par une fausse, comme pour le journal :
     la file d'attente et les verrous ne se verifient qu'en
     declenchant les reveils a la main. */

  bloc("Ico : didacticiel");

  verifie("sept interventions", TEXTES_ICO_DIDACTICIEL.length, 7);

  var didMalFormes = [], clesDeja = {};
  TEXTES_ICO_DIDACTICIEL.forEach(function (d) {
    if (!d.cle) didMalFormes.push("intervention sans cle");
    if (clesDeja[d.cle]) didMalFormes.push(d.cle + " : cle en double");
    clesDeja[d.cle] = true;

    if (!d.lignes || d.lignes.length === 0) didMalFormes.push(d.cle + " : sans texte");
    // La contrainte tenue par le format : jamais plus de deux lignes.
    if (d.lignes && d.lignes.length > 2) didMalFormes.push(d.cle + " : plus de deux lignes");
  });
  verifie("jamais plus de deux lignes, aucune cle en double", didMalFormes, []);

  var restesDid = [];
  TEXTES_ICO_DIDACTICIEL.forEach(function (d) {
    d.lignes.forEach(function (l) {
      var t = Intro.formater(l, { nom: "Ethan", genre: "f", voie: "gardien" });
      if (/\{[a-z]+\}/.test(t)) restesDid.push(d.cle);
      if (/\[[^\[\]]*\|[^\[\]]*\|[^\[\]]*\]/.test(t)) restesDid.push(d.cle + " : accord non resolu");
    });
  });
  verifie("aucun {nom} ni accord oublie dans le didacticiel", restesDid, []);

  // --- Le comportement ---

  var icoAvant = suiviIco;
  var journalAvant = minuteurJournal;
  var vraiST = setTimeout, vraiCT = clearTimeout;

  var reveilsIco = {}, idIco = 1;
  setTimeout = function (f, delai) {
    reveilsIco[idIco] = { f: f, delai: delai };
    return idIco++;
  };
  clearTimeout = function (id) { delete reveilsIco[id]; };

  function sonnerIco(delai) {
    for (var id in reveilsIco) {
      if (reveilsIco[id].delai === delai) {
        var f = reveilsIco[id].f;
        delete reveilsIco[id];
        f();
        return true;
      }
    }
    return false;
  }

  suiviIco = { didacticiensVus: [], palierLu: 0, palierAtteint: 0 };
  minuteurJournal = null;
  Ico.reinitialiserDidacticiel();

  Ico.dire("grimoire");
  verifie("une intervention s'affiche", Ico.bulleAffichee(), true);

  // Le clic fantome du tactile : deux evenements pour un doigt.
  Ico.surAppui();
  verifie("un appui immediat n'efface pas (clic fantome)", Ico.bulleAffichee(), true);

  Ico.dire("grimoire");
  verifie("une intervention deja jouee ne revient pas", Ico.enAttente(), []);

  Ico.dire("combat");
  verifie("une deuxieme intervention passe en file", Ico.enAttente(), ["combat"]);

  Ico.dire("combat");
  verifie("elle n'entre pas deux fois dans la file", Ico.enAttente(), ["combat"]);

  sonnerIco(ICO_BULLE_VERROU);          // le verrou se rouvre
  Ico.surAppui();
  verifie("l'appui efface, et la suivante prend sa place",
    [Ico.bulleAffichee(), Ico.enAttente()], [true, []]);

  sonnerIco(ICO_BULLE_VERROU);
  Ico.surAppui();
  verifie("file vide : plus rien ne s'affiche", Ico.bulleAffichee(), false);

  /* Le recit du combat passe avant Ico : tant que le journal
     defile, rien ne s'affiche par-dessus. */
  minuteurJournal = 1;
  Ico.dire("victoire");
  verifie("rien ne s'affiche pendant un enchainement de journal",
    [Ico.bulleAffichee(), Ico.enAttente()], [false, ["victoire"]]);

  minuteurJournal = null;               // la main revient au joueur
  sonnerIco(ICO_RELANCE);
  verifie("elle s'affiche des que la main revient au joueur",
    [Ico.bulleAffichee(), Ico.enAttente()], [true, []]);

  // L'effacement automatique, quand le joueur ne touche rien.
  sonnerIco(ICO_BULLE_DUREE);
  verifie("sans appui, elle s'efface d'elle-meme", Ico.bulleAffichee(), false);

  verifie("les interventions jouees sont retenues",
    suiviIco.didacticiensVus.slice().sort(), ["combat", "grimoire", "victoire"]);

  var neuf = Ico.reinitialiserDidacticiel();
  verifie("reinitialiserDidacticiel remet tout a neuf",
    [suiviIco.didacticiensVus, Ico.enAttente(), Ico.bulleAffichee(), typeof neuf],
    [[], [], false, "string"]);

  Ico.dire("grimoire");
  verifie("apres reinitialisation, elles se rejouent", Ico.bulleAffichee(), true);
  sonnerIco(ICO_BULLE_VERROU);
  Ico.surAppui();

  /* LE COMBAT D'ESSAI N'ECRIT RIEN.

     Meme regle que pour l'Echo capture et l'experience gagnee : un
     essai ne laisse aucune trace sur le disque. Ico parle quand
     meme, sinon on ne pourrait pas tester ses interventions ; il
     ne retient simplement rien. */
  var combatAvantIco = combat;
  combat = { donjon: { fictif: true }, fini: false };

  suiviIco = { didacticiensVus: [], palierLu: 0, palierAtteint: 0 };
  Ico.reinitialiserDidacticiel();

  Ico.dire("victoire");
  verifie("combat d'essai : la bulle s'affiche quand meme", Ico.bulleAffichee(), true);
  verifie("combat d'essai : rien n'est ecrit dans le bloc ico",
    suiviIco.didacticiensVus, []);

  sonnerIco(ICO_BULLE_VERROU);
  Ico.surAppui();
  Ico.dire("victoire");
  verifie("combat d'essai : elle ne se repete pas dans le meme essai",
    [Ico.bulleAffichee(), Ico.enAttente()], [false, []]);

  /* Hors essai, la meme intervention s'enregistre bien : sinon le
     test ci-dessus passerait au vert pour une mauvaise raison. */
  combat = null;
  Ico.reinitialiserDidacticiel();
  Ico.dire("victoire");
  verifie("hors essai, elle est bien enregistree",
    suiviIco.didacticiensVus, ["victoire"]);

  sonnerIco(ICO_BULLE_VERROU);
  Ico.surAppui();
  combat = combatAvantIco;

  setTimeout = vraiST;
  clearTimeout = vraiCT;
  suiviIco = icoAvant;
  minuteurJournal = journalAvant;


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

  /* Chaque cle du script existe-t-elle dans TEXTES.fr ?

     Sans ce controle, une faute de frappe dans un cleTexte ne se
     verrait nulle part de facon lisible : txt() rendrait la cle
     elle-meme, et l'intro afficherait "intro.eveil.pasDormi" au
     joueur, sans la moindre erreur. Meme raisonnement que le
     croisement des cles du didacticiel, dans verifier.js. */
  var clesDuScript = [];
  Intro.SCRIPT.forEach(function (e) {
    if (e.cleTexte) clesDuScript.push(e.cleTexte);
    if (e.options) e.options.forEach(function (o) { clesDuScript.push(o.cleTexte); });
  });

  verifie("chaque cle du script existe dans TEXTES.fr",
    clesDuScript.filter(function (c) { return typeof TEXTES.fr[c] !== "string"; }), []);

  /* Le francais est la langue de repli : une cle qui n'existe QUE
     en anglais n'a pas de filet, et afficherait sa propre cle. */
  verifie("aucune cle anglaise orpheline",
    Object.keys(TEXTES.en).filter(function (c) { return typeof TEXTES.fr[c] !== "string"; }), []);

  /* Toutes les lignes du script doivent se formater completement,
     quel que soit le genre : aucun {...} ni [...] ne doit survivre.

     On repasse par txt() plutot que de lire la table, et dans CHAQUE
     langue : c'est le seul moyen de voir un accord [m|f|n] mal
     ecrit dans une traduction. Une cle absente de l'anglais
     retombe sur le francais et se trouve donc verifiee deux fois,
     ce qui est sans danger et se corrigera tout seul le jour ou
     elle sera traduite. */
  var langueAvant = langueCourante();
  var restes = [];

  LANGUES.forEach(function (lg) {
    definirLangue(lg);
    ["m", "f", "n"].forEach(function (g) {
      Intro.SCRIPT.forEach(function (e, i) {
        var cles = [];
        if (e.cleTexte) cles.push(e.cleTexte);
        if (e.options) e.options.forEach(function (o) { cles.push(o.cleTexte); });

        cles.forEach(function (cle) {
          var sortie = f(txt(cle), { genre: g, nom: "Ethan", voie: "archiviste" });
          if (/[[]]/.test(sortie) || /{[a-z]+}/.test(sortie)) {
            restes.push(lg + " " + g + " #" + i + " : " + sortie);
          }
        });
      });
    });
  });

  definirLangue(langueAvant);
  verifie("aucun accord ni {nom} oublie dans tout le script", restes, []);

  // Le moteur ne sait traiter que ces types-la
  var TYPES = ["pause", "recit", "ico", "lieu", "apparition", "saisie",
               "choix", "calculVoie", "echoDepart", "musique", "fin"];
  var malFormees = [];
  Intro.SCRIPT.forEach(function (e, i) {
    if (TYPES.indexOf(e.type) === -1) malFormees.push("#" + i + " type " + e.type);
    if (e.type === "pause" && !(e.duree > 0)) malFormees.push("#" + i + " sans duree");
    if (e.type === "saisie" && (!e.cle || !(e.max > 0))) malFormees.push("#" + i + " saisie incomplete");
    // recit et ico ne portent plus de phrase, seulement une cle.
    if ((e.type === "recit" || e.type === "ico") && !e.cleTexte) {
      malFormees.push("#" + i + " " + e.type + " sans cleTexte");
    }
    if (e.type === "choix") {
      if (!e.cle) malFormees.push("#" + i + " choix sans cle");
      if (!e.options || e.options.length < 2) malFormees.push("#" + i + " choix sans options");
      (e.options || []).forEach(function (o) {
        if (!o.cleTexte || !o.valeur) malFormees.push("#" + i + " option incomplete");
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
