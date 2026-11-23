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
  // Le texte d'un fichier du jeu, tel que le monde l'a charge (mutations comprises).
  function source(f) {
    var s = require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
    return options.transformer ? options.transformer(f, s) : s;
  }

  try {
    testerDonnees(monde, bloc, verifie);
    testerCalendrier(monde, bloc, verifie);
    testerCycle(monde, bloc, verifie, source);
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



/* ------------------------------------------------------------
   BRIQUE 3 : LE CALENDRIER
   La reference est le vrai objet Date de Node, utilise ICI
   seulement : le jeu, lui, n'y a pas droit dans ses regles.
   ------------------------------------------------------------ */

function testerCalendrier(monde, bloc, verifie) {
  bloc("Breches : jours calendaires");

  var X = monde().ctx;
  var H = 3600000;
  function utc(a, m, j, h, mi) { return Date.UTC(a, m - 1, j, h || 0, mi || 0); }
  function jourDe(a, m, j) { return Math.round(Date.UTC(a, m - 1, j) / 86400000); }

  verifie("le 1er janvier 1970 est le jour 0, a minuit UTC",
          X.jourCalendaire(0, 0) === 0 && X.jourCalendaire(-1, 0) === -1 && X.jourDeLaDate(1970, 1, 1) === 0);

  // Minuit a Taipei (UTC+8, decalage -480) : 23:59 et 00:00 locales.
  var veille = utc(2026, 11, 22, 15, 59), minuit = utc(2026, 11, 22, 16, 0);
  verifie("minuit local : 23 h 59 et 0 h 00 sont deux jours qui se suivent",
          X.jourCalendaire(veille, -480) === jourDe(2026, 11, 22) &&
          X.jourCalendaire(minuit, -480) === jourDe(2026, 11, 23) &&
          X.jourCalendaire(minuit - 1, -480) === jourDe(2026, 11, 22));

  var instant = utc(2026, 11, 23, 3, 0);    // 11 h a Taipei, 22 h la veille a New York
  verifie("le meme instant tombe sur des jours differents selon le fuseau",
          X.jourCalendaire(instant, -480) === jourDe(2026, 11, 23) &&
          X.jourCalendaire(instant, 300) === jourDe(2026, 11, 22));

  // Paris, passage a l'heure d'ete le 29 mars 2026 a 2 h (1 h UTC).
  verifie("changement d'heure (ete) : minuit reste minuit de chaque cote",
          X.jourCalendaire(utc(2026, 3, 28, 22, 59), -60) === jourDe(2026, 3, 28) &&
          X.jourCalendaire(utc(2026, 3, 28, 23, 0), -60) === jourDe(2026, 3, 29) &&
          X.jourCalendaire(utc(2026, 3, 29, 21, 59), -120) === jourDe(2026, 3, 29) &&
          X.jourCalendaire(utc(2026, 3, 29, 22, 0), -120) === jourDe(2026, 3, 30));

  // Paris, retour a l'heure d'hiver le 25 octobre 2026 : un jour de 25 h.
  verifie("changement d'heure (hiver) : le jour de 25 heures reste un seul jour",
          X.jourCalendaire(utc(2026, 10, 24, 22, 0), -120) === jourDe(2026, 10, 25) &&
          X.jourCalendaire(utc(2026, 10, 25, 22, 59), -60) === jourDe(2026, 10, 25) &&
          X.jourCalendaire(utc(2026, 10, 25, 23, 0), -60) === jourDe(2026, 10, 26));

  verifie("un instant ou un decalage illisible donne NaN, jamais un faux jour",
          isNaN(X.jourCalendaire("hier", 0)) && isNaN(X.jourCalendaire(0, undefined)) &&
          isNaN(X.jourCalendaire(NaN, 0)) && isNaN(X.jourCalendaire(Infinity, 0)));

  // Toutes les dates de 1999 a 2101, contre le calendrier de Node.
  var ecarts = [];
  for (var j = jourDe(1999, 1, 1); j <= jourDe(2101, 1, 1) && ecarts.length < 3; j++) {
    var d = new Date(j * 86400000);
    var attendu = d.getUTCFullYear() + "-" + (d.getUTCMonth() < 9 ? "0" : "") + (d.getUTCMonth() + 1);
    var c = X.dateDuJour(j);
    if (X.moisDuJour(j) !== attendu || c.quantieme !== d.getUTCDate() ||
        X.jourDeLaDate(c.annee, c.mois, c.quantieme) !== j) ecarts.push(j + " : " + X.moisDuJour(j) + " / " + attendu);
  }
  verifie("dates et mois exacts de 1999 a 2101 (bissextiles, 2000 et 2100 compris)",
          ecarts.length === 0, ecarts.join(", "));

  verifie("le 1er du mois suivant, y compris de decembre a janvier",
          X.premierJourDuMoisSuivant(jourDe(2026, 11, 23)) === jourDe(2026, 12, 1) &&
          X.premierJourDuMoisSuivant(jourDe(2026, 12, 31)) === jourDe(2027, 1, 1) &&
          X.premierJourDuMoisSuivant(jourDe(2028, 2, 1)) === jourDe(2028, 3, 1));

  verifie("moisDuJour refuse un jour qui n'est pas un entier",
          X.moisDuJour(1.5) === "" && X.moisDuJour("x") === "" && X.moisDuJour(NaN) === "");

  // Le choix de la saison.
  var S = X.SAISONS_BRECHES;
  verifie("saisonDuMois : la saison ecrite pour ce mois",
          X.saisonDuMois("2026-11", S) === S[0] && X.saisonDuMois("2026-12", S) === S[1]);
  var tous = [];
  for (var m = 1; m <= 24; m++) {
    var mois = (2027 + Math.floor((m - 1) / 12)) + "-" + ((m - 1) % 12 + 1 < 10 ? "0" : "") + ((m - 1) % 12 + 1);
    tous.push(X.saisonDuMois(mois, S));
  }
  verifie("un mois sans saison reprend les saisons a tour de role, toutes servent",
          tous.every(function (s) { return !!s; }) && tous[0] !== tous[1] &&
          S.every(function (s) { return tous.indexOf(s) !== -1; }));
  verifie("saisonDuMois : mois illisible ou liste vide -> null",
          X.saisonDuMois("2026-13", S) === null && X.saisonDuMois("x", S) === null &&
          X.saisonDuMois("2026-11", []) === null);

  // Quelles arenes portent une breche.
  var oui = 0, change = 0;
  for (var k = 0; k < 2000; k++) {
    var id = "way/" + (100000 + k * 7);
    var a = X.estAreneBreche(id, "temple", "2026-11", S);
    if (a) oui++;
    if (a !== X.estAreneBreche(id, "temple", "2026-12", S)) change++;
    if (a !== X.estAreneBreche(id, "temple", "2026-11", S)) { oui = -99999; break; }
  }
  verifie("environ une arene sur BRECHES_UNE_ARENE_SUR porte une breche, toujours la meme",
          oui > 2000 / X.BRECHES_UNE_ARENE_SUR * 0.7 && oui < 2000 / X.BRECHES_UNE_ARENE_SUR * 1.3,
          oui + " sur 2000");
  verifie("les breches changent de place d'une saison a l'autre", change > 100, change + " changements");
  verifie("pas de breche sans trio pour la categorie, ni sans id",
          !X.estAreneBreche("way/1", "piscine", "2026-11", S) && !X.estAreneBreche("", "temple", "2026-11", S) &&
          !X.estAreneBreche(null, "temple", "2026-11", S));
}


/* ------------------------------------------------------------
   BRIQUE 3 : LE CYCLE
   ------------------------------------------------------------ */

function testerCycle(monde, bloc, verifie, source) {
  bloc("Breches : le cycle de 7 jours");

  var X = monde().ctx;
  var S = X.SAISONS_BRECHES;
  var J = 20000;                     // un jour quelconque
  var trio = S[0].familles.temple;

  function neuve(id) { return X.creerBreche(id || "way/1", "temple", "2026-11"); }
  function gagner(b, jour, autres) { return X.gagnerBreche(b, jour, autres || [], S); }
  // Gagne n jours de suite a partir de jour. Rend la breche.
  function serie(b, jour, n) {
    for (var i = 0; i < n; i++) {
      var r = gagner(b, jour + i);
      if (!r.ok) throw new Error("serie refusee : " + r.raison);
      b = r.breche;
    }
    return b;
  }

  var etapes = [];
  for (var c = 0; c < 7; c++) {
    var e = X.etapeDuCran(c);
    etapes.push(e.role + e.cranDuRole + "/j" + e.jourDuCycle + "/x" + X.multiplicateurDuCran(c));
  }
  resultatEgal(verifie, "les 7 jours : A1 A2 A3, B1 B2 B3, final, et leur force", etapes,
    ["a1/j1/x1", "a2/j2/x1.15", "a3/j3/x1.3", "b1/j4/x1.4", "b2/j5/x1.61", "b3/j6/x1.82", "final1/j7/x2"]);

  var monte = true;
  for (var k = 1; k < 7; k++) if (!(X.multiplicateurDuCran(k) > X.multiplicateurDuCran(k - 1))) monte = false;
  verifie("la force monte strictement chaque jour du cycle", monte);
  verifie("un cran hors du cycle n'a ni etape ni force",
          X.etapeDuCran(-1) === null && X.etapeDuCran(7) === null && X.etapeDuCran(1.5) === null &&
          X.multiplicateurDuCran(7) === 0);

  var b0 = neuve();
  verifie("une breche neuve est disponible, boss A au cran 1, force 1",
          X.statutBreche(b0, J, []) === "disponible" &&
          JSON.stringify(X.bossDuJour(b0, J, S)) === JSON.stringify(
            { espece: trio.a, role: "a", cran: 0, cranDuRole: 1, jourDuCycle: 1, multiplicateur: 1 }));

  var avant = JSON.stringify(b0);
  var r1 = gagner(b0, J);
  verifie("la victoire du jour 1 : la breche passe au cran 1 et s'eteint jusqu'a demain",
          r1.ok && r1.breche.cran === 1 && r1.breche.dernier_jour === J && r1.breche.victoires === 1 &&
          X.statutBreche(r1.breche, J, []) === "eteinte" && X.statutBreche(r1.breche, J + 1, []) === "active",
          JSON.stringify(r1));
  verifie("gagnerBreche ne touche pas la breche recue", JSON.stringify(b0) === avant);
  verifie("une seule victoire par jour : la seconde est refusee (eteinte)",
          gagner(r1.breche, J).raison === "eteinte" && !gagner(r1.breche, J).ok);
  verifie("journal et trophee de la victoire",
          JSON.stringify(r1.entree) === JSON.stringify({ saison: "2026-11", arene_id: "way/1", jour: J, cran: 0,
                                                         role: "a", espece: trio.a, multiplicateur: 1 }) &&
          JSON.stringify(r1.trophee) === JSON.stringify({ id: "breche/2026-11/way/1/0", type: "victoire",
                                                          saison: "2026-11", arene_id: "way/1", jour: J, espece: trio.a }));

  verifie("le lendemain, le meme boss A, plus fort (cran 2)",
          X.bossDuJour(r1.breche, J + 1, S).espece === trio.a && X.bossDuJour(r1.breche, J + 1, S).cranDuRole === 2 &&
          X.bossDuJour(r1.breche, J + 1, S).multiplicateur === 1.15);

  var b3 = serie(neuve(), J, 3);
  verifie("jour 4 : le boss B, une autre espece, au cran 1",
          X.bossDuJour(b3, J + 3, S).espece === trio.b && X.bossDuJour(b3, J + 3, S).role === "b" &&
          X.bossDuJour(b3, J + 3, S).cranDuRole === 1 && trio.b !== trio.a);

  var b6 = serie(neuve(), J, 6);
  verifie("jour 7 : le boss final, sa propre espece, la force la plus haute",
          X.bossDuJour(b6, J + 6, S).espece === trio.final && X.bossDuJour(b6, J + 6, S).role === "final" &&
          X.bossDuJour(b6, J + 6, S).multiplicateur === 2);

  var r7 = gagner(b6, J + 6);
  verifie("battre le final rend la breche possedee, trophee de possession",
          r7.ok && r7.breche.possedee === true && r7.breche.jour_possession === J + 6 && r7.breche.cran === 7 &&
          r7.breche.victoires === 7 && r7.trophee.type === "possession" && r7.entree.role === "final");
  verifie("une breche possedee ne fait plus rien : ni boss, ni victoire, meme des mois plus tard",
          X.statutBreche(r7.breche, J + 7, []) === "possedee" && X.bossDuJour(r7.breche, J + 7, S) === null &&
          gagner(r7.breche, J + 7).raison === "possedee" && gagner(r7.breche, J + 400).raison === "possedee");

  // --- La serie tolerante ---
  var b4 = serie(neuve(), J, 4);    // gagne J..J+3 : cran 4 (B2) attendu a J+4
  verifie("pas d'absence : on reprend au cran suivant", X.cranDuJour(b4, J + 4) === 4);
  verifie("1 jour manque : 1 cran perdu", X.cranDuJour(b4, J + 5) === 3 && X.statutBreche(b4, J + 5, []) === "active");
  verifie("3 jours manques : 3 crans perdus (retour au boss A cran 2)",
          X.cranDuJour(b4, J + 7) === 1 && X.bossDuJour(b4, J + 7, S).espece === trio.a &&
          X.bossDuJour(b4, J + 7, S).cranDuRole === 2);
  verifie("plancher au jour 1 : jamais sous le cran 0",
          X.cranDuJour(b4, J + 8) === 0 && X.cranDuJour(b4, J + 9) === 0 &&
          X.statutBreche(b4, J + 9, []) === "disponible");
  verifie("absence tres longue (30 ans) : jour 1, sans plantage",
          X.cranDuJour(b4, J + 11000) === 0 && X.bossDuJour(b4, J + 11000, S).cran === 0 &&
          gagner(b4, J + 11000).ok && gagner(b4, J + 11000).breche.cran === 1);
  verifie("jour 7 manque d'un jour : on retombe au boss B cran 3",
          X.cranDuJour(b6, J + 7) === 5 && X.bossDuJour(b6, J + 7, S).role === "b" &&
          X.bossDuJour(b6, J + 7, S).cranDuRole === 3);
  var reprise = gagner(b4, J + 7);
  verifie("apres une absence, la victoire repart du cran du jour",
          reprise.ok && reprise.entree.cran === 1 && reprise.breche.cran === 2);

  verifie("l'horloge qui recule ne donne pas de seconde victoire",
          X.statutBreche(r1.breche, J - 1, []) === "eteinte" && gagner(r1.breche, J - 5).raison === "eteinte");
  verifie("un jour illisible est refuse",
          gagner(neuve(), 1.5).raison === "jour_invalide" && gagner(neuve(), NaN).raison === "jour_invalide" &&
          gagner(neuve(), "demain").raison === "jour_invalide");
  verifie("une saison sans trio pour ce lieu : pas de boss",
          X.gagnerBreche(X.creerBreche("way/1", "piscine", "2026-11"), J, [], S).raison === "sans_boss");

  // --- Le plafond ---
  // Trois breches gagnees hier (J), donc en cours aujourd'hui (J + 1).
  var a1 = serie(neuve("way/a1"), J - 1, 2), a2 = serie(neuve("way/a2"), J, 1), a3 = serie(neuve("way/a3"), J - 2, 3);
  var trois = [a1, a2, a3];
  verifie("3 breches en cours : une 4e ne peut pas s'ouvrir (plafond)",
          X.compterActives(trois, J + 1) === 3 &&
          X.statutBreche(neuve("way/a4"), J + 1, trois) === "plafond" &&
          gagner(neuve("way/a4"), J + 1, trois).raison === "plafond");
  verifie("les 3 breches en cours, elles, continuent",
          trois.every(function (b) { return gagner(b, J + 1, trois).ok; }));
  verifie("le plafond ne compte pas la breche elle-meme",
          X.compterActives(trois, J + 1, "way/a1") === 2 && X.statutBreche(a1, J + 1, trois) === "active");
  // r7 est possedee a J + 6 ; p1 et p2 sont en cours a J + 7.
  var avecPossedee = [serie(neuve("way/p1"), J + 6, 1), serie(neuve("way/p2"), J + 5, 2), r7.breche];
  verifie("une breche possedee ne compte pas dans le plafond",
          X.compterActives(avecPossedee, J + 7) === 2 &&
          X.statutBreche(neuve("way/a4"), J + 7, avecPossedee) === "disponible");
  // a3 gagnee une seule fois, a J - 2 : a J + 1 elle a manque deux jours, retour au cran 0.
  var retombee = [a1, a2, serie(neuve("way/a3"), J - 2, 1)];
  verifie("une breche retombee au jour 1 libere sa place",
          X.compterActives(retombee, J + 1) === 2 &&
          X.statutBreche(neuve("way/a4"), J + 1, retombee) === "disponible");
  verifie("une breche eteinte (gagnee aujourd'hui) compte dans le plafond",
          X.compterActives([gagner(neuve("way/x"), J).breche], J) === 1);

  // --- La force dans le combat ---
  var adv = [{ pv: 10, pvMax: 40, atq: 7 }, { pv: 1, pvMax: 1, atq: 1 }];
  X.appliquerForceBoss(adv, 1.61);
  verifie("appliquerForceBoss : PV pleins et ATQ multiplies, arrondis",
          adv[0].pvMax === 64 && adv[0].pv === 64 && adv[0].atq === 11 && adv[1].pvMax === 2 && adv[1].atq === 2,
          JSON.stringify(adv));
  var intact = [{ pv: 5, pvMax: 40, atq: 7 }];
  X.appliquerForceBoss(intact, 0.5);
  X.appliquerForceBoss(intact, NaN);
  X.appliquerForceBoss(null, 2);
  verifie("appliquerForceBoss : un multiplicateur sous 1 ou illisible ne change rien",
          intact[0].pv === 5 && intact[0].pvMax === 40 && intact[0].atq === 7);

  // --- Ni horloge ni hasard dans les regles ---
  var code = source("js/breches.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  verifie("js/breches.js ne lit ni l'horloge ni le hasard (ni Date, ni Math.random)",
          !/\bDate\b/.test(code) && !/Math\.random/.test(code) && !/performance\.now/.test(code));
}

// Comparaison de valeurs, avec l'ecart en clair.
function resultatEgal(verifie, quoi, obtenu, attendu) {
  var o = JSON.stringify(obtenu), a = JSON.stringify(attendu);
  verifie(quoi, o === a, "attendu " + a + "\n        obtenu  " + o);
}


module.exports = { lancerTestsBreches: lancerTestsBreches };
