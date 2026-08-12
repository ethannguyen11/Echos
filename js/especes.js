/* ============================================================
   LE BESTIAIRE
   Chaque espece : ses statistiques de base, son trait, sa famille.
   "img" est le nom du fichier : monstres/komainu.png
   ============================================================ */

var ESPECES = {
  /* --- TEMPLES --- */
  komainu: {
    img: "komainu", famille: "temple",
    nom: "Komainu", titre: "le Lion Gardien",
    pv: 26, atq: 5, def: 9,
    trait: "Garde du Seuil : annule les degats d'un tour et en renvoie la moitie."
  },
  chiguo: {
    img: "chiguo", famille: "temple",
    nom: "Chi Guo", titre: "Gardien des Terres",
    pv: 23, atq: 4, def: 7,
    trait: "Souffle d'Encens : empoisonne l'adversaire pendant 4 tours."
  },
  sunwukong: {
    img: "sunwukong", famille: "temple",
    nom: "Sun Wukong", titre: "l'Esprit Enchaine",
    pv: 14, atq: 11, def: 2,
    trait: "Bond du Singe : frappe deux fois, mais subit un contrecoup."
  },
  palantir: {
    img: "palantir", famille: "temple",
    nom: "Palantir", titre: "la Sphere de Vide",
    pv: 20, atq: 3, def: 6,
    trait: "Question du Vide : pose une question ; l'echec coute la moitie des PV."
  },

  /* --- METRO --- */
  mechadrill: {
    img: "mechadrill", famille: "metro",
    nom: "Mecha Drill", titre: "la Foreuse",
    pv: 31, atq: 8, def: 6,
    trait: "Percee : charge un tour, puis frappe au triple."
  },
  teketeke: {
    img: "teketeke", famille: "metro",
    nom: "Teke Teke", titre: "l'Onryo",
    pv: 16, atq: 7, def: 3,
    trait: "Rampe : trois frappes qui ignorent la defense."
  },
  zhanxiyuan: {
    img: "zhanxiyuan", famille: "metro",
    nom: "Zhan Xiyuan", titre: "l'Inventeur",
    pv: 19, atq: 5, def: 5,
    trait: "Aiguillage : l'adversaire saute son prochain tour."
  },
  baku: {
    img: "baku", famille: "metro",
    nom: "Baku", titre: "le Mange-Reve",
    pv: 23, atq: 6, def: 4,
    trait: "Devorer : vole des PV a l'adversaire."
  },

  /* --- MONUMENTS --- */
  eiffel: {
    img: "eiffel", famille: "monument",
    nom: "Eiffel", titre: "l'Architecte",
    pv: 24, atq: 5, def: 7,
    trait: "Charpente : la defense monte a chaque tour."
  },
  tortuedragon: {
    img: "tortuedragon", famille: "monument",
    nom: "Tortue Dragon", titre: "le Maitre des Fondations",
    pv: 29, atq: 6, def: 9,
    trait: "Ancrage : renonce a fuir, mais double ses degats."
  },
  hephaistos: {
    img: "hephaistos", famille: "monument",
    nom: "Hephaiston", titre: "le Marteau",
    pv: 22, atq: 7, def: 6,
    trait: "Enclume : rend d'un coup tout ce qu'il a encaisse."
  },
  vinci: {
    img: "vinci", famille: "monument",
    nom: "Vinci", titre: "le Savoir",
    pv: 18, atq: 8, def: 3,
    trait: "Mesure : ses coups ignorent la defense pendant 3 tours."
  },

  /* --- PARCS --- */
  hinezumi: {
    img: "hinezumi", famille: "parc",
    nom: "Hinezumi", titre: "le Rat de Feu",
    pv: 18, atq: 6, def: 3,
    trait: "Robe de Flammes : brulure qui s'aggrave chaque tour."
  },
  penghou: {
    img: "penghou", famille: "parc",
    nom: "Penghou", titre: "le Chien",
    pv: 21, atq: 4, def: 5,
    trait: "Seve : regenere des PV a chaque tour."
  },
  peng: {
    img: "peng", famille: "parc",
    nom: "Peng", titre: "l'Oiseau Colossal",
    pv: 20, atq: 7, def: 4,
    trait: "Envol : esquive garantie, puis contre-attaque."
  },
  jinchan: {
    img: "jinchan", famille: "parc",
    nom: "Jin Chan", titre: "le Crapaud",
    pv: 17, atq: 4, def: 3,
    trait: "Fortune : double les points d'echo gagnes."
  }
};

// Les quatre especes possibles par type de lieu
var ESPECES_PAR_LIEU = {
  temple:   ["komainu", "chiguo", "sunwukong", "palantir"],
  metro:    ["mechadrill", "teketeke", "zhanxiyuan", "baku"],
  monument: ["eiffel", "tortuedragon", "hephaistos", "vinci"],
  parc:     ["hinezumi", "penghou", "peng", "jinchan"]
};

// Statistiques d'un Echo a un niveau donne
function statsAuNiveau(especeId, niveau) {
  var e = ESPECES[especeId];
  var f = 1 + (niveau - 1) * 0.26;
  return {
    pvMax: Math.round(e.pv * f),
    atq:   Math.round(e.atq * f),
    def:   Math.round(e.def * f)
  };
}
