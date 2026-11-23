/* ============================================================
   LA PREUVE PAR MUTATIONS DES TESTS DU TRACE

   A lancer depuis le dossier du projet :
     node verifier/mutations-trace.js

   Meme principe que verifier/mutations-breches.js : chaque mutation
   abime UNE ligne du jeu, en memoire seulement, et au moins un test
   de verifier/trace.js doit passer au rouge. Une mutation qui reste
   verte est "survivante" : il manque un test.

   Ajouter une mutation : { fichier, avant, apres, quoi }. "avant"
   doit apparaitre EXACTEMENT une fois dans le fichier.
   ============================================================ */

var fs = require("fs");
var path = require("path");
var tests = require("./trace.js");

var RACINE = path.join(__dirname, "..");

var MUTATIONS = [
  // --- Le moteur (js/trace.js) ---
  { fichier: "js/trace.js", quoi: "pas de reechantillonnage egal (pas faux)",
    avant: "var pas = total / (n - 1);", apres: "var pas = total / n;" },
  { fichier: "js/trace.js", quoi: "le saut entre deux traits compte comme dessine",
    avant: "    var precedent = trait[0];", apres: "    var precedent = t > 0 ? traits[t - 1][traits[t - 1].length - 1] : trait[0];" },
  { fichier: "js/trace.js", quoi: "pas de mise a l'echelle",
    avant: "var cote = Math.max(maxX - minX, maxY - minY) || 1;", apres: "var cote = 1;" },
  { fichier: "js/trace.js", quoi: "echelle non uniforme (les proportions se perdent)",
    avant: "var q = { x: (p.x - minX) / cote, y: (p.y - minY) / cote };",
    apres: "var q = { x: (p.x - minX) / ((maxX - minX) || 1), y: (p.y - minY) / ((maxY - minY) || 1) };" },
  { fichier: "js/trace.js", quoi: "pas de recentrage",
    avant: "return echelles.map(function (q) { return { x: q.x - cx, y: q.y - cy }; });", apres: "return echelles;" },
  { fichier: "js/trace.js", quoi: "un point du modele pris deux fois",
    avant: "    pris[meilleur] = true;\n", apres: "" },
  { fichier: "js/trace.js", quoi: "un seul sens d'appariement",
    avant: "min = Math.min(min, distanceNuage(a, b, i), distanceNuage(b, a, i));",
    apres: "min = Math.min(min, distanceNuage(a, b, i));" },
  { fichier: "js/trace.js", quoi: "un seul point de depart",
    avant: "for (var i = 0; i < n; i += pas) {", apres: "for (var i = 0; i < 1; i += pas) {" },
  { fichier: "js/trace.js", quoi: "le chemin d'une spirale dans un seul sens",
    avant: "return Math.min(avant, arriere) / n;", apres: "return avant / n;" },
  { fichier: "js/trace.js", quoi: "le chemin ignore (la spirale redevient un nuage)",
    avant: "    if (g.ordre) d = Math.max(d, distanceChemin(a, m));\n", apres: "" },
  { fichier: "js/trace.js", quoi: "le miroir ignore",
    avant: "var modeles = g.miroir ? [b, miroir(b)] : [b];", apres: "var modeles = [b];" },
  { fichier: "js/trace.js", quoi: "le score ne descend pas sous la tolerance",
    avant: "var s = 1 - d / tolerance;", apres: "var s = 1 - d / (tolerance * 3);" },
  { fichier: "js/trace.js", quoi: "le score n'est pas borne",
    avant: "return Math.round(Math.max(0, Math.min(1, s)) * 1000) / 1000;", apres: "return Math.round(s * 1000) / 1000;" },
  { fichier: "js/trace.js", quoi: "pas de seuil de reconnaissance",
    avant: "glyphe: meilleurScore >= TRACE_SEUIL_RECONNU ? meilleur : null,", apres: "glyphe: meilleur," },
  { fichier: "js/trace.js", quoi: "le refus pour trop peu de points oublie",
    avant: 'if (nb < TRACE_POINTS_MIN) return "trop_court";', apres: "" },
  { fichier: "js/trace.js", quoi: "le refus pour trop petit oublie",
    avant: 'if (Math.max(maxX - minX, maxY - minY) < TRACE_TAILLE_MIN) return "trop_court";', apres: "" },
  { fichier: "js/trace.js", quoi: "un point illisible accepte",
    avant: "if (estNombre(x) && estNombre(y)) trait.push({ x: x, y: y });", apres: "trait.push({ x: x, y: y });" },
  { fichier: "js/trace.js", quoi: "les modeles en [x, y] mal lus",
    avant: 'var x = typeof p.length === "number" ? p[0] : p.x;', apres: "var x = p.x;" },
  { fichier: "js/trace.js", quoi: "le moteur tire au hasard",
    avant: "    var poids = 1 - ((i - debut + n) % n) / n;",
    apres: "    var poids = 1 - ((i - debut + n) % n) / n + Math.random() * 0.01;" },
  { fichier: "js/trace.js", quoi: "le resume oublie les non reconnus",
    avant: "if (!h || !h.glyphe || !parGlyphe[h.glyphe]) { inconnus++; return; }",
    apres: "if (!h || !h.glyphe || !parGlyphe[h.glyphe]) { return; }" },
  { fichier: "js/trace.js", quoi: "le resume fait une moyenne fausse",
    avant: "r.moyenne = (r.moyenne * r.nombre + h.score) / (r.nombre + 1);", apres: "r.moyenne = h.score;" },

  // --- Les donnees (js/config.js, js/langues.js) ---
  { fichier: "js/config.js", quoi: "la spirale aussi stricte que le cercle",
    avant: 'tolerance: 0.35, ordre: true', apres: 'tolerance: 0.15, ordre: true' },
  { fichier: "js/config.js", quoi: "un glyphe sans champ de deblocage",
    avant: 'tolerance: 0.16, ordre: false, miroir: false, deblocage: null,', apres: 'tolerance: 0.16, ordre: false, miroir: false,' },
  { fichier: "js/config.js", quoi: "seuil de reconnaissance trop bas (le hasard passe)",
    avant: "var TRACE_SEUIL_RECONNU = 0.35;", apres: "var TRACE_SEUIL_RECONNU = 0.01;" },
  { fichier: "js/config.js", quoi: "tolerance trop large (tout ressemble a tout)",
    avant: 'tolerance: 0.14, ordre: false, miroir: false, deblocage: null,\n    traits: [[[50, 0], [100, 87]',
    apres: 'tolerance: 0.6, ordre: false, miroir: false, deblocage: null,\n    traits: [[[50, 0], [100, 87]' },
  { fichier: "js/langues.js", quoi: "un nom anglais manquant",
    avant: '    "trace.glyphe.vague":    "Wave",\n', apres: "" },

  // --- Le banc (js/modetest.js) ---
  { fichier: "js/modetest.js", quoi: "l'historique n'est pas plafonne",
    avant: "  while (trace.historique.length > TRACE_HISTORIQUE_MAX) trace.historique.shift();\n", apres: "" },
  { fichier: "js/modetest.js", quoi: "le trace n'est pas visible pendant qu'on dessine",
    avant: "  liste.forEach(function (e) { trait.push(tracePoint(e)); });\n  traceDessiner();",
    apres: "  liste.forEach(function (e) { trait.push(tracePoint(e)); });" },
  { fichier: "js/modetest.js", quoi: "chaque trait est un trace a part (la croix casse)",
    avant: "  if (trace.fini) traceEffacer();", apres: "  traceEffacer();" },
  { fichier: "js/modetest.js", quoi: "un trace trop court entre dans l'historique",
    avant: '    elem("banc-trace-scores").innerHTML = "";\n    return r;',
    apres: '    elem("banc-trace-scores").innerHTML = "";\n    trace.historique.push({ glyphe: null, score: 0 });\n    return r;' },
  { fichier: "js/modetest.js", quoi: "le banc ecrit dans localStorage",
    avant: "  trace.historique.push({ glyphe: r.glyphe, score: r.score });",
    apres: "  trace.historique.push({ glyphe: r.glyphe, score: r.score });\n  localStorage.setItem(\"echos_trace\", \"1\");" },
  { fichier: "js/modetest.js", quoi: "le score affiche sans pourcentage",
    avant: "function pourcent(s) { return Math.round(s * 100); }", apres: "function pourcent(s) { return s; }" },
  { fichier: "js/modetest.js", quoi: "fermer efface l'historique",
    avant: '  elem("banc-trace").classList.remove("actif");', apres: '  elem("banc-trace").classList.remove("actif");\n  trace.historique = [];' }
];

function lancer() {
  var lignes = [], survivantes = 0, malEcrites = 0;

  var base = tests.lancerTestsTrace();
  var rougesBase = base.filter(function (r) { return !r.ok; });
  lignes.push((rougesBase.length === 0 ? "  OK  " : " ECHEC") + "  sans mutation : " +
              base.length + " tests, " + rougesBase.length + " rouge(s)");

  MUTATIONS.forEach(function (m) {
    var source = fs.readFileSync(path.join(RACINE, m.fichier), "utf8");
    // Git peut rendre certains fichiers avec des fins de ligne Windows.
    var crlf = source.indexOf("\r\n") !== -1;
    var avant = crlf ? m.avant.replace(/\r?\n/g, "\r\n") : m.avant;
    var apres = crlf ? m.apres.replace(/\r?\n/g, "\r\n") : m.apres;
    var n = source.split(avant).length - 1;
    if (n !== 1) {
      malEcrites++;
      lignes.push(" ECHEC  mutation mal ecrite (" + n + " occurrence(s)) : " + m.quoi);
      return;
    }

    var r = tests.lancerTestsTrace({
      transformer: function (f, src) {
        return f === m.fichier ? src.replace(avant, function () { return apres; }) : src;
      }
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
  console.log("Preuve par mutations des tests du trace\n");
  res.lignes.forEach(function (l) { console.log(l); });
  console.log("\n" + res.total + " mutation(s), " + res.survivantes + " survivante(s), " +
              res.malEcrites + " mal ecrite(s).");
  if (!res.ok) process.exitCode = 1;
}

module.exports = { lancer: lancer, MUTATIONS: MUTATIONS };
