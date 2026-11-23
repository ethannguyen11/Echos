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
    avant: "if (trio.a === trio.b || trio.b === trio.final || trio.a === trio.final) {", apres: "if (false) {" },

  // --- Brique 3 : calendrier et cycle ---
  { fichier: "js/breches.js", quoi: "le decalage horaire ignore",
    avant: "return Math.floor((instant - decalageMinutes * 60000) / MS_PAR_JOUR);",
    apres: "return Math.floor(instant / MS_PAR_JOUR);" },
  { fichier: "js/breches.js", quoi: "le decalage horaire a l'envers",
    avant: "return Math.floor((instant - decalageMinutes * 60000) / MS_PAR_JOUR);",
    apres: "return Math.floor((instant + decalageMinutes * 60000) / MS_PAR_JOUR);" },
  { fichier: "js/breches.js", quoi: "arrondi au lieu de partie entiere (minuit decale)",
    avant: "return Math.floor((instant - decalageMinutes * 60000) / MS_PAR_JOUR);",
    apres: "return Math.round((instant - decalageMinutes * 60000) / MS_PAR_JOUR);" },
  { fichier: "js/breches.js", quoi: "les siecles non bissextiles oublies",
    avant: "var je = ae * 365 + Math.floor(ae / 4) - Math.floor(ae / 100) + ja;",
    apres: "var je = ae * 365 + Math.floor(ae / 4) + ja;" },
  { fichier: "js/breches.js", quoi: "le mois sans zero devant",
    avant: 'return d.annee + "-" + (d.mois < 10 ? "0" : "") + d.mois;', apres: 'return d.annee + "-" + d.mois;' },
  { fichier: "js/breches.js", quoi: "decembre revient a janvier de la meme annee",
    avant: "return d.mois === 12 ? jourDeLaDate(d.annee + 1, 1, 1) : jourDeLaDate(d.annee, d.mois + 1, 1);",
    apres: "return d.mois === 12 ? jourDeLaDate(d.annee, 1, 1) : jourDeLaDate(d.annee, d.mois + 1, 1);" },
  { fichier: "js/breches.js", quoi: "pas de rotation pour un mois sans saison",
    avant: "return saisons[rang % saisons.length] || null;", apres: "return saisons[0] || null;" },
  { fichier: "js/breches.js", quoi: "toutes les arenes sont des breches",
    avant: 'return grainePourTexte("breche/" + mois + "/" + areneId) % BRECHES_UNE_ARENE_SUR === 0;',
    apres: "return true;" },
  { fichier: "js/breches.js", quoi: "les breches ne changent pas avec la saison",
    avant: 'return grainePourTexte("breche/" + mois + "/" + areneId) % BRECHES_UNE_ARENE_SUR === 0;',
    apres: 'return grainePourTexte("breche/" + areneId) % BRECHES_UNE_ARENE_SUR === 0;' },
  { fichier: "js/breches.js", quoi: "le boss B commence un jour trop tard",
    avant: 'if (cran < n) return { role: "a"', apres: 'if (cran <= n) return { role: "a"' },
  { fichier: "js/config.js", quoi: "le final moins fort que le boss B au cran 3",
    avant: "var BRECHES_MULT_ROLE = { a: 1, b: 1.4, final: 2 };", apres: "var BRECHES_MULT_ROLE = { a: 1, b: 1.4, final: 1.8 };" },
  { fichier: "js/breches.js", quoi: "le final prend la force du boss B",
    avant: "var m = BRECHES_MULT_ROLE[e.role] *", apres: "var m = BRECHES_MULT_ROLE[e.role === \"final\" ? \"b\" : e.role] *" },
  { fichier: "js/breches.js", quoi: "aucun recul pour les jours manques",
    avant: "return Math.max(0, breche.cran - manques);", apres: "return breche.cran;" },
  { fichier: "js/breches.js", quoi: "recul compte un jour de trop",
    avant: "var manques = jour - breche.dernier_jour - 1;", apres: "var manques = jour - breche.dernier_jour;" },
  { fichier: "js/breches.js", quoi: "pas de plancher",
    avant: "return Math.max(0, breche.cran - manques);", apres: "return breche.cran - manques;" },
  { fichier: "js/breches.js", quoi: "deux victoires le meme jour",
    avant: 'if (breche.dernier_jour !== null && jour <= breche.dernier_jour) return "eteinte";',
    apres: 'if (breche.dernier_jour !== null && jour < breche.dernier_jour) return "eteinte";' },
  { fichier: "js/breches.js", quoi: "l'horloge qui recule rouvre la breche",
    avant: 'if (breche.dernier_jour !== null && jour <= breche.dernier_jour) return "eteinte";',
    apres: 'if (breche.dernier_jour !== null && jour === breche.dernier_jour) return "eteinte";' },
  { fichier: "js/breches.js", quoi: "plafond ignore",
    avant: 'return compterActives(breches, jour, breche.arene_id) >= BRECHES_ACTIVES_MAX ? "plafond" : "disponible";',
    apres: 'return "disponible";' },
  { fichier: "js/breches.js", quoi: "le plafond compte la breche elle-meme",
    avant: "if (!b || b.arene_id === saufAreneId || b.possedee) continue;",
    apres: "if (!b || b.possedee) continue;" },
  { fichier: "js/breches.js", quoi: "le plafond compte les breches possedees",
    avant: "if (!b || b.arene_id === saufAreneId || b.possedee) continue;",
    apres: "if (!b || b.arene_id === saufAreneId) continue;" },
  { fichier: "js/breches.js", quoi: "le plafond compte les breches retombees au jour 1",
    avant: "if (cranDuJour(b, jour) > 0) n++;", apres: "if (b.dernier_jour !== null) n++;" },
  { fichier: "js/breches.js", quoi: "la possession n'est jamais donnee",
    avant: "    b.possedee = true;\n", apres: "" },
  { fichier: "js/breches.js", quoi: "une breche possedee peut encore etre gagnee",
    avant: 'if (breche.possedee) return "possedee";', apres: "" },
  { fichier: "js/breches.js", quoi: "la victoire mute la breche recue",
    avant: "var b = copieBreche(breche);", apres: "var b = breche;" },
  { fichier: "js/breches.js", quoi: "le trophee de possession oublie",
    avant: 'type: boss.role === "final" ? "possession" : "victoire",', apres: 'type: "victoire",' },
  { fichier: "js/breches.js", quoi: "la force du boss oublie l'ATQ",
    avant: "u.atq = Math.max(1, Math.round(u.atq * multiplicateur));", apres: "" },
  { fichier: "js/breches.js", quoi: "la force du boss accepte un multiplicateur sous 1",
    avant: "if (!brecheNombre(multiplicateur) || multiplicateur < 1 || !adversaires) return;",
    apres: "if (!brecheNombre(multiplicateur) || !adversaires) return;" },
  // --- Brique 4 : la saison ---
  { fichier: "js/breches.js", quoi: "la bascule garde les breches du mois fini",
    avant: "  d.saison = mois;\n  d.breches = [];", apres: "  d.saison = mois;" },
  { fichier: "js/breches.js", quoi: "la bascule efface le journal",
    avant: "  d.saison = mois;\n  d.breches = [];", apres: "  d.saison = mois;\n  d.breches = [];\n  d.journal = [];" },
  { fichier: "js/breches.js", quoi: "la bascule efface les trophees",
    avant: "  d.saison = mois;\n  d.breches = [];", apres: "  d.saison = mois;\n  d.breches = [];\n  d.trophees = [];" },
  { fichier: "js/breches.js", quoi: "la bascule oublie le bilan",
    avant: "d.saisons_passees = garderLesDerniers(d.saisons_passees.concat([bilan]), BRECHES_SAISONS_PASSEES_MAX);",
    apres: "" },
  { fichier: "js/breches.js", quoi: "trophee de saison meme a zero",
    avant: "if (bilan.possedees > 0) {", apres: "if (bilan.possedees >= 0) {" },
  { fichier: "js/breches.js", quoi: "une horloge qui recule rebascule",
    avant: "if (moisValide(donnees.saison) && mois < donnees.saison) return { change: false, donnees: donnees };",
    apres: "" },
  { fichier: "js/breches.js", quoi: "la bascule mute les donnees recues",
    avant: "  var d = copieDonnees(donnees);\n  if (moisValide(donnees.saison)) {",
    apres: "  var d = donnees;\n  if (moisValide(donnees.saison)) {" },
  { fichier: "js/breches.js", quoi: "le compteur compte les breches commencees",
    avant: "return donnees.breches.filter(function (b) { return b.possedee && b.saison === donnees.saison; }).length;",
    apres: "return donnees.breches.length;" },
  { fichier: "js/breches.js", quoi: "le bilan n'est pas trie",
    avant: "      if (x.jour_possession !== y.jour_possession) return x.jour_possession - y.jour_possession;\n", apres: "" },
  { fichier: "js/breches.js", quoi: "le bilan oublie son numero de format",
    avant: "    format: BRECHES_FORMAT_CLASSEMENT,\n", apres: "" },
  { fichier: "js/breches.js", quoi: "inscrire accepte un jour d'un autre mois",
    avant: 'if (moisDuJour(jour) !== donnees.saison) return { ok: false, raison: "autre_saison" };', apres: "" },
  { fichier: "js/breches.js", quoi: "inscrire ajoute un doublon au lieu de mettre a jour",
    avant: "  if (place === -1) d.breches.push(r.breche);\n  else d.breches[place] = r.breche;",
    apres: "  d.breches.push(r.breche);" },
  { fichier: "js/breches.js", quoi: "le journal garde les plus anciennes",
    avant: "return liste.length > max ? liste.slice(liste.length - max) : liste.slice();",
    apres: "return liste.length > max ? liste.slice(0, max) : liste.slice();" },
  { fichier: "js/breches.js", quoi: "un trophee en double",
    avant: "for (var i = 0; i < trophees.length; i++) if (trophees[i].id === t.id) return trophees.slice();", apres: "" },
  { fichier: "js/breches.js", quoi: "les regles lisent l'horloge",
    avant: "function cranDuJour(breche, jour) {", apres: "function cranDuJour(breche, jour) {\n  var t = Date.now();" }
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
