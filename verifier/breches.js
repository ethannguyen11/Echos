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
    testerSaison(monde, bloc, verifie);
    testerSauvegarde(monde, bloc, verifie);
    testerJeu(monde, bloc, verifie);
    testerModeTest(monde, bloc, verifie);
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

/* ------------------------------------------------------------
   BRIQUE 4 : LA SAISON
   ------------------------------------------------------------ */

function testerSaison(monde, bloc, verifie) {
  bloc("Breches : saisons mensuelles et bilan");

  var X = monde().ctx;
  var S = X.SAISONS_BRECHES;
  var NOV = X.jourDeLaDate(2026, 11, 10);       // un jour de novembre 2026
  var trioT = S[0].familles.temple;

  // Une saison de novembre bien remplie : way/1 possedee (jours 10 a
  // 16), way/2 commencee (2 victoires), way/3 possedee plus tard.
  function novembre() {
    var d = X.donneesBrechesVides("2026-11");
    function gagne(id, cat, debut, n) {
      for (var i = 0; i < n; i++) {
        var r = X.inscrireVictoire(d, id, cat, debut + i, S);
        if (!r.ok) throw new Error(id + " refusee : " + r.raison);
        d = r.donnees;
      }
    }
    gagne("way/1", "temple", NOV, 7);
    gagne("way/2", "parc", NOV, 2);
    gagne("node/3", "metro", NOV + 1, 7);
    return d;
  }

  var d0 = X.donneesBrechesVides("2026-11");
  verifie("des donnees neuves : la saison, et tout le reste vide",
          JSON.stringify(d0) === JSON.stringify({ version: 1, saison: "2026-11", breches: [], journal: [],
                                                  trophees: [], saisons_passees: [] }));

  var r1 = X.inscrireVictoire(d0, "way/1", "temple", NOV, S);
  verifie("inscrire une victoire : la breche est ajoutee, une ligne de journal, un trophee",
          r1.ok && r1.donnees.breches.length === 1 && r1.donnees.breches[0].cran === 1 &&
          r1.donnees.journal.length === 1 && r1.donnees.journal[0].espece === trioT.a &&
          r1.donnees.trophees.length === 1 && r1.donnees.trophees[0].id === "breche/2026-11/way/1/0",
          JSON.stringify(r1));
  verifie("inscrire une victoire ne touche pas les donnees recues",
          d0.breches.length === 0 && d0.journal.length === 0 && d0.trophees.length === 0);
  var r2 = X.inscrireVictoire(r1.donnees, "way/1", "temple", NOV + 1, S);
  verifie("la victoire suivante met la meme breche a jour, sans doublon",
          r2.ok && r2.donnees.breches.length === 1 && r2.donnees.breches[0].cran === 2 && r2.donnees.journal.length === 2);
  verifie("inscrire refuse ce que gagnerBreche refuse (meme jour)",
          X.inscrireVictoire(r1.donnees, "way/1", "temple", NOV, S).raison === "eteinte");
  verifie("inscrire refuse un jour d'un autre mois que la saison des donnees",
          X.inscrireVictoire(d0, "way/1", "temple", X.jourDeLaDate(2026, 12, 1), S).raison === "autre_saison" &&
          X.inscrireVictoire(d0, "way/1", "temple", 1.5, S).raison === "jour_invalide");
  verifie("le plafond tient aussi dans les donnees",
          (function () {
            var d = d0;
            ["way/a", "way/b", "way/c"].forEach(function (id) { d = X.inscrireVictoire(d, id, "temple", NOV, S).donnees; });
            return X.inscrireVictoire(d, "way/d", "temple", NOV, S).raison === "plafond";
          })());

  var nov = novembre();
  verifie("le compteur du mois : 2 breches possedees", X.compterPossedees(nov) === 2);

  resultatEgal(verifie, "le bilan pour le classement, trie par jour de possession",
    X.bilanClassement(nov, "local"),
    { format: 1, saison: "2026-11", joueur_id: "local", possedees: 2,
      breches: [{ arene_id: "way/1", jour_possession: NOV + 6 }, { arene_id: "node/3", jour_possession: NOV + 7 }] });
  verifie("le bilan est du JSON pur : il survit a un aller-retour sans changer",
          JSON.stringify(JSON.parse(JSON.stringify(X.bilanClassement(nov, "local")))) ===
          JSON.stringify(X.bilanClassement(nov, "local")));

  var avant = JSON.stringify(nov);
  var b = X.basculerSaison(nov, "2026-12", "local");
  var dec = b.donnees;
  verifie("la bascule de decembre remet les breches et le compteur a zero",
          b.change === true && dec.saison === "2026-12" && dec.breches.length === 0 && X.compterPossedees(dec) === 0);
  verifie("la bascule garde tout le journal et tous les trophees de novembre",
          dec.journal.length === nov.journal.length && dec.journal.length === 16 &&
          nov.trophees.every(function (t) { return dec.trophees.some(function (u) { return u.id === t.id; }); }));
  verifie("la bascule range le bilan de novembre dans les saisons passees",
          dec.saisons_passees.length === 1 &&
          JSON.stringify(dec.saisons_passees[0]) === JSON.stringify(X.bilanClassement(nov, "local")));
  verifie("la bascule donne un trophee de saison (2 possedees)",
          dec.trophees.filter(function (t) { return t.type === "saison"; }).length === 1 &&
          JSON.stringify(dec.trophees[dec.trophees.length - 1]) ===
          JSON.stringify({ id: "saison/2026-11", type: "saison", saison: "2026-11", possedees: 2 }));
  verifie("la bascule ne touche pas les donnees recues", JSON.stringify(nov) === avant);

  var vide = X.basculerSaison(X.donneesBrechesVides("2026-11"), "2026-12", "local").donnees;
  verifie("un mois sans breche possedee : bilan a 0, pas de trophee de saison",
          vide.saisons_passees.length === 1 && vide.saisons_passees[0].possedees === 0 && vide.trophees.length === 0);

  verifie("meme mois, mois illisible : rien ne change",
          X.basculerSaison(nov, "2026-11", "local").change === false &&
          X.basculerSaison(nov, "2026-11", "local").donnees === nov &&
          X.basculerSaison(nov, "bientot", "local").change === false);
  verifie("une horloge revenue a un mois passe ne rebascule pas",
          X.basculerSaison(dec, "2026-11", "local").change === false && X.basculerSaison(dec, "2026-11", "local").donnees === dec);

  var deux = X.basculerSaison(X.basculerSaison(nov, "2027-02", "local").donnees, "2027-03", "local").donnees;
  verifie("plusieurs mois d'absence : une seule bascule, puis la suivante",
          deux.saison === "2027-03" && deux.saisons_passees.length === 2 &&
          deux.saisons_passees[0].saison === "2026-11" && deux.saisons_passees[1].saison === "2027-02");

  // Le bestiaire change avec le mois.
  var dDec = X.inscrireVictoire(dec, "way/1", "temple", X.jourDeLaDate(2026, 12, 2), S);
  verifie("en decembre, la meme arene a les boss de la saison de decembre",
          dDec.ok && dDec.entree.espece === S[1].familles.temple.a && dDec.entree.espece !== trioT.a);

  // Les plafonds du journal et des trophees.
  var plein = X.donneesBrechesVides("2026-11");
  for (var i = 0; i < X.BRECHES_JOURNAL_MAX + 5; i++) plein.journal.push({ jour: i });
  var apres = X.inscrireVictoire(plein, "way/9", "temple", NOV, S).donnees;
  verifie("le journal garde les plus recentes au-dela de BRECHES_JOURNAL_MAX",
          apres.journal.length === X.BRECHES_JOURNAL_MAX && apres.journal[apres.journal.length - 1].arene_id === "way/9" &&
          apres.journal[0].jour === 6);
  verifie("un trophee deja gagne n'est pas ajoute deux fois",
          X.ajouterTrophee([{ id: "t" }], { id: "t" }).length === 1 &&
          X.ajouterTrophee([{ id: "t" }], { id: "u" }).length === 2);
}

/* ------------------------------------------------------------
   BRIQUE 5 : LA SAUVEGARDE
   ------------------------------------------------------------ */

function testerSauvegarde(monde, bloc, verifie) {
  bloc("Breches : sauvegarde");

  var base = monde().ctx;
  var S = base.SAISONS_BRECHES;
  var CLE = base.CLE_BRECHES;
  var NOV = base.jourDeLaDate(2026, 11, 10);

  // Une vraie partie du joueur et une poche, ecrites par le jeu lui-meme.
  var mj = monde();
  mj.ctx.chargerJoueur();
  mj.ctx.ajouterAlaCollection("peng", 4);
  mj.ctx.gourde.hinezumi = { mince: 2, grand: 0, complet: 0 };
  mj.ctx.sauverJoueur();
  mj.ctx.chargerPoches();
  mj.ctx.ajouterPoche(mj.ctx.creerPoche("leger", { lat: 1, lon: 2, arene_id: null }, 1000));
  mj.ctx.sauverPoches();
  var joueurAvant = mj.stockage.echos_joueur_v5, pochesAvant = mj.stockage.echos_poches_v1;

  function mondeAvec(cles) {
    var st = { echos_joueur_v5: joueurAvant, echos_poches_v1: pochesAvant };
    for (var c in cles) st[c] = cles[c];
    return monde(st);
  }

  // Des donnees bien remplies : 2 breches, journal, trophees, un bilan passe.
  function remplies(X) {
    var d = X.basculerSaison(X.donneesBrechesVides("2026-10"), "2026-11", "local").donnees;
    for (var i = 0; i < 7; i++) d = X.inscrireVictoire(d, "way/1", "temple", NOV + i, S).donnees;
    d = X.inscrireVictoire(d, "node/2", "parc", NOV, S).donnees;
    // way/3 : deux victoires, trois jours d'absence, une reprise : 3 victoires, cran 1.
    [NOV, NOV + 1, NOV + 5].forEach(function (j) { d = X.inscrireVictoire(d, "way/3", "metro", j, S).donnees; });
    return d;
  }

  var w0 = mondeAvec({});
  var err = null, d0 = null;
  try { d0 = w0.ctx.chargerBreches(CLE, "2026-11"); } catch (e) { err = e; }
  verifie("aucune cle de breches : donnees vides du mois, sans exception",
          err === null && JSON.stringify(d0) === JSON.stringify(w0.ctx.donneesBrechesVides("2026-11")));
  verifie("charger n'ecrit rien", !Object.prototype.hasOwnProperty.call(w0.stockage, CLE));

  var corrompus = ["{pas du json", "null", "42", '"texte"', "[]", "[1,2]", '{"breches":"x","journal":7}', "true"];
  verifie("JSON corrompu ou format inattendu : donnees vides, aucune exception",
          corrompus.every(function (brut) {
            var w = mondeAvec({});
            w.stockage[CLE] = brut;
            try {
              var d = w.ctx.chargerBreches(CLE, "2026-11");
              return d.saison === "2026-11" && d.breches.length === 0 && d.journal.length === 0 &&
                     d.trophees.length === 0 && d.saisons_passees.length === 0;
            } catch (e) { return false; }
          }));

  verifie("un stockage qui leve une exception : donnees vides, et sauver rend false",
          (function () {
            var w = mondeAvec({});
            w.ctx.localStorage.getItem = function () { throw new Error("bloque"); };
            w.ctx.localStorage.setItem = function () { throw new Error("plein"); };
            try {
              return w.ctx.chargerBreches(CLE, "2026-11").breches.length === 0 &&
                     w.ctx.sauverBreches(CLE, w.ctx.donneesBrechesVides("2026-11")) === false;
            } catch (e) { return false; }
          })());

  // L'aller-retour.
  var wr = mondeAvec({});
  var pleines = remplies(wr.ctx);
  var ok = wr.ctx.sauverBreches(CLE, pleines);
  var relues = mondeAvec({}); relues.stockage[CLE] = wr.stockage[CLE];
  var d1 = relues.ctx.chargerBreches(CLE, "2027-05");
  verifie("aller-retour : sauver puis relire rend exactement les memes donnees",
          ok && JSON.stringify(d1) === JSON.stringify(pleines) && d1.breches.length === 3 &&
          d1.breches[2].victoires === 3 && d1.breches[2].cran === 1 && d1.journal.length === 11 && d1.saisons_passees.length === 1,
          JSON.stringify(d1).slice(0, 300));
  verifie("la sauvegarde n'est que sous CLE_BRECHES",
          Object.keys(wr.stockage).sort().join(",") === [CLE, "echos_joueur_v5", "echos_poches_v1"].sort().join(","));

  // Les breches abimees, une par une.
  var bonne = pleines.breches[1];
  function b(changement) {
    var x = JSON.parse(JSON.stringify(bonne));
    for (var k in changement) x[k] = changement[k];
    return x;
  }
  var abimees = [
    bonne,
    null, 42, "breche", [],
    b({ arene_id: "" }), b({ arene_id: 7 }), b({ categorie: null }), b({ saison: "novembre" }),
    b({ arene_id: "way/c1", cran: 9 }), b({ arene_id: "way/c2", cran: -1 }), b({ arene_id: "way/c3", cran: 1.5 }),
    b({ arene_id: "way/c4", dernier_jour: "hier" }), b({ arene_id: "way/c5", cran: 2, dernier_jour: null }),
    b({ arene_id: "way/c6", possedee: true }),                        // possedee sans le cran 7
    b({ arene_id: "way/c7", cran: 7, possedee: false }),              // cran 7 sans possession
    b({ arene_id: bonne.arene_id, cran: 3 }),                         // doublon : la premiere gagne
    b({ arene_id: "way/oct", saison: "2026-10" }),                    // une autre saison
    b({ arene_id: "way/ratt", victoires: "beaucoup", intrus: 1 })     // se rattrape
  ];
  var wa = mondeAvec({});
  wa.stockage[CLE] = JSON.stringify({ version: 1, saison: "2026-11", breches: abimees,
                                      journal: pleines.journal, trophees: pleines.trophees, saisons_passees: [] });
  var da = wa.ctx.chargerBreches(CLE, "2026-11");
  verifie("breches abimees ecartees une par une, doublon et autre saison ecartes",
          da.breches.length === 2 && da.breches[0].arene_id === bonne.arene_id && da.breches[0].cran === bonne.cran &&
          da.breches[1].arene_id === "way/ratt",
          JSON.stringify(da.breches.map(function (x) { return x.arene_id; })));
  verifie("breche rattrapee : victoires remises au cran, champ intrus perdu",
          da.breches[1] && da.breches[1].victoires === bonne.cran && da.breches[1].intrus === undefined);
  verifie("une breche possedee sans jour de possession le reprend du dernier jour",
          wa.ctx.normaliserBreche(b({ cran: 7, possedee: true, dernier_jour: NOV + 6, jour_possession: "?" })).jour_possession === NOV + 6);

  var e0 = pleines.journal[0], t0 = pleines.trophees[0];
  function avec(o, ch) { var x = JSON.parse(JSON.stringify(o)); for (var k in ch) x[k] = ch[k]; return x; }
  var wj = mondeAvec({});
  wj.stockage[CLE] = JSON.stringify({
    saison: "2026-11", breches: [],
    journal: [e0, null, avec(e0, { jour: "x" }), avec(e0, { role: "c" }), avec(e0, { cran: 8 }),
              avec(e0, { multiplicateur: 0.5 }), avec(e0, { espece: "" }), avec(e0, { saison: "?" })],
    trophees: [t0, t0, null, avec(t0, { id: "" }), avec(t0, { type: "medaille", id: "z1" }),
               avec(t0, { jour: null, id: "z2" }), { id: "saison/2026-10", type: "saison", saison: "2026-10", possedees: 3 },
               { id: "saison/x", type: "saison", saison: "2026-09", possedees: -1 }],
    saisons_passees: [{ saison: "2026-10", joueur_id: "local", possedees: 9,
                        breches: [{ arene_id: "way/1", jour_possession: 5 }, { arene_id: "", jour_possession: 6 }, null] },
                      { saison: "?" }, null]
  });
  var dj = wj.ctx.chargerBreches(CLE, "2026-11");
  verifie("lignes de journal abimees ecartees, les bonnes gardees",
          dj.journal.length === 1 && JSON.stringify(dj.journal[0]) === JSON.stringify(e0));
  verifie("trophees abimes ou en double ecartes, trophee de saison garde",
          dj.trophees.length === 2 && dj.trophees[0].id === t0.id && dj.trophees[1].type === "saison",
          JSON.stringify(dj.trophees));
  verifie("bilan passe abime : nettoye, son compte suit la liste gardee",
          dj.saisons_passees.length === 1 && dj.saisons_passees[0].possedees === 1 &&
          dj.saisons_passees[0].format === 1 && dj.saisons_passees[0].breches.length === 1);
  verifie("une saison enregistree illisible prend le mois donne",
          (function () {
            var w = mondeAvec({});
            w.stockage[CLE] = JSON.stringify({ saison: 12, breches: [bonne] });
            var d = w.ctx.chargerBreches(CLE, "2026-11");
            return d.saison === "2026-11" && d.breches.length === 1;
          })());

  // La preuve : la partie du joueur et les poches ne bougent pas.
  var wp = mondeAvec({});
  var X = wp.ctx;
  var d = X.chargerBreches(CLE, "2026-11");
  for (var i = 0; i < 7; i++) {
    d = X.inscrireVictoire(d, "way/1", "temple", NOV + i, S).donnees;
    X.sauverBreches(CLE, d);
  }
  d = X.basculerSaison(d, "2026-12", "local").donnees;
  X.sauverBreches(CLE, d);
  X.chargerBreches(CLE, "2026-12");
  X.sauverBreches(X.CLE_BRECHES_TEST, X.donneesBrechesVides("2026-12"));
  verifie("echos_joueur_v5 et echos_poches_v1 restent identiques, octet pour octet",
          wp.stockage.echos_joueur_v5 === joueurAvant && wp.stockage.echos_poches_v1 === pochesAvant &&
          joueurAvant.length > 50 && pochesAvant.length > 50);
  verifie("les Echos assimiles et la gourde sont toujours la apres une bascule",
          (function () { X.chargerJoueur(); return !!X.collection.peng && X.gourde.hinezumi.mince === 2; })());
}

/* ------------------------------------------------------------
   BRIQUE 6 : LE BRANCHEMENT DANS LE JEU
   Un vrai combat Ecran3, de bout en bout, dans le faux navigateur.
   ------------------------------------------------------------ */

var JOUR_MS = 86400000;
var NOV_10 = Date.UTC(2026, 10, 9, 20, 0);      // 4 h du matin a Taipei, le 10 novembre 2026

// Le meme decor que mondeC3 (verifier/parcours.js) : les deux ecrans
// de combat, Ico et l'aide.
var IDS_COMBAT = ["combat3", "c3-lieu", "c3-adversaires", "c3-ordre", "c3-equipe", "c3-journal",
  "c3-commandes", "c3-aptitudes",
  "combat-lieu", "m-nom", "monstre-img", "monstre-vide", "combat-actions",
  "aptitudes", "liste-aptitudes", "btn-fermer-aptitudes", "figement-bloc",
  "f-jauge", "f-libelle", "f-val", "m-fleche", "m-affinite", "m-pv", "m-jauge", "scene",
  "btn-attaquer", "btn-aptitude", "btn-assimiler", "btn-defendre", "btn-fuir",
  "btn-ico", "ico-pastille", "ico", "ico-portrait", "ico-sections", "ico-fragments",
  "ico-bulle", "ico-bulle-l1", "ico-bulle-l2"];

function testerJeu(monde, bloc, verifie) {
  bloc("Breches : dans le jeu");

  var vm = require("vm"), fs = require("fs"), path = require("path");

  /* options : actif (BRECHES_PERMANENTES_ACTIF), modeTest (MODE_TEST),
     brechesTest (l'interrupteur du panneau), stockage, instant. */
  function mondeJeu(o) {
    var m = monde(o.stockage || {});
    IDS_COMBAT.forEach(function (id) {
      m.statiques[id] = parcours.creerElement("div");
      m.statiques[id].id = id;
    });
    ["js/ico.js", "js/aide.js"].forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), m.ctx, { filename: f });
    });
    var X = m.ctx;
    X.MODE_TEST = !!o.modeTest;
    X.BRECHES_PERMANENTES_ACTIF = !!o.actif;
    X.ModeTest.reglages.breches = !!o.brechesTest;
    m.instant = o.instant || NOV_10;
    X.BrechesJeu.pourTests.reglerHorloge(function () { return m.instant; }, function () { return -480; });
    X.chargerJoueur();
    X.collection = {};
    X.equipe = [];
    [["hinezumi", 30], ["peng", 30], ["jinchan", 30]].forEach(function (e) { X.ajouterAlaCollection(e[0], e[1]); });
    X.sauverJoueur();
    X.majFiche();
    X.Ecran3.pourTests.reglerAlea(function () { return 0.5; });
    return m;
  }

  // Deux arenes : la premiere qui porte une breche de temple en
  // novembre 2026, et une qui n'en porte pas.
  var X0 = monde().ctx;
  var idBreche = null, idSans = null;
  for (var k = 1; k < 500 && (!idBreche || !idSans); k++) {
    var id = "way/" + (900000 + k);
    if (X0.estAreneBreche(id, "temple", "2026-11", X0.SAISONS_BRECHES)) { if (!idBreche) idBreche = id; }
    else if (!idSans) idSans = id;
  }
  var trio = X0.SAISONS_BRECHES[0].familles.temple;

  function arene(m, id, niveau) {
    var d = { id: id, lat: 25.03, lon: 121.56, lieu: "Longshan", nom: "Porte du Temple de Longshan",
              categorie: "temple", espece: "komainu", niveau: niveau || 3, capture: false, dissipe: false };
    m.ctx.donjons[id] = d;
    m.ctx.poserMarqueur(d);
    return d;
  }

  function etat3(m) { return m.ctx.Ecran3.pourTests.etat(); }
  function clic(b) { b.declencher("click", { target: null, stopPropagation: function () {} }); }
  function attendreMain(m) {
    for (var i = 0; i < 400; i++) {
      var e = etat3(m);
      if (!e || e.phase === "commande" || e.phase === "fin") return e;
      m.horloge.avancer(250);
    }
    return etat3(m);
  }
  // Joue jusqu'a la fin avec la commande donnee. Rend l'issue.
  function finir(m, commande) {
    for (var i = 0; i < 300; i++) {
      var e = attendreMain(m);
      if (!e || e.phase === "fin") break;
      clic(e.cmd[commande || "attaquer"]);
      if (e.phase === "ciblage") clic(e.cartes[e.cibles[0]].racine);
    }
    m.horloge.avancer(120000);
    return etat3(m) && etat3(m).issue;
  }
  function lignes(m) { return etat3(m).historique.map(function (h) { return h.ligne; }); }
  function sortir(m) { var e = etat3(m); if (e && e.cmd) clic(e.cmd.sortie); }
  function lue(m, cle) { return m.stockage[cle] ? JSON.parse(m.stockage[cle]) : null; }
  function clesBreches(m) {
    return Object.keys(m.stockage).filter(function (c) { return c.indexOf("echos_breches") === 0; });
  }
  // Le combat du boss du jour, de l'approche a la sortie.
  function combattre(m, d, commande) {
    var boss = m.ctx.BrechesJeu.surDonjonProche(d);
    m.ctx.Ecran3.lancer(boss, false);
    var e = etat3(m);
    var adv = e ? e.combat.adversaires.map(function (u) { return { pvMax: u.pvMax, atq: u.atq, espece: u.espece }; }) : [];
    var issue = finir(m, commande);
    var l = etat3(m) ? lignes(m) : [];
    sortir(m);
    return { boss: boss, adv: adv, issue: issue, lignes: l };
  }

  verifie("deux arenes d'essai trouvees (une breche de temple en novembre, une sans)", !!idBreche && !!idSans);

  // --- Eteint : le jeu ne change pas ---
  var mo = mondeJeu({});
  var Xo = mo.ctx;
  var dOff = arene(mo, idBreche);
  Xo.BrechesJeu.demarrer();
  Xo.BrechesJeu.verifierJour();
  verifie("eteint : le lieu reste le lieu, ni bandeau, ni infobulle, ni anneau",
          Xo.BrechesJeu.actif() === false && Xo.BrechesJeu.surDonjonProche(dOff) === dOff &&
          Xo.BrechesJeu.noteHud(dOff) === "" && Xo.texteInfobulle(dOff).indexOf("pop-breche") === -1 &&
          Object.keys(Xo.BrechesJeu.pourTests.anneaux()).length === 0 && Xo.BrechesJeu.preparer() === null);
  Xo.dernierePosition = [dOff.lat, dOff.lon];
  Xo.mettreAJourHud(dOff.lat, dOff.lon);
  verifie("eteint : le bandeau montre l'Echo de l'arene, sans breche",
          Xo.donjonProche === dOff && mo.statiques.texte.innerHTML.indexOf("Brèche") === -1 &&
          mo.statiques.texte.innerHTML.indexOf("Komainu") !== -1, mo.statiques.texte.innerHTML);
  Xo.Ecran3.lancer(dOff, false);
  verifie("eteint : Approcher ouvre l'ancien combat, comme avant",
          !Xo.Ecran3.enCours() && !!Xo.combat);
  verifie("eteint : aucune cle de breches n'est ecrite", clesBreches(mo).length === 0, clesBreches(mo).join(","));

  // --- Allume : le jour 1 ---
  var m1 = mondeJeu({ actif: true });
  var X1 = m1.ctx;
  var d1 = arene(m1, idBreche), sans = arene(m1, idSans);
  X1.COMBAT_MULTI_ADVERSAIRES_LIEU = 3;      // la breche doit rester a 1 adversaire
  X1.BrechesJeu.demarrer();
  var boss1 = X1.BrechesJeu.surDonjonProche(d1);
  verifie("le jour du jeu est le jour local du joueur (Taipei : deja le 10, a Londres encore le 9)",
          X1.BrechesJeu.aujourdhui() === X1.jourDeLaDate(2026, 11, 10));
  verifie("allume : la cle est la vraie, le mode test est eteint, rien n'est ecrit au demarrage",
          X1.BrechesJeu.cle() === "echos_breches_v1" && clesBreches(m1).length === 0);
  verifie("une arene sans breche reste elle-meme, sans anneau",
          X1.BrechesJeu.surDonjonProche(sans) === sans && !X1.BrechesJeu.pourTests.anneaux()[idSans]);
  verifie("l'arene de la breche : un anneau, une ligne d'infobulle",
          !!X1.BrechesJeu.pourTests.anneaux()[idBreche] &&
          X1.texteInfobulle(d1).indexOf("Brèche ouverte · jour 1/7") !== -1);
  verifie("son boss du jour : le boss A de la saison, au niveau et au Figement de l'arene",
          boss1 !== d1 && boss1.id === "breche/" + idBreche && boss1.espece === trio.a && boss1.niveau === 3 &&
          boss1.figement === X1.figementDuLieu(d1) && boss1.fictif === false &&
          boss1.breche.multiplicateur === 1 && boss1.breche.jourDuCycle === 1 && boss1.breche.areneId === idBreche,
          JSON.stringify(boss1));
  X1.dernierePosition = [d1.lat, d1.lon];
  X1.mettreAJourHud(d1.lat, d1.lon);
  verifie("le bandeau annonce le boss de la breche, jour 1 sur 7",
          X1.donjonProche.breche && m1.statiques.texte.innerHTML.indexOf("Brèche · jour 1/7 · force ×1") !== -1 &&
          m1.statiques.entrer.style.display === "block", m1.statiques.texte.innerHTML);

  // La force de reference : le meme adversaire, sans breche.
  var base = X1.creerCombatMulti([{ espece: "hinezumi", niveau: 30 }, { espece: "peng", niveau: 30 },
                                  { espece: "jinchan", niveau: 30 }],
                                 [{ espece: trio.a, niveau: X1.niveauAdversaire(boss1) }], {}).combat.adversaires[0];
  var c1 = combattre(m1, d1);
  verifie("le boss se bat dans Ecran3 (meme ecran a plusieurs eteint), seul, a la force x1",
          c1.adv.length === 1 && c1.adv[0].espece === trio.a && c1.adv[0].pvMax === base.pvMax &&
          c1.adv[0].atq === base.atq && X1.COMBAT_MULTI_ACTIF === false, JSON.stringify(c1.adv));
  var s1 = lue(m1, "echos_breches_v1");
  verifie("la victoire du jour est inscrite : cran 1, journal, trophee",
          c1.issue === "victoire" && s1 && s1.breches.length === 1 && s1.breches[0].cran === 1 &&
          s1.breches[0].dernier_jour === X1.BrechesJeu.aujourdhui() && s1.journal.length === 1 &&
          s1.trophees.length === 1 && s1.trophees[0].type === "victoire",
          c1.issue + " " + JSON.stringify(s1));
  verifie("le journal du combat annonce le boss et la breche refermee",
          c1.lignes.some(function (l) { return l.indexOf("Une brèche s'ouvre : jour 1 sur 7") !== -1; }) &&
          c1.lignes.some(function (l) { return l.indexOf(X1.txt("breche.victoire.jour")) !== -1; }),
          c1.lignes.join(" | "));
  verifie("l'arene n'est pas marquee capturee, et la cle de test n'est pas touchee",
          d1.capture === false && d1.dissipe === false && !m1.stockage.echos_breches_test_v1);
  verifie("apres la victoire : l'arene reprend sa place, la breche est refermee jusqu'a demain",
          X1.BrechesJeu.surDonjonProche(d1) === d1 &&
          X1.BrechesJeu.noteHud(d1).indexOf(X1.txt("breche.hud.eteinte")) !== -1 &&
          X1.texteInfobulle(d1).indexOf("Brèche refermée") !== -1 &&
          !!X1.BrechesJeu.pourTests.anneaux()[idBreche]);
  X1.mettreAJourHud(d1.lat, d1.lon);
  verifie("le bandeau du lieu dit que la breche revient demain",
          X1.donjonProche === d1 && m1.statiques.texte.innerHTML.indexOf("revient demain") !== -1,
          m1.statiques.texte.innerHTML);
  // Le boss du jour 1, battu une seconde fois (un ecran reste ouvert,
  // un double appui) : rien ne doit s'inscrire.
  var avantRefus = m1.stockage.echos_breches_v1;
  var encore = X1.BrechesJeu.victoire(boss1);
  verifie("une seconde victoire le meme jour n'est pas inscrite",
          encore.length === 0 && m1.stockage.echos_breches_v1 === avantRefus);

  // Le lendemain.
  m1.instant += JOUR_MS;
  X1.BrechesJeu.verifierJour();
  var c2 = combattre(m1, d1);
  verifie("le lendemain : le meme boss, plus fort (x1.15)",
          c2.boss.breche.jourDuCycle === 2 && c2.boss.breche.multiplicateur === 1.15 &&
          c2.adv[0].pvMax === Math.round(base.pvMax * 1.15) && c2.adv[0].atq === Math.round(base.atq * 1.15) &&
          c2.issue === "victoire" && lue(m1, "echos_breches_v1").breches[0].cran === 2,
          JSON.stringify(c2.adv) + " " + c2.issue);

  // La fuite ne compte pas.
  m1.instant += JOUR_MS;
  X1.Ecran3.pourTests.reglerAlea(function () { return 0; });
  var avantFuite = m1.stockage.echos_breches_v1;
  var cf = combattre(m1, d1, "fuir");
  verifie("fuir le boss n'inscrit rien", cf.issue === "fuite" && m1.stockage.echos_breches_v1 === avantFuite, cf.issue);

  // Assimiler le boss : c'est une victoire, et l'arene reste intacte.
  var donjonsAvant = m1.stockage.echos_donjons_v5;
  var ca = combattre(m1, d1, "assimiler");
  verifie("assimiler le boss compte comme la victoire du jour, sans capturer l'arene",
          ca.issue === "victoire" && lue(m1, "echos_breches_v1").breches[0].cran === 3 &&
          !!X1.collection[trio.a] && d1.capture === false && m1.stockage.echos_donjons_v5 === donjonsAvant,
          ca.issue + " " + JSON.stringify(lue(m1, "echos_breches_v1").breches[0]));
  X1.Ecran3.pourTests.reglerAlea(function () { return 0.5; });

  // Le jour 7 et la possession.
  var jour = X1.BrechesJeu.aujourdhui() + 1;
  var mp = mondeJeu({ actif: true, instant: m1.instant + JOUR_MS, stockage: { echos_breches_v1: JSON.stringify({
    version: 1, saison: "2026-11", journal: [], trophees: [], saisons_passees: [],
    breches: [{ arene_id: idBreche, categorie: "temple", saison: "2026-11", cran: 6, dernier_jour: jour - 1,
                possedee: false, jour_possession: null, victoires: 6 }] }) } });
  var dp = arene(mp, idBreche);
  var cp = combattre(mp, dp);
  var sp = lue(mp, "echos_breches_v1");
  verifie("jour 7 : le boss final, sa propre espece, force x2",
          cp.boss.espece === trio.final && cp.boss.breche.role === "final" && cp.boss.breche.multiplicateur === 2 &&
          cp.lignes.some(function (l) { return l.indexOf("Septième jour") !== -1; }));
  verifie("battre le final : la breche est possedee, trophee de possession, message de possession",
          cp.issue === "victoire" && sp.breches[0].possedee === true && sp.breches[0].jour_possession === jour &&
          sp.trophees.some(function (t) { return t.type === "possession"; }) &&
          cp.lignes.some(function (l) { return l.indexOf(mp.ctx.txt("breche.victoire.possession")) !== -1; }),
          cp.issue + " " + JSON.stringify(sp));
  mp.instant += 3 * JOUR_MS;
  verifie("une breche possedee : plus de boss, le bandeau et l'infobulle le disent",
          mp.ctx.BrechesJeu.surDonjonProche(dp) === dp &&
          mp.ctx.BrechesJeu.noteHud(dp).indexOf(mp.ctx.txt("breche.hud.possedee")) !== -1 &&
          mp.ctx.texteInfobulle(dp).indexOf("Brèche possédée") !== -1);
  var stylePos = mp.ctx.BrechesJeu.pourTests.styleAnneau("possedee");
  verifie("l'anneau d'une breche possedee est dore et porte l'effet de possession",
          stylePos.color === "#d4a02a" && stylePos.fill === true && stylePos.className === "breche-possedee" &&
          stylePos.interactive === false &&
          mp.ctx.BrechesJeu.pourTests.styleAnneau("active").className === "breche-anneau" &&
          mp.ctx.BrechesJeu.pourTests.styleAnneau("eteinte").dashArray !== null &&
          mp.ctx.BrechesJeu.pourTests.styleAnneau("inconnu") === null);

  // Le plafond, vu du jeu.
  var j0 = mondeJeu({ actif: true }).ctx.BrechesJeu.aujourdhui();
  function enCours(id) {
    return { arene_id: id, categorie: "parc", saison: "2026-11", cran: 2, dernier_jour: j0 - 1,
             possedee: false, jour_possession: null, victoires: 2 };
  }
  var mf = mondeJeu({ actif: true, stockage: { echos_breches_v1: JSON.stringify({ saison: "2026-11",
    breches: [enCours("way/x1"), enCours("way/x2"), enCours("way/x3")] }) } });
  var df = arene(mf, idBreche);
  verifie("3 breches deja ouvertes : celle-ci ne s'ouvre pas, le bandeau dit pourquoi",
          mf.ctx.BrechesJeu.surDonjonProche(df) === df &&
          mf.ctx.BrechesJeu.noteHud(df).indexOf("3 brèches sont déjà ouvertes") !== -1 &&
          mf.ctx.texteInfobulle(df).indexOf("hors d'atteinte") !== -1);
  verifie("une arene decouverte apres le demarrage recoit son anneau des sa pose",
          !!mf.ctx.BrechesJeu.pourTests.anneaux()[idBreche]);

  // La bascule au demarrage.
  var mb = mondeJeu({ actif: true, stockage: { echos_breches_v1: JSON.stringify({ saison: "2026-10",
    breches: [enCours("way/x1")], journal: [], trophees: [] }) } });
  mb.ctx.BrechesJeu.demarrer();
  var sb = lue(mb, "echos_breches_v1");
  verifie("au demarrage d'un nouveau mois, la saison bascule et c'est enregistre",
          sb.saison === "2026-11" && sb.breches.length === 0 && sb.saisons_passees.length === 1 &&
          sb.saisons_passees[0].saison === "2026-10");

  // Le terrain d'essai n'est jamais une breche sans le dire.
  var mt = mondeJeu({ actif: true, modeTest: true });
  var fictif = mt.ctx.ModeTest.donjonDeTest(25, 121);
  verifie("le terrain d'essai du mode test n'est pas une breche par defaut",
          mt.ctx.BrechesJeu.surDonjonProche(fictif) === fictif);

  // Le mode test ecrit dans sa propre cle.
  var mq = mondeJeu({ modeTest: true, brechesTest: true });
  var dq = arene(mq, idBreche);
  var cq = combattre(mq, dq);
  verifie("mode test (interrupteur Breches) : tout va dans echos_breches_test_v1, rien dans la vraie cle",
          mq.ctx.BrechesJeu.actif() && cq.issue === "victoire" && !!mq.stockage.echos_breches_test_v1 &&
          !mq.stockage.echos_breches_v1 && mq.ctx.BrechesJeu.cle() === "echos_breches_test_v1");
  var mr = mondeJeu({ actif: true, modeTest: true });
  verifie("meme allume pour de vrai, le mode test garde sa propre cle",
          mr.ctx.BrechesJeu.cle() === "echos_breches_test_v1");

  verifie("les accroches de js/carte.js et js/ecran3.js passent toutes par BrechesJeu",
          ["js/carte.js", "js/ecran3.js"].every(function (f) {
            var s = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
            return s.indexOf("BrechesJeu.") !== -1 && s.indexOf("echos_breches") === -1 && s.indexOf("CLE_BRECHES") === -1;
          }));
}

/* ------------------------------------------------------------
   BRIQUE 7 : LES OUTILS DU MODE TEST
   Les vrais boutons du panneau, touches dans le faux navigateur.
   ------------------------------------------------------------ */

function testerModeTest(monde, bloc, verifie) {
  bloc("Breches : outils du mode test");

  var vm = require("vm"), fs = require("fs"), path = require("path");
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var idsPage = [];
  html.replace(/\bid="([^"]+)"/g, function (t, id) { idsPage.push(id); });

  // Un monde avec TOUS les elements de la page (le panneau compris).
  function mondePanneau(o) {
    var m = monde(o.stockage || {});
    idsPage.forEach(function (id) {
      if (m.statiques[id]) return;
      m.statiques[id] = parcours.creerElement("div");
      m.statiques[id].id = id;
    });
    // Un vrai <select> a ses options ; le panneau relit la premiere.
    m.statiques["mt-chapitre"].options = [parcours.creerElement("option")];
    ["js/ico.js", "js/aide.js"].forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), m.ctx, { filename: f });
    });
    var X = m.ctx;
    X.MODE_TEST = o.modeTest !== false;
    X.BRECHES_PERMANENTES_ACTIF = !!o.actif;
    m.instant = NOV_10;
    X.BrechesJeu.pourTests.reglerHorloge(function () { return m.instant; }, function () { return -480; });
    X.chargerJoueur();
    X.collection = {};
    X.equipe = [];
    [["hinezumi", 30], ["peng", 30], ["jinchan", 30]].forEach(function (e) { X.ajouterAlaCollection(e[0], e[1]); });
    X.sauverJoueur();
    X.majFiche();
    X.Ecran3.pourTests.reglerAlea(function () { return 0.5; });
    X.dernierePosition = [25.03, 121.56];
    return m;
  }
  function clic(m, id) { m.statiques[id].declencher("click", { target: null, stopPropagation: function () {} }); }
  function choisir(m, id, v) { m.statiques[id].value = String(v); m.statiques[id].declencher("change"); }
  function lue(m, cle) { return m.stockage[cle] ? JSON.parse(m.stockage[cle]) : null; }
  function etat3(m) { return m.ctx.Ecran3.pourTests.etat(); }
  function combattreIci(m) {
    var X = m.ctx;
    X.mettreAJourHud(25.03, 121.56);
    var boss = X.donjonProche;
    X.Ecran3.lancer(boss, false);
    for (var i = 0; i < 300; i++) {
      var e = etat3(m);
      if (!e || e.phase === "fin") break;
      if (e.phase !== "commande") { m.horloge.avancer(250); continue; }
      e.cmd.attaquer.declencher("click", { target: null });
      if (e.phase === "ciblage") e.cartes[e.cibles[0]].racine.declencher("click", { target: null });
    }
    m.horloge.avancer(120000);
    var issue = etat3(m) && etat3(m).issue;
    if (etat3(m)) etat3(m).cmd.sortie.declencher("click", { target: null });
    return { boss: boss, issue: issue };
  }

  // --- Mode test eteint : aucun outil ne fait rien ---
  var mo = mondePanneau({ modeTest: false, actif: true, stockage: { echos_breches_test_jours: "5" } });
  var Xo = mo.ctx;
  var joueurO = mo.stockage.echos_joueur_v5;
  var jourReel = Xo.jourDeLaDate(2026, 11, 10);
  // Une vraie arene a breche, ouverte aujourd'hui : simuler doit pourtant refuser.
  var vraie = null;
  for (var k = 1; !vraie && k < 500; k++) {
    if (Xo.estAreneBreche("way/" + (900000 + k), "temple", "2026-11", Xo.SAISONS_BRECHES)) {
      vraie = { id: "way/" + (900000 + k), lat: 1, lon: 2, categorie: "temple", niveau: 3, nom: "x", lieu: "x" };
    }
  }
  var ouverte = !!Xo.BrechesJeu.surDonjonProche(vraie).breche;
  var refus = [Xo.ModeTest.avancerJours(3), Xo.ModeTest.moisSuivant(), Xo.ModeTest.reinitialiserBreches(),
               Xo.BrechesJeu.simulerVictoire(vraie),
               Xo.BrechesJeu.effacerTest()];
  verifie("mode test eteint : les jours simules sont ignores, le jeu suit le vrai jour",
          Xo.ModeTest.joursSimules() === 0 && Xo.BrechesJeu.aujourdhui() === jourReel);
  verifie("mode test eteint : chaque outil refuse, sans rien ecrire",
          ouverte && refus.every(function (r) { return r === false; }) &&
          Xo.ModeTest.finirSemaine() === "breches eteintes" &&
          Xo.BrechesJeu.lignesEtat().length === 0 &&
          JSON.stringify(Object.keys(mo.stockage).sort()) === JSON.stringify(["echos_breches_test_jours", "echos_joueur_v5"]) &&
          mo.stockage.echos_breches_test_jours === "5" && mo.stockage.echos_joueur_v5 === joueurO,
          JSON.stringify(refus) + " " + Object.keys(mo.stockage).join(","));

  // --- Mode test allume ---
  var m = mondePanneau({});
  var X = m.ctx, S = m.statiques;
  var joueurAvant = m.stockage.echos_joueur_v5;
  X.ModeTest.preparerPanneau();
  verifie("le panneau : interrupteur sur Non, outils caches",
          S["mt-breches"].textContent === "Brèches : Non" && !S["mt-breches-outils"].classList.contains("actif") &&
          !X.BrechesJeu.actif());
  clic(m, "mt-breches");
  verifie("Breches : Oui allume le systeme et montre les outils",
          S["mt-breches"].textContent === "Brèches : Oui" && S["mt-breches-outils"].classList.contains("actif") &&
          X.BrechesJeu.actif() && S["mt-breche-terrain"].innerHTML.indexOf("Brèche d'essai 4") !== -1);
  verifie("sur Arene normale, Finir la semaine demande une breche d'essai",
          X.ModeTest.finirSemaine() === "choisis une breche d'essai");

  choisir(m, "mt-breche-terrain", 1);
  var terrain = X.ModeTest.donjonDeTest(25.03, 121.56);
  verifie("Breche d'essai 1 : le terrain devient une breche de la famille de l'espece choisie",
          terrain.id === "test/breche/1" && terrain.brecheEssai === true && terrain.fictif === true &&
          terrain.categorie === X.ESPECES[X.ModeTest.reglages.espece].famille);

  var c1 = combattreIci(m);
  var t1 = lue(m, "echos_breches_test_v1");
  verifie("le combat du terrain d'essai inscrit la victoire dans la cle de test",
          c1.boss.breche && c1.boss.breche.areneId === "test/breche/1" && c1.issue === "victoire" &&
          t1 && t1.breches[0].arene_id === "test/breche/1" && t1.breches[0].cran === 1,
          c1.issue + " " + JSON.stringify(t1));
  verifie("... sans toucher la vraie cle ni la partie du joueur (combat d'essai)",
          !m.stockage.echos_breches_v1 && m.stockage.echos_joueur_v5 === joueurAvant);

  clic(m, "mt-jour-1");
  verifie("+1 jour : le lendemain, la breche se rouvre au cran suivant",
          X.ModeTest.joursSimules() === 1 && m.stockage.echos_breches_test_jours === "1" &&
          X.BrechesJeu.aujourdhui() === jourReel + 1 &&
          X.BrechesJeu.infoArene(terrain).statut === "active" && X.BrechesJeu.infoArene(terrain).boss.cran === 1);

  clic(m, "mt-jour-3");
  verifie("+3 jours : trois jours manques, trois crans perdus (retour au jour 1)",
          X.ModeTest.joursSimules() === 4 && X.BrechesJeu.infoArene(terrain).boss.cran === 0 &&
          X.BrechesJeu.infoArene(terrain).statut === "disponible");

  clic(m, "mt-semaine");
  var ap = X.BrechesJeu.infoArene(terrain);
  var t2 = lue(m, "echos_breches_test_v1");
  verifie("Finir la semaine : six victoires, six jours, le boss final attend",
          ap.statut === "active" && ap.boss.role === "final" && X.ModeTest.joursSimules() === 10 &&
          t2.journal.length === 7 && t2.breches[0].cran === 6,
          JSON.stringify(ap) + " jours " + X.ModeTest.joursSimules());

  var cf = combattreIci(m);
  var t3 = lue(m, "echos_breches_test_v1");
  verifie("le boss final se bat a la main, et la breche d'essai est possedee",
          cf.boss.breche.role === "final" && cf.issue === "victoire" && t3.breches[0].possedee === true);
  verifie("Finir la semaine sur une breche possedee ne fait rien",
          X.ModeTest.finirSemaine() === "possedee" && lue(m, "echos_breches_test_v1").journal.length === 8);

  clic(m, "mt-etat");
  verifie("Etat : le panneau montre la saison, les compteurs et la breche",
          S["mt-breches-texte"].innerHTML.indexOf("saison 2026-11") !== -1 &&
          S["mt-breches-texte"].innerHTML.indexOf("Possédées : 1") !== -1 &&
          S["mt-breches-texte"].innerHTML.indexOf("test/breche/1 · possedee") !== -1,
          S["mt-breches-texte"].innerHTML);

  clic(m, "mt-mois");
  var t4 = lue(m, "echos_breches_test_v1");
  verifie("Mois suivant : on est le 1er decembre, la saison a bascule",
          X.BrechesJeu.aujourdhui() === X.jourDeLaDate(2026, 12, 1) && t4.saison === "2026-12" &&
          t4.breches.length === 0 && t4.saisons_passees[0].possedees === 1 &&
          t4.trophees.some(function (t) { return t.type === "saison"; }) &&
          S["mt-breches-texte"].innerHTML.indexOf("saison 2026-12") !== -1,
          JSON.stringify(t4).slice(0, 300));
  verifie("en decembre, la breche d'essai a les boss de la saison de decembre",
          X.BrechesJeu.infoArene(terrain).boss.espece === X.SAISONS_BRECHES[1].familles[terrain.categorie].a);

  // Le plafond, avec les quatre breches d'essai.
  [1, 2, 3].forEach(function (n) {
    choisir(m, "mt-breche-terrain", n);
    X.BrechesJeu.simulerVictoire(X.ModeTest.donjonDeTest(25.03, 121.56));
  });
  choisir(m, "mt-breche-terrain", 4);
  var quatre = X.ModeTest.donjonDeTest(25.03, 121.56);
  X.mettreAJourHud(25.03, 121.56);
  verifie("quatre breches d'essai : la 4e bute sur le plafond, le bandeau le dit",
          X.BrechesJeu.infoArene(quatre).statut === "plafond" && X.ModeTest.finirSemaine() === "plafond" &&
          X.donjonProche.id === "test/breche/4" && S.texte.innerHTML.indexOf("3 brèches sont déjà ouvertes") !== -1,
          S.texte.innerHTML);

  clic(m, "mt-raz");
  var t5 = lue(m, "echos_breches_test_v1");
  verifie("Reinitialiser : jours a 0, breches d'essai, journal et trophees vides",
          X.ModeTest.joursSimules() === 0 && m.stockage.echos_breches_test_jours === "0" &&
          t5.saison === "2026-11" && t5.breches.length === 0 && t5.journal.length === 0 && t5.trophees.length === 0);

  clic(m, "mt-breches");
  verifie("Breches : Non eteint tout : terrain d'essai ordinaire, plus de boss",
          !X.BrechesJeu.actif() && X.ModeTest.donjonDeTest(1, 2).id === "test/fictif" &&
          X.BrechesJeu.surDonjonProche(X.ModeTest.donjonDeTest(1, 2)).breche === undefined);
  verifie("de bout en bout : la vraie cle n'a jamais ete ecrite, la partie du joueur n'a pas bouge",
          !m.stockage.echos_breches_v1 && m.stockage.echos_joueur_v5 === joueurAvant);
}

// Comparaison de valeurs, avec l'ecart en clair.
function resultatEgal(verifie, quoi, obtenu, attendu) {
  var o = JSON.stringify(obtenu), a = JSON.stringify(attendu);
  verifie(quoi, o === a, "attendu " + a + "\n        obtenu  " + o);
}


module.exports = { lancerTestsBreches: lancerTestsBreches };
