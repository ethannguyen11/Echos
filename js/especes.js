/* ============================================================
   LE BESTIAIRE
   Chaque espece : ses statistiques de base, son trait, sa famille.
   "img" est le nom du fichier : monstres/komainu.png
   ============================================================ */

var ESPECES = {
  /* --- TEMPLES --- */
  komainu: {
    img: "komainu", famille: "temple",
    affinite: "matiere", nature: "organique",
    rang: "A", aptitudes: ["rempart", "sceau", "fissure"],
    nom: "Komainu", titre: "le Lion Gardien",
    pv: 28, atq: 6, def: 6,
    trait: "Garde du Seuil : annule les dégâts d'un tour et en renvoie la moitié."
  },
  chiguo: {
    img: "chiguo", famille: "temple",
    affinite: "matiere", nature: "hybride",
    rang: "C", aptitudes: ["sceau", "appel", "rempart"],
    nom: "Chi Guo", titre: "Gardien des Terres",
    pv: 23, atq: 5, def: 5,
    trait: "Souffle d'Encens : empoisonne l'adversaire pendant 4 tours."
  },
  sunwukong: {
    img: "sunwukong", famille: "temple",
    affinite: "recit", nature: "organique",
    rang: "B", aptitudes: ["doubleFrappe", "percee", "frappeLourde"],
    nom: "Sun Wukong", titre: "l'Esprit Enchaîné",
    pv: 22, atq: 9, def: 3,
    trait: "Bond du Singe : frappe deux fois, mais subit un contrecoup."
  },
  palantir: {
    img: "palantir", famille: "temple",
    affinite: "recit", nature: "mecanique",
    rang: "D", aptitudes: ["sceau", "fissure", "percee"],
    nom: "Palantir", titre: "la Sphère de Vide",
    pv: 19, atq: 5, def: 5,
    trait: "Question du Vide : pose une question ; l'échec coûte la moitié des PV."
  },

  /* --- METRO --- */
  mechadrill: {
    img: "mechadrill", famille: "metro",
    affinite: "matiere", nature: "mecanique",
    rang: "S", aptitudes: ["fissure", "rempart", "frappeLourde"],
    nom: "Mecha Drill", titre: "la Foreuse",
    pv: 29, atq: 8, def: 5,
    trait: "Percée : charge un tour, puis frappe au triple."
  },
  teketeke: {
    img: "teketeke", famille: "metro",
    affinite: "oubli", nature: "mecanique",
    rang: "C", aptitudes: ["fissure", "doubleFrappe", "frappeLourde"],
    nom: "Teke Teke", titre: "l'Onryo",
    pv: 18, atq: 7, def: 3,
    trait: "Rampe : trois frappes qui ignorent la défense."
  },
  zhanxiyuan: {
    img: "zhanxiyuan", famille: "metro",
    affinite: "oubli", nature: "hybride",
    rang: "C", aptitudes: ["sceau", "appel", "fissure"],
    nom: "Zhan Xiyuan", titre: "l'Inventeur",
    pv: 21, atq: 6, def: 4,
    trait: "Aiguillage : l'adversaire saute son prochain tour."
  },
  baku: {
    img: "baku", famille: "metro",
    affinite: "oubli", nature: "organique",
    rang: "B", aptitudes: ["seve", "sceau", "appel"],
    nom: "Baku", titre: "le Mange-Rêve",
    pv: 28, atq: 7, def: 4,
    trait: "Dévorer : vole des PV à l'adversaire."
  },

  /* --- MONUMENTS --- */
  eiffel: {
    img: "eiffel", famille: "monument",
    affinite: "matiere", nature: "mecanique",
    rang: "B", aptitudes: ["rempart", "sceau", "frappeLourde"],
    nom: "Eiffel", titre: "l'Architecte",
    pv: 29, atq: 6, def: 5,
    trait: "Charpente : la défense monte à chaque tour."
  },
  tortuedragon: {
    img: "tortuedragon", famille: "monument",
    affinite: "matiere", nature: "organique",
    rang: "S", aptitudes: ["rempart", "frappeLourde", "seve"],
    nom: "Tortue Dragon", titre: "le Maître des Fondations",
    pv: 30, atq: 7, def: 6,
    trait: "Ancrage : renonce à fuir, mais double ses dégâts."
  },
  hephaistos: {
    img: "hephaistos", famille: "monument",
    affinite: "matiere", nature: "mecanique",
    rang: "A", aptitudes: ["rempart", "fissure", "frappeLourde"],
    nom: "Héphaïstos", titre: "le Marteau",
    pv: 26, atq: 8, def: 5,
    trait: "Enclume : rend d'un coup tout ce qu'il a encaissé."
  },
  vinci: {
    img: "vinci", famille: "monument",
    affinite: "recit", nature: "mecanique",
    rang: "C", aptitudes: ["fissure", "doubleFrappe", "percee"],
    nom: "Vinci", titre: "le Savoir",
    pv: 20, atq: 8, def: 3,
    trait: "Mesure : ses coups ignorent la défense pendant 3 tours."
  },

  /* --- PARCS --- */
  hinezumi: {
    img: "hinezumi", famille: "parc",
    affinite: "recit", nature: "organique",
    rang: "D", aptitudes: ["doubleFrappe", "fissure", "percee"],
    nom: "Hinezumi", titre: "le Rat de Feu",
    pv: 17, atq: 7, def: 3,
    trait: "Robe de Flammes : brûlure qui s'aggrave chaque tour."
  },
  penghou: {
    img: "penghou", famille: "parc",
    affinite: "oubli", nature: "organique",
    rang: "D", aptitudes: ["seve", "rempart", "appel"],
    nom: "Penghou", titre: "le Chien",
    pv: 21, atq: 5, def: 4,
    trait: "Sève : régénère des PV à chaque tour."
  },
  peng: {
    img: "peng", famille: "parc",
    affinite: "recit", nature: "organique",
    rang: "B", aptitudes: ["percee", "sceau", "frappeLourde"],
    nom: "Peng", titre: "l'Oiseau Colossal",
    pv: 27, atq: 7, def: 4,
    trait: "Envol : esquive garantie, puis contre-attaque."
  },
  jinchan: {
    img: "jinchan", famille: "parc",
    affinite: "recit", nature: "hybride",
    rang: "D", aptitudes: ["appel", "seve", "sceau"],
    nom: "Jin Chan", titre: "le Crapaud",
    pv: 20, atq: 6, def: 4,
    trait: "Fortune : double les points d'écho gagnés."
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
