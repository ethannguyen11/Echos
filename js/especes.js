/* ============================================================
   LE BESTIAIRE
   Chaque espece : ses statistiques de base, son trait, sa famille.

   "image" est le nom complet du fichier, extension comprise :
   monstres/komainu.png. Voir monstres/LISEZMOI.md pour la
   convention de nommage et le format attendu.

   C'est une propriete de l'ESPECE, jamais de l'Echo possede :
   elle n'entre pas dans la sauvegarde. normaliserCollection()
   ne recopie que espece / niveau / xp / pv, plus la conscience et
   les fragments depuis la v5.

   "chapitre" (1 a CHAPITRE_MAX) dit a partir de quand l'espece
   peut apparaitre dans un lieu. Un lieu ne tire que parmi les
   especes des chapitres atteints ou inferieurs : c'est ce qui
   permet d'ouvrir le monde par paliers plutot que de tout
   montrer au premier pas.

   Le filtre lui-meme est dans js/lieux.js (especesDuChapitre).
   Ici, ce n'est qu'une etiquette.
   ============================================================ */

var ESPECES = {
  /* --- TEMPLES --- */
  komainu: {
    image: "komainu.png", famille: "temple", chapitre: 1,
    affinite: "matiere", nature: "organique",
    rang: "A", aptitudes: ["rempart", "sceau", "fissure"],
    nom: "Komainu", titre: "le Lion Gardien",
    pv: 28, atq: 6, def: 6,
    trait: "Garde du Seuil : annule les dégâts d'un tour et en renvoie la moitié."
  },
  chiguo: {
    image: "chiguo.png", famille: "temple", chapitre: 2,
    affinite: "matiere", nature: "hybride",
    rang: "C", aptitudes: ["sceau", "appel", "rempart"],
    nom: "Chi Guo", titre: "Gardien des Terres",
    pv: 23, atq: 5, def: 5,
    trait: "Souffle d'Encens : empoisonne l'adversaire pendant 4 tours."
  },
  sunwukong: {
    image: "sunwukong.png", famille: "temple", chapitre: 4,
    affinite: "recit", nature: "organique",
    rang: "B", aptitudes: ["doubleFrappe", "percee", "frappeLourde"],
    nom: "Sun Wukong", titre: "l'Esprit Enchaîné",
    pv: 22, atq: 9, def: 3,
    trait: "Bond du Singe : frappe deux fois, mais subit un contrecoup."
  },
  palantir: {
    image: "palantir.png", famille: "temple", chapitre: 3,
    affinite: "recit", nature: "mecanique",
    rang: "D", aptitudes: ["sceau", "fissure", "percee"],
    nom: "Palantir", titre: "la Sphère de Vide",
    pv: 19, atq: 5, def: 5,
    trait: "Question du Vide : pose une question ; l'échec coûte la moitié des PV."
  },

  /* --- METRO --- */
  mechadrill: {
    image: "mechadrill.png", famille: "metro", chapitre: 1,
    affinite: "matiere", nature: "mecanique",
    rang: "S", aptitudes: ["fissure", "rempart", "frappeLourde"],
    nom: "Mecha Drill", titre: "la Foreuse",
    pv: 29, atq: 8, def: 5,
    trait: "Percée : charge un tour, puis frappe au triple."
  },
  teketeke: {
    image: "teketeke.png", famille: "metro", chapitre: 2,
    affinite: "oubli", nature: "mecanique",
    rang: "C", aptitudes: ["fissure", "doubleFrappe", "frappeLourde"],
    nom: "Teke Teke", titre: "l'Onryo",
    pv: 18, atq: 7, def: 3,
    trait: "Rampe : trois frappes qui ignorent la défense."
  },
  zhanxiyuan: {
    image: "zhanxiyuan.png", famille: "metro", chapitre: 3,
    affinite: "oubli", nature: "hybride",
    rang: "C", aptitudes: ["sceau", "appel", "fissure"],
    nom: "Zhan Xiyuan", titre: "l'Inventeur",
    pv: 21, atq: 6, def: 4,
    trait: "Aiguillage : l'adversaire saute son prochain tour."
  },
  baku: {
    image: "baku.png", famille: "metro", chapitre: 4,
    affinite: "oubli", nature: "organique",
    rang: "B", aptitudes: ["seve", "sceau", "appel"],
    nom: "Baku", titre: "le Mange-Rêve",
    pv: 28, atq: 7, def: 4,
    trait: "Dévorer : vole des PV à l'adversaire."
  },

  /* --- MONUMENTS --- */
  eiffel: {
    image: "eiffel.png", famille: "monument", chapitre: 1,
    affinite: "matiere", nature: "mecanique",
    rang: "B", aptitudes: ["rempart", "sceau", "frappeLourde"],
    nom: "Eiffel", titre: "l'Architecte",
    pv: 29, atq: 6, def: 5,
    trait: "Charpente : la défense monte à chaque tour."
  },
  tortuedragon: {
    image: "tortuedragon.png", famille: "monument", chapitre: 2,
    affinite: "matiere", nature: "organique",
    rang: "S", aptitudes: ["rempart", "frappeLourde", "seve"],
    nom: "Tortue Dragon", titre: "le Maître des Fondations",
    pv: 30, atq: 7, def: 6,
    trait: "Ancrage : renonce à fuir, mais double ses dégâts."
  },
  hephaistos: {
    image: "hephaistos.png", famille: "monument", chapitre: 3,
    affinite: "matiere", nature: "mecanique",
    rang: "A", aptitudes: ["rempart", "fissure", "frappeLourde"],
    nom: "Héphaïstos", titre: "le Marteau",
    pv: 26, atq: 8, def: 5,
    trait: "Enclume : rend d'un coup tout ce qu'il a encaissé."
  },
  vinci: {
    image: "vinci.png", famille: "monument", chapitre: 4,
    affinite: "recit", nature: "mecanique",
    rang: "C", aptitudes: ["fissure", "doubleFrappe", "percee"],
    nom: "Vinci", titre: "le Savoir",
    pv: 20, atq: 8, def: 3,
    trait: "Mesure : ses coups ignorent la défense pendant 3 tours."
  },

  /* --- PARCS --- */
  hinezumi: {
    image: "hinezumi.png", famille: "parc", chapitre: 2,
    affinite: "recit", nature: "organique",
    rang: "D", aptitudes: ["doubleFrappe", "fissure", "percee"],
    nom: "Hinezumi", titre: "le Rat de Feu",
    pv: 17, atq: 7, def: 3,
    trait: "Robe de Flammes : brûlure qui s'aggrave chaque tour."
  },
  penghou: {
    image: "penghou.png", famille: "parc", chapitre: 1,
    affinite: "oubli", nature: "organique",
    rang: "D", aptitudes: ["seve", "rempart", "appel"],
    nom: "Penghou", titre: "le Chien",
    pv: 21, atq: 5, def: 4,
    trait: "Sève : régénère des PV à chaque tour."
  },
  peng: {
    image: "peng.png", famille: "parc", chapitre: 3,
    affinite: "recit", nature: "organique",
    rang: "B", aptitudes: ["percee", "sceau", "frappeLourde"],
    nom: "Peng", titre: "l'Oiseau Colossal",
    pv: 27, atq: 7, def: 4,
    trait: "Envol : esquive garantie, puis contre-attaque."
  },
  jinchan: {
    image: "jinchan.png", famille: "parc", chapitre: 1,
    affinite: "recit", nature: "hybride",
    rang: "D", aptitudes: ["appel", "seve", "sceau"],
    nom: "Jin Chan", titre: "le Crapaud",
    pv: 20, atq: 6, def: 4,
    trait: "Fortune : double les points d'écho gagnés."
  }
};

// Les quatre especes possibles par type de lieu
/* Les especes de chaque chapitre, DEDUITES du champ chapitre.

   C'est une liste construite et non ecrite a la main : le champ
   sur l'espece reste la seule verite, et il n'y a jamais deux
   endroits a tenir d'accord. Changer un chapitre dans le
   bestiaire ci-dessus suffit.

   { 1: ["komainu", "mechadrill", ...], 2: [...] } */
var ESPECES_PAR_CHAPITRE = (function () {
  var par = {};

  for (var id in ESPECES) {
    var c = ESPECES[id].chapitre;
    if (!par[c]) par[c] = [];
    par[c].push(id);
  }

  return par;
})();

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


/* ------------------------------------------------------------
   LE VISUEL DE SECOURS

   Ce qu'on affiche a la place d'une illustration absente. Ce
   n'est pas un message d'erreur : c'est une silhouette sombre,
   teintee selon l'affinite de l'espece, avec son initiale. Elle
   doit avoir l'air voulue, pas cassee.

   Le secours dit deja quelque chose d'utile : sa couleur annonce
   l'affinite de l'adversaire.

   Trois ecrans s'en servent : le combat, le grimoire et l'Echo de
   depart de la cinematique. Ils passent tous par ici, donc changer
   son allure se fait a un seul endroit.
   ------------------------------------------------------------ */

function secoursDeLEspece(especeId) {
  var e = ESPECES[especeId] || {};
  var affinite = COULEURS_SECOURS[e.affinite] ? e.affinite : "matiere";

  return {
    vif:      COULEURS_AFFINITE[affinite],    // bord et initiale
    fond:     COULEURS_SECOURS[affinite],     // coeur du degrade
    initiale: (e.nom || "?").charAt(0).toUpperCase()
  };
}

// Le style commun aux trois ecrans, en une chaine.
function styleSecours(s) {
  return "background:radial-gradient(circle at 38% 32%," + s.fond + ",#0d0812);" +
         "border-color:" + s.vif + ";color:" + s.vif;
}

/* Pose le secours sur un element qui existe deja dans la page.
   C'est le cas de l'ecran de combat (#monstre-vide). */
function poserSecours(noeud, especeId) {
  if (!noeud) return;
  var s = secoursDeLEspece(especeId);
  noeud.style.background = "radial-gradient(circle at 38% 32%," + s.fond + ",#0d0812)";
  noeud.style.borderColor = s.vif;
  noeud.style.color = s.vif;
  noeud.innerHTML = '<span class="initiale">' + s.initiale + '</span>';
}

/* Rend le secours sous forme de HTML, pour les ecrans qui se
   construisent en chaine de caracteres (grimoire, cinematique). */
function htmlSecours(especeId, classe) {
  var s = secoursDeLEspece(especeId);
  return '<span class="' + classe + '" style="' + styleSecours(s) + '">' +
         '<span class="initiale">' + s.initiale + '</span></span>';
}
