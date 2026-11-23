/* ============================================================
   LA PREUVE PAR MUTATIONS DES TESTS DES BRECHES

   A lancer depuis le dossier du projet :
     node verifier/mutations-breches.js

   Un test qui ne peut pas echouer ne prouve rien. Ce script abime
   le jeu une ligne a la fois (une "mutation"), relance les tests
   de verifier/breches.js sur la copie abimee, et exige qu'au moins
   un test passe au rouge. Une mutation qui reste verte est une
   mutation "survivante" : il manque un test.

   Rien n'est ecrit sur le disque : la mutation est appliquee au
   texte du fichier, en memoire, au moment de le charger.

   Ajouter une mutation : { fichier, avant, apres, quoi }. "avant"
   doit apparaitre EXACTEMENT une fois dans le fichier, sinon la
   mutation est signalee comme mal ecrite.
   ============================================================ */

var fs = require("fs");
var path = require("path");
var tests = require("./breches.js");

var RACINE = path.join(__dirname, "..");

var MUTATIONS = [
  // --- Brique 2 : reglages et saisons ---
  { fichier: "js/config.js", quoi: "interrupteur livre allume",
    avant: "var BRECHES_PERMANENTES_ACTIF = false;", apres: "var BRECHES_PERMANENTES_ACTIF = true;" },
  { fichier: "js/config.js", quoi: "cycle de 8 jours",
    avant: "var BRECHES_CYCLE_JOURS    = 7;", apres: "var BRECHES_CYCLE_JOURS    = 8;" },
  { fichier: "js/config.js", quoi: "plafond de 4",
    avant: "var BRECHES_ACTIVES_MAX = 3;", apres: "var BRECHES_ACTIVES_MAX = 4;" },
  { fichier: "js/config.js", quoi: "cle de test confondue avec la vraie",
    avant: 'var CLE_BRECHES_TEST             = "echos_breches_test_v1";',
    apres: 'var CLE_BRECHES_TEST             = "echos_breches_v1";' },
  { fichier: "js/config.js", quoi: "multiplicateur sous 1",
    avant: "var BRECHES_MULT_CRAN = [1, 1.15, 1.3];", apres: "var BRECHES_MULT_CRAN = [0.5, 1.15, 1.3];" },
  { fichier: "js/saisons.js", quoi: "espece d'une autre famille dans les donnees",
    avant: 'temple:   { a: "chiguo",    b: "sunwukong",  final: "komainu" }',
    apres: 'temple:   { a: "chiguo",    b: "peng",       final: "komainu" }' },
  { fichier: "js/breches.js", quoi: "le controleur oublie la famille",
    avant: "if (ESPECES[id].famille !== fam) {", apres: "if (false) {" },
  { fichier: "js/breches.js", quoi: "le controleur oublie les doublons de mois",
    avant: 'fautes.push(ici + " : mois en double");', apres: "" },
  { fichier: "js/breches.js", quoi: "le controleur accepte le mois 13",
    avant: "return m >= 1 && m <= 12;", apres: "return m >= 1;" },
  { fichier: "js/breches.js", quoi: "le controleur oublie l'ordre des rangs",
    avant: "!(rangs[0] <= rangs[1] && rangs[1] <= rangs[2])", apres: "false" },
  { fichier: "js/breches.js", quoi: "le controleur oublie les roles en double",
    avant: "if (trio.a === trio.b || trio.b === trio.final || trio.a === trio.final) {", apres: "if (false) {" }
];

function lancer() {
  var lignes = [], survivantes = 0, malEcrites = 0;

  // D'abord la copie intacte : tout doit y etre vert.
  var base = tests.lancerTestsBreches();
  var rougesBase = base.filter(function (r) { return !r.ok; });
  lignes.push((rougesBase.length === 0 ? "  OK  " : " ECHEC") + "  sans mutation : " +
              base.length + " tests, " + rougesBase.length + " rouge(s)");

  MUTATIONS.forEach(function (m) {
    var source = fs.readFileSync(path.join(RACINE, m.fichier), "utf8");
    var n = source.split(m.avant).length - 1;
    if (n !== 1) {
      malEcrites++;
      lignes.push(" ECHEC  mutation mal ecrite (" + n + " occurrence(s)) : " + m.quoi);
      return;
    }

    var r = tests.lancerTestsBreches({
      transformer: function (f, src) { return f === m.fichier ? src.replace(m.avant, m.apres) : src; }
    });
    var rouges = r.filter(function (x) { return !x.ok; });
    if (rouges.length === 0) survivantes++;
    lignes.push((rouges.length > 0 ? "  OK  " : " ECHEC") + "  " + m.quoi +
                (rouges.length > 0 ? "  (attrapee par : " + rouges[0].quoi + ")" : "  -> SURVIVANTE"));
  });

  return { lignes: lignes, ok: rougesBase.length === 0 && survivantes === 0 && malEcrites === 0,
           total: MUTATIONS.length, survivantes: survivantes, malEcrites: malEcrites };
}

if (require.main === module) {
  var res = lancer();
  console.log("Preuve par mutations des tests des breches\n");
  res.lignes.forEach(function (l) { console.log(l); });
  console.log("\n" + res.total + " mutation(s), " + res.survivantes + " survivante(s), " +
              res.malEcrites + " mal ecrite(s).");
  if (!res.ok) process.exitCode = 1;
}

module.exports = { lancer: lancer, MUTATIONS: MUTATIONS };
