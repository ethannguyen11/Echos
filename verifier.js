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
  "js/langues.js",
  "js/especes.js",
  "js/lieux.js",
  "js/carte.js",
  "js/joueur.js",
  "js/fragments.js",
  "js/combat.js",
  "js/grimoire.js",
  "js/intro.js",
  "js/ico.js",
  "js/modetest.js",
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

FICHIERS.concat(["verifier/tests.js", "verifier/parcours.js"]).forEach(function (f) {
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
  Infinity: Infinity, Date: Date, isFinite: isFinite,
  setTimeout: function () {}, clearTimeout: function () {},
  setInterval: function () {}, clearInterval: function () {},
  location: { reload: function () {} },
  fetch: function () {
    return { then: function () { return this; }, catch: function () { return this; } };
  },
  document: {
    getElementById: function (id) {
      idsDemandes.push(id);
      return idsPage.indexOf(id) === -1 ? null : fauxNoeud();
    },
    querySelectorAll: function () { return []; },

    // Le vrai document en a un : js/jeu.js y branche l'appui qui
    // efface l'intervention d'Ico.
    addEventListener: function () {}
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

// Les classes CSS employees par le JS doivent exister dans les feuilles
var css = lire("css/style.css") + "\n" + lire("css/intro.css") + "\n" + lire("css/ico.css");
var classesManquantes = [];
["actif", "visible", "secoue", "ko", "bas", "danger", "assimilation", "sortie",
 "carte-echo", "mini-jauge", "ligne-echo", "equipee", "pastille", "infos",
 "lie", "inconnu", "vide", "famille-titre", "initiale", "pastille-secours",
 "nom", "titre", "stats", "trait", "pop-titre", "pop-lieu", "pop-mons",
 "figement", "grosse", "fleche-haut", "fleche-bas",
 "affinite", "affinite-plus", "affinite-moins",
 "past-affinite", "ligne-affinite",
 "ico-section", "ouverte", "ico-titre", "ico-chevron", "ico-corps",
 "ico-ligne", "ico-chiffres", "ico-chiffre", "ico-libelle", "ico-valeur",
 "ico-rubrique", "fragment", "ico-neuf", "ico-a-venir",
 "ico-bulle-nom", "ico-bulle-ligne",
 "difficulte", "discret", "journal-ligne", "mt-titre", "mt-ligne", "apt-echo", "apt-ligne", "apt-nom", "apt-texte", "apt-attente",
 "intro-ouverte", "intro-overlay", "intro-visuel", "intro-dialogue",
 "sortant", "recit", "ico", "lieu", "nom-lieu", "parti",
 "echo-depart", "echo-vignette", "echo-substitut", "echo-nom", "echo-titre",
 "echo-niveau",
 "conscience", "paliers", "acquis", "fragments", "manque",
 "prete", "acheve", "gourde",
 "montee", "monter", "confirmer", "annuler"].forEach(function (c) {
  if (css.indexOf("." + c) === -1) classesManquantes.push(c);
});
ligne(classesManquantes.length === 0,
      "chaque classe CSS employee par le JS existe",
      classesManquantes.length ? "absente(s) du CSS : " + classesManquantes.join(", ") : null);

/* UN SEUL MOTEUR DE TEXTE DANS LE JEU.

   js/ico.js doit se servir de la machine a ecrire de intro.js
   (Intro.frapperDans) et surtout pas en poser une deuxieme. Le
   jour ou quelqu'un ecrira un setInterval de frappe dans ico.js,
   ce controle le dira : deux moteurs finissent toujours par
   diverger, et le personnage n'aurait plus la meme voix selon
   l'ecran. */
var srcIco = lire("js/ico.js");
var moteurDouble = [];
if (srcIco.indexOf("Intro.frapperDans") === -1) {
  moteurDouble.push("ico.js ne se sert pas de Intro.frapperDans");
}
if (/setInterval/.test(srcIco)) {
  moteurDouble.push("ico.js pose son propre setInterval");
}
ligne(moteurDouble.length === 0,
      "un seul moteur de texte : ico.js reutilise celui de intro.js",
      moteurDouble.length ? moteurDouble.join(", ") : null);

/* Les cles du didacticiel sont des chaines de caracteres posees
   dans quatre fichiers differents. Une faute de frappe dans un
   Ico.dire() ne se verrait nulle part : l'intervention ne se
   jouerait jamais, sans la moindre erreur. On croise donc les
   deux listes dans les deux sens. */
if (demarrageOk && ctx.TEXTES_ICO_DIDACTICIEL) {
  var declenchees = tousLes(/Ico\.dire\("([^"]+)"\)/g, codeJs);
  var ecrites = ctx.TEXTES_ICO_DIDACTICIEL.map(function (d) { return d.cle; });

  var inconnues = declenchees.filter(function (c) { return ecrites.indexOf(c) === -1; });
  var muettes   = ecrites.filter(function (c) { return declenchees.indexOf(c) === -1; });

  var detail = [];
  if (inconnues.length) detail.push("declenchee mais inexistante : " + inconnues.join(", "));
  if (muettes.length)   detail.push("jamais declenchee : " + muettes.join(", "));

  ligne(detail.length === 0,
        "chaque intervention d'Ico a un declencheur, et reciproquement",
        detail.length ? detail.join(" | ") : null);
}

// Tous les fichiers doivent etre appeles par index.html
var oublies = FICHIERS.concat(["css/style.css", "css/intro.css", "css/ico.css"]).filter(function (f) {
  return html.indexOf(f) === -1;
});
ligne(oublies.length === 0, "index.html appelle bien tous les fichiers",
      oublies.length ? "non appele(s) : " + oublies.join(", ") : null);

// jeu.js doit rester le dernier script de la page
var scripts = tousLes(/<script src="(js\/[^"]+)"><\/script>/g, html);
var dernierScript = scripts[scripts.length - 1];
ligne(dernierScript === "js/jeu.js", "js/jeu.js est bien le dernier script",
      dernierScript === "js/jeu.js" ? null : "dernier trouve : " + dernierScript);

// Aucun module ES6 : le site est servi tel quel par GitHub Pages
var modules = [];
FICHIERS.forEach(function (f) {
  var t = lire(f);
  if (/^\s*(import|export)\s/m.test(t) || /\bfrom\s+["']\.\//.test(t)) modules.push(f);
});
if (/type="module"/.test(html)) modules.push("index.html");
ligne(modules.length === 0, "aucun import / export / type=module",
      modules.length ? modules.join(", ") : null);

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
   5. LE SCRIPT DE L'INTRO EST FIDELE AU TEXTE
   On relit echos-ico-ouverture.md et on compare, replique par
   replique, avec ce que js/intro.js va reellement afficher.

   Depuis le passage au bilingue, js/intro.js ne contient plus de
   phrases mais des cles : la comparaison se fait donc contre
   TEXTES.fr, la table francaise de js/langues.js. La reference
   reste le .md, et le francais reste mot pour mot. L'anglais
   n'est pas compare : il n'a pas de fichier de reference, et une
   cle anglaise absente est un cas prevu, pas une faute.
   Une reformulation, une virgule deplacee, une ligne oubliee :
   ca se voit ici.
   ------------------------------------------------------------ */

titre("5. Fidelite du script de l'intro");

var CHEMIN_SCRIPT = "echos-ico-ouverture.md";

if (!fs.existsSync(path.join(RACINE, CHEMIN_SCRIPT))) {
  ligne(false, CHEMIN_SCRIPT + " est introuvable");
} else if (!demarrageOk || !ctx.Intro) {
  ligne(false, "js/intro.js n'a pas pu etre charge");
} else {

  // --- ce que dit le fichier de reference ---
  var attendues = [];
  lire(CHEMIN_SCRIPT).split("\n").forEach(function (l) {
    l = l.replace(/\r$/, "");
    var m;
    if ((m = l.match(/^récit : \*(.+)\*$/)))            attendues.push("recit|" + m[1]);
    else if ((m = l.match(/^Ico : (.+)$/)))             attendues.push("ico|" + m[1]);
    else if ((m = l.match(/^- « (.+) » → `([a-z0-9]+)`$/))) attendues.push("option|" + m[1] + "|" + m[2]);
  });

  // --- ce que le moteur jouera ---
  // Une cle absente de TEXTES.fr se signale ici en toutes lettres
  // plutot que de sortir un "undefined" illisible dans l'ecart.
  function fr(cle) {
    var v = ctx.TEXTES && ctx.TEXTES.fr ? ctx.TEXTES.fr[cle] : undefined;
    return typeof v === "string" ? v : "(cle absente de TEXTES.fr : " + cle + ")";
  }

  var jouees = [];
  ctx.Intro.SCRIPT.forEach(function (e) {
    if (e.type === "recit") jouees.push("recit|" + fr(e.cleTexte));
    else if (e.type === "ico") jouees.push("ico|" + fr(e.cleTexte));
    else if (e.type === "choix") {
      e.options.forEach(function (o) { jouees.push("option|" + fr(o.cleTexte) + "|" + o.valeur); });
    }
  });

  ligne(attendues.length === jouees.length,
        "meme nombre de repliques (" + attendues.length + " dans le .md)",
        attendues.length === jouees.length ? null : jouees.length + " dans js/intro.js");

  var ecarts = [];
  for (var i = 0; i < Math.max(attendues.length, jouees.length); i++) {
    if (attendues[i] !== jouees[i]) {
      ecarts.push("ligne " + (i + 1) +
                  "\n           .md : " + (attendues[i] === undefined ? "(rien)" : attendues[i]) +
                  "\n           jeu : " + (jouees[i] === undefined ? "(rien)" : jouees[i]));
      if (ecarts.length >= 3) break;
    }
  }

  ligne(ecarts.length === 0, "chaque replique est reprise mot pour mot",
        ecarts.length ? ecarts.join("\n        ") : null);
}


/* ------------------------------------------------------------
   6. LA CINEMATIQUE SE JOUE VRAIMENT
   verifier/parcours.js deroule l'intro du debut a la fin dans un
   faux navigateur : taps, choix, saisie, GPS present ou absent,
   vieille sauvegarde. C'est le seul test qui la joue reellement.
   ------------------------------------------------------------ */

titre("6. Parcours complet de l'intro");

try {
  var parcours = require("./verifier/parcours.js").lancerParcours();
  var sectionParcours = "";

  parcours.forEach(function (r) {
    if (r.section !== sectionParcours) {
      sectionParcours = r.section;
      console.log(GRIS + "  [" + sectionParcours + "]" + NORMAL);
    }
    ligne(r.ok, r.quoi, r.detail);
  });
} catch (e) {
  ligne(false, "le parcours de l'intro n'a pas pu aller au bout", e.message);
}


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
