/* ============================================================
   LES TESTS DES BRECHES PERMANENTES
   Lances par node verifier.js (section 7). Ne tournent pas dans
   le navigateur.

   Correspondance de vocabulaire : "breche" ici ; les "poches
   d'Oubli" (js/poche.js) sont un autre systeme.

   Chaque test doit pouvoir ECHOUER : verifier/mutations-breches.js
   abime une ligne du jeu a la fois et controle qu'au moins un test
   d'ici passe au rouge. C'est la preuve par mutations :
     node verifier/mutations-breches.js

   options.transformer(fichier, source) est transmis a creerMonde :
   c'est par la que les mutations entrent.
   ============================================================ */

var parcours = require("./parcours.js");

function lancerTestsBreches(options) {
  options = options || {};
  var resultats = [];
  var section = "";

  function bloc(t) { section = t; }
  function verifie(quoi, ok, detail) {
    resultats.push({ section: section, quoi: quoi, ok: !!ok, detail: ok ? null : detail });
  }
  function monde(stockage) {
    return parcours.creerMonde({ stockage: stockage || {}, transformer: options.transformer });
  }

  try {
    testerDonnees(monde, bloc, verifie);
  } catch (e) {
    verifie("les tests des breches vont au bout sans exception", false,
            String(e && e.stack || e).split(/\r?\n/).slice(0, 3).join(" "));
  }
  return resultats;
}


/* ------------------------------------------------------------
   BRIQUE 2 : LES REGLAGES ET LES SAISONS
   ------------------------------------------------------------ */

function testerDonnees(monde, bloc, verifie) {
  bloc("Breches : reglages et saisons");

  var X = monde().ctx;

  verifie("l'interrupteur BRECHES_PERMANENTES_ACTIF est livre a false",
          X.BRECHES_PERMANENTES_ACTIF === false);

  verifie("le cycle fait 3 crans pour A, 3 pour B, 1 pour le final : 7 jours",
          X.BRECHES_CRANS_PAR_BOSS === 3 &&
          X.BRECHES_CYCLE_JOURS === 2 * X.BRECHES_CRANS_PAR_BOSS + 1 &&
          X.BRECHES_MULT_CRAN.length === X.BRECHES_CRANS_PAR_BOSS,
          X.BRECHES_CYCLE_JOURS + " jours, " + X.BRECHES_MULT_CRAN.length + " multiplicateurs");

  verifie("chaque multiplicateur est un nombre >= 1",
          X.BRECHES_MULT_CRAN.concat([X.BRECHES_MULT_ROLE.a, X.BRECHES_MULT_ROLE.b, X.BRECHES_MULT_ROLE.final])
            .every(function (v) { return typeof v === "number" && isFinite(v) && v >= 1; }));

  verifie("plafond de 3 breches actives, une arene sur 4 ou plus",
          X.BRECHES_ACTIVES_MAX === 3 && X.BRECHES_UNE_ARENE_SUR >= 1);

  verifie("les cles de sauvegarde sont neuves et distinctes de celles du joueur et des poches",
          X.CLE_BRECHES !== X.CLE_BRECHES_TEST &&
          [X.CLE_JOUEUR, X.CLE_POCHES, X.CLE_DONJONS, X.CLE_LANGUE].indexOf(X.CLE_BRECHES) === -1 &&
          [X.CLE_JOUEUR, X.CLE_POCHES, X.CLE_DONJONS, X.CLE_LANGUE].indexOf(X.CLE_BRECHES_TEST) === -1 &&
          X.CLES_JOUEUR_ANCIENNES.indexOf(X.CLE_BRECHES) === -1);

  var fautes = X.validerSaisons(X.SAISONS_BRECHES);
  verifie("js/saisons.js est valide", fautes.length === 0, fautes.join(" | "));

  verifie("au moins 2 saisons, chacune avec les 4 familles de lieu",
          X.SAISONS_BRECHES.length >= 2 && X.SAISONS_BRECHES.every(function (s) {
            return ["temple", "parc", "metro", "monument"].every(function (f) { return !!s.familles[f]; });
          }));

  // Le controleur doit voir chaque faute : une saison abimee a la fois.
  function copie() { return JSON.parse(JSON.stringify(X.SAISONS_BRECHES)); }
  function attrape(quoi, abimer) {
    var s = copie();
    abimer(s);
    var f = X.validerSaisons(s);
    verifie("le controleur attrape : " + quoi, f.length > 0, "aucune faute vue");
  }
  attrape("un mois mal forme", function (s) { s[0].mois = "novembre"; });
  attrape("un mois 13", function (s) { s[0].mois = "2026-13"; });
  attrape("un mois en double", function (s) { s[1].mois = s[0].mois; });
  attrape("une espece inconnue", function (s) { s[0].familles.temple.a = "licorne"; });
  attrape("une espece d'une autre famille", function (s) { s[0].familles.temple.b = "peng"; });
  attrape("deux roles sur la meme espece", function (s) { s[0].familles.temple.b = s[0].familles.temple.a; });
  attrape("un rang qui descend", function (s) {
    s[0].familles.temple = { a: "komainu", b: "chiguo", final: "sunwukong" };  // A, C, B
  });
  attrape("un nom francais absent", function (s) { s[0].nom = { en: "x" }; });
  attrape("une saison sans famille", function (s) { s[0].familles = {}; });
  attrape("un role manquant", function (s) { delete s[0].familles.parc.final; });

  verifie("le controleur ne leve jamais d'exception", (function () {
    try {
      return [null, 42, "x", [], [null], [{}], [{ mois: "2026-01", nom: { fr: "a" }, familles: { temple: null } }]]
        .every(function (v) { return X.validerSaisons(v).length > 0; });
    } catch (e) { return false; }
  })());
}


module.exports = { lancerTestsBreches: lancerTestsBreches };
