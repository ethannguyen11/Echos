/* ============================================================
   VERIFICATION AVANT COMMIT
   A lancer depuis le dossier du projet :   node verifier.js

   Quatre controles :
     1. chaque fichier .js est syntaxiquement correct ;
     2. le jeu demarre sans erreur (faux navigateur, fausse carte) ;
     3. les formules donnent toujours les memes resultats qu'avant
        le decoupage en modules (verifier/tests.js) ;
     4. tous les identifiants HTML utilises par le JS existent bien.

   Ce script ne touche a rien : il lit les fichiers, c'est tout.
   ============================================================ */

var fs = require("fs");
var vm = require("vm");
var path = require("path");

var RACINE = __dirname;

// Le meme ordre que dans index.html
var FICHIERS = [
  "js/config.js",
  "js/especes.js",
  "js/lieux.js",
  "js/carte.js",
  "js/joueur.js",
  "js/combat.js",
  "js/grimoire.js",
  "js/jeu.js"
];

// Couleurs du terminal (27 = le caractere d'echappement).
// Desactivees si la sortie part ailleurs que dans un terminal.
var ESC = process.stdout.isTTY ? String.fromCharCode(27) + "[" : "";
var VERT = ESC && ESC + "32m", ROUGE = ESC && ESC + "31m";
var GRIS = ESC && ESC + "90m", NORMAL = ESC && ESC + "0m";
var problemes = [];

function lire(f) { return fs.readFileSync(path.join(RACINE, f), "utf8"); }

function titre(t) { console.log("\n" + t + "\n" + "-".repeat(t.length)); }

function ligne(ok, texte, detail) {
  console.log((ok ? VERT + "  OK  " : ROUGE + " ECHEC") + NORMAL + "  " + texte +
              (detail ? "\n" + GRIS + "        " + detail + NORMAL : ""));
  if (!ok) problemes.push(texte);
}


/* ------------------------------------------------------------
   1. SYNTAXE
   ------------------------------------------------------------ */

titre("1. Syntaxe des fichiers");

FICHIERS.concat(["verifier/tests.js"]).forEach(function (f) {
  try {
    new vm.Script(lire(f), { filename: f });
    ligne(true, f);
  } catch (e) {
    ligne(false, f, e.message);
  }
});


/* ------------------------------------------------------------
   2. DEMARRAGE
   On rejoue le chargement de la page avec un faux navigateur :
   si un fichier appelle une fonction qui n'existe pas encore,
   ou si l'ordre des <script> est mauvais, ca casse ici.
   ------------------------------------------------------------ */

titre("2. Demarrage du jeu (navigateur simule)");

var html = lire("index.html");

function tousLes(regex, texte) {
  var trouves = [], m;
  while ((m = regex.exec(texte)) !== null) trouves.push(m[1]);
  return trouves;
}

// Les elements reellement presents dans la page au chargement.
// Le faux navigateur ne connait que ceux-la : demander un id absent
// renvoie null, et le jeu plante ici comme il planterait pour de vrai.
var idsPage = tousLes(/\bid="([^"]+)"/g, html);
var idsDemandes = [];   // tout ce que le JS va chercher dans la page

function fauxNoeud() {
  return new Proxy(function () {}, {
    get: function (c, p) {
      if (p === "style" || p === "classList") return fauxNoeud();
      if (p === Symbol.toPrimitive || p === "toString" || p === "valueOf") {
        return function () { return ""; };
      }
      return fauxNoeud();
    },
    set: function () { return true; },
    apply: function () { return fauxNoeud(); }
  });
}

var ctx = {
  console: console,
  Math: Math, JSON: JSON, Object: Object, Array: Array, RegExp: RegExp,
  Error: Error, String: String, Number: Number, Symbol: Symbol,
  Infinity: Infinity,
  setTimeout: function () {},
  fetch: function () {
    return { then: function () { return this; }, catch: function () { return this; } };
  },
  document: {
    getElementById: function (id) {
      idsDemandes.push(id);
      return idsPage.indexOf(id) === -1 ? null : fauxNoeud();
    },
    querySelectorAll: function () { return []; }
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  navigator: { geolocation: { watchPosition: function () {} } },
  L: {
    map: function () { return fauxNoeud(); },
    tileLayer: function () { return fauxNoeud(); },
    circleMarker: function () { return fauxNoeud(); }
  }
};
ctx.window = ctx;
vm.createContext(ctx);

var demarrageOk = true;
FICHIERS.forEach(function (f) {
  if (!demarrageOk) return;
  try {
    vm.runInContext(lire(f), ctx, { filename: f });
    ligne(true, "charge " + f);
  } catch (e) {
    ligne(false, "charge " + f, e.message);
    demarrageOk = false;
  }
});


/* ------------------------------------------------------------
   3. LES FORMULES N'ONT PAS BOUGE
   ------------------------------------------------------------ */

titre("3. Comportement du jeu");

if (!demarrageOk) {
  ligne(false, "tests non lances : le jeu ne demarre pas");
} else {
  try {
    vm.runInContext(lire("verifier/tests.js"), ctx, { filename: "verifier/tests.js" });
    var resultats = ctx.lancerTests();
    var sectionCourante = "";

    resultats.forEach(function (r) {
      if (r.section !== sectionCourante) {
        sectionCourante = r.section;
        console.log(GRIS + "  [" + sectionCourante + "]" + NORMAL);
      }
      ligne(r.ok, r.quoi, r.ok ? null : "attendu " + r.attendu + "\n        obtenu  " + r.obtenu);
    });
  } catch (e) {
    ligne(false, "execution des tests", e.stack);
  }
}


/* ------------------------------------------------------------
   4. LES IDENTIFIANTS HTML EXISTENT
   Le piege classique quand on renomme : le JS cherche un
   element que la page ne contient plus.
   ------------------------------------------------------------ */

titre("4. Identifiants HTML");

var codeJs = FICHIERS.map(lire).join("\n");

// Les id presents dans la page, plus ceux que le JS fabrique lui-meme
// (les boutons du combat sont reecrits en cours de partie).
var idsPresents = idsPage.concat(tousLes(/\bid=\\?"([^"\\]+)\\?"/g, codeJs));

var manquants = [];
idsDemandes.concat(tousLes(/\belem\("([^"]+)"\)/g, codeJs))
           .concat(tousLes(/getElementById\("([^"]+)"\)/g, codeJs))
           .forEach(function (id) {
  if (idsPresents.indexOf(id) === -1 && manquants.indexOf(id) === -1) manquants.push(id);
});

ligne(manquants.length === 0,
      "chaque identifiant cherche par le JS existe",
      manquants.length ? "introuvable(s) : " + manquants.join(", ") : null);

// Les classes CSS employees par le JS doivent exister dans la feuille
var css = lire("css/style.css");
var classesManquantes = [];
["actif", "visible", "secoue", "ko", "bas", "danger", "assimilation", "sortie",
 "carte-echo", "mini-jauge", "ligne-echo", "equipee", "pastille", "infos",
 "nom", "titre", "stats", "trait", "pop-titre", "pop-lieu", "pop-mons"].forEach(function (c) {
  if (css.indexOf("." + c) === -1) classesManquantes.push(c);
});
ligne(classesManquantes.length === 0,
      "chaque classe CSS employee par le JS existe",
      classesManquantes.length ? "absente(s) du CSS : " + classesManquantes.join(", ") : null);

// Tous les fichiers doivent etre appeles par index.html
var oublies = FICHIERS.concat(["css/style.css"]).filter(function (f) {
  return html.indexOf(f) === -1;
});
ligne(oublies.length === 0, "index.html appelle bien tous les fichiers",
      oublies.length ? "non appele(s) : " + oublies.join(", ") : null);

// Le mot "scout" ne doit plus apparaitre nulle part
var restes = [];
FICHIERS.concat(["index.html", "css/style.css", "verifier/tests.js"]).forEach(function (f) {
  var texte = lire(f);
  texte.split("\n").forEach(function (l, i) {
    if (/scout/i.test(l)) restes.push(f + ":" + (i + 1));
  });
});
ligne(restes.length === 0, 'plus aucune trace du mot "scout"',
      restes.length ? restes.join(", ") : null);


/* ------------------------------------------------------------
   VERDICT
   ------------------------------------------------------------ */

console.log("");
if (problemes.length === 0) {
  console.log(VERT + "Tout est vert. Tu peux commiter." + NORMAL);
  console.log(GRIS + "Pense quand meme au parcours a la main : ouvre verifier/index.html." + NORMAL);
} else {
  console.log(ROUGE + problemes.length + " probleme(s). Ne commite pas encore :" + NORMAL);
  problemes.forEach(function (p) { console.log("  - " + p); });
  process.exitCode = 1;
}
