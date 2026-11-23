/* ============================================================
   LES BRECHES PERMANENTES DANS LE JEU (LE BRANCHEMENT)

   Correspondance de vocabulaire : "breche" est le mot du joueur.
   Les "poches d'Oubli" de js/poche.js sont un AUTRE systeme
   (breches sporadiques a minuteur) ; rien ici ne les touche.

   Les regles vivent dans js/breches.js (pures) et les monstres de
   chaque mois dans js/saisons.js. Ce fichier fait le reste :
     - il lit l'horloge et le fuseau (et c'est le SEUL a le faire
       pour les breches) ;
     - il choisit la cle de sauvegarde : CLE_BRECHES, ou
       CLE_BRECHES_TEST quand le mode test est actif ;
     - il bascule la saison au changement de mois ;
     - il pose un anneau autour des arenes qui portent une breche,
       selon son etat du jour (ouverte, refermee jusqu'a demain,
       possedee, hors d'atteinte) ;
     - il fabrique le "donjon" du boss du jour, que js/carte.js
       met a la place de l'arene dans le bandeau, et que
       js/ecran3.js combat avec le multiplicateur du cran ;
     - il inscrit la victoire.

   IL NE FAIT RIEN tant que BRECHES_PERMANENTES_ACTIF vaut false
   (js/config.js) et que l'interrupteur "Breches" du mode test est
   sur Non : actif() rend false, chaque accroche rend ce qu'on lui
   a donne, aucun anneau n'est pose, rien n'est lu ni ecrit.

   LE COMBAT D'UNE BRECHE passe toujours par Ecran3, avec un seul
   adversaire, meme si l'ecran a plusieurs est eteint : l'ancien
   combat (js/combat.js) ne sait pas appliquer un multiplicateur.
   Le boss est un donjon fabrique ici, id "breche/" + id de l'arene :
   l'arene elle-meme n'est jamais marquee capturee par ce combat.
   Assimiler le boss compte comme une victoire (c'en est une pour
   Ecran3).

   Ce fichier expose un seul global : window.BrechesJeu.
   ============================================================ */

window.BrechesJeu = (function () {

var donnees = null;        // les donnees chargees, ou null
var cleChargee = "";       // sous quelle cle elles ont ete lues
var jourVu = null;         // le jour des anneaux affiches
var anneaux = {};          // id de l'arene -> L.circleMarker

/* L'horloge et le fuseau. Remplacables par les tests seulement
   (pourTests.reglerHorloge) : js/breches.js ne lit jamais l'heure,
   c'est ici qu'elle entre. */
var horloge = {
  maintenant: function () { return Date.now(); },
  decalage: function (instant) { return new Date(instant).getTimezoneOffset(); }
};


/* ------------------------------------------------------------
   1. EST-CE ALLUME ? QUEL JOUR ? QUELLE CLE ?
   ------------------------------------------------------------ */

function enTest() { return typeof ModeTest !== "undefined" && ModeTest.actif(); }

function actif() {
  if (BRECHES_PERMANENTES_ACTIF) return true;
  return enTest() && ModeTest.reglages.breches === true;
}

function cle() { return enTest() ? CLE_BRECHES_TEST : CLE_BRECHES; }

/* Le jour local du joueur. Le mode test peut y ajouter des jours
   simules (ModeTest.joursSimules) : jamais en dehors du mode test. */
function aujourdhui() {
  var t = horloge.maintenant();
  var simules = enTest() && typeof ModeTest.joursSimules === "function" ? ModeTest.joursSimules() : 0;
  return jourCalendaire(t, horloge.decalage(t)) + simules;
}

/* Les donnees du jour, chargees si besoin, la saison basculee si le
   mois a change. null quand le systeme est eteint ou que le jour
   est illisible. Seule la bascule ecrit ici. */
function preparer() {
  if (!actif()) return null;
  var jour = aujourdhui();
  var mois = moisDuJour(jour);
  if (!mois) return null;

  var c = cle();
  if (!donnees || cleChargee !== c) {
    donnees = chargerBreches(c, mois);
    cleChargee = c;
  }
  var b = basculerSaison(donnees, mois, BRECHES_JOUEUR_ID);
  if (b.change) {
    donnees = b.donnees;
    sauverBreches(c, donnees);
  }
  return donnees;
}

// Oublie les donnees en memoire : la prochaine lecture repart du disque.
function oublier() {
  donnees = null;
  cleChargee = "";
}


/* ------------------------------------------------------------
   2. L'ARENE ET SA BRECHE
   ------------------------------------------------------------ */

/* La breche de cette arene aujourd'hui :
     { breche, statut, boss, jour }  ou null si elle n'en porte pas.
   Le terrain d'essai du mode test porte une breche quand il a
   brecheEssai (js/modetest.js) ; un autre donjon fictif, jamais. */
function infoArene(d) {
  var dn = preparer();
  if (!dn || !d || typeof d.id !== "string" || d.breche) return null;

  if (d.fictif) {
    if (!d.brecheEssai || !enTest()) return null;
  } else if (!estAreneBreche(d.id, d.categorie, dn.saison, SAISONS_BRECHES)) {
    return null;
  }

  var jour = aujourdhui();
  var breche = brecheDeLArene(dn, d.id, d.categorie);
  var boss = bossDuJour(breche, jour, SAISONS_BRECHES);
  var statut = statutBreche(breche, jour, dn.breches);
  if (!boss && statut !== "possedee") return null;     // saison sans trio pour ce lieu

  return { breche: breche, statut: statut, boss: boss, jour: jour };
}

function combattable(info) {
  return !!info && !!info.boss && (info.statut === "active" || info.statut === "disponible");
}

/* Le donjon du boss du jour. Il garde la position, le niveau et le
   Figement de l'arene ; tout ce que le combat doit figer au depart
   est dans "breche" (le jour, le cran, la force). */
function donjonDuBoss(arene, info) {
  return {
    id: "breche/" + arene.id,
    lat: arene.lat, lon: arene.lon,
    lieu: arene.lieu,
    nom: txt("breche.nomLieu", { nom: arene.nom }),
    categorie: arene.categorie,
    espece: info.boss.espece,
    niveau: arene.niveau,
    figement: figementDuLieu(arene),
    capture: false,
    dissipe: false,
    fictif: !!arene.fictif,
    breche: {
      areneId: arene.id,
      categorie: arene.categorie,
      jour: info.jour,
      cran: info.boss.cran,
      role: info.boss.role,
      jourDuCycle: info.boss.jourDuCycle,
      multiplicateur: info.boss.multiplicateur
    }
  };
}

/* L'accroche du bandeau (mettreAJourHud, js/carte.js) : si l'arene
   la plus proche porte une breche ouverte aujourd'hui, c'est son
   boss qui prend la place. Sinon l'arene, telle quelle. */
function surDonjonProche(d) {
  if (!actif() || !d) return d;
  var info = infoArene(d);
  return combattable(info) ? donjonDuBoss(d, info) : d;
}

function force(m) { return String(Math.round(m * 100) / 100); }

/* Une ligne de plus pour le bandeau, ou "". Pour le boss : le jour
   du cycle et sa force. Pour une arene : pourquoi sa breche ne
   s'ouvre pas. */
function noteHud(d) {
  if (!actif() || !d) return "";
  if (d.breche) {
    return '<span class="breche-note">' + txt("breche.hud.boss", {
      jour: d.breche.jourDuCycle, cycle: BRECHES_CYCLE_JOURS, force: force(d.breche.multiplicateur)
    }) + "</span>";
  }
  var info = infoArene(d);
  if (!info) return "";
  if (info.statut === "eteinte") return '<span class="breche-note">' + txt("breche.hud.eteinte") + "</span>";
  if (info.statut === "possedee") return '<span class="breche-note">' + txt("breche.hud.possedee") + "</span>";
  if (info.statut === "plafond") {
    return '<span class="breche-note">' + txt("breche.hud.plafond", { max: BRECHES_ACTIVES_MAX }) + "</span>";
  }
  return "";
}

// La ligne de l'infobulle d'une arene (texteInfobulle, js/carte.js).
function ligneInfobulle(d) {
  if (!actif() || !d || d.fictif) return "";
  var info = infoArene(d);
  if (!info) return "";
  var texte = info.statut === "possedee" ? txt("breche.pop.possedee")
            : info.statut === "eteinte" ? txt("breche.pop.eteinte")
            : info.statut === "plafond" ? txt("breche.pop.plafond")
            : txt("breche.pop.ouverte", { jour: info.boss.jourDuCycle, cycle: BRECHES_CYCLE_JOURS });
  return '<div class="pop-breche">' + texte + "</div>";
}


/* ------------------------------------------------------------
   3. LES ANNEAUX SUR LA CARTE

   Un cercle sans remplissage, un peu plus grand que le marqueur de
   l'arene, pose par-dessus. Il ne recoit pas les touchers
   (interactive: false) : l'infobulle reste celle de l'arene, qui
   gagne une ligne sur la breche (ligneInfobulle).
   ------------------------------------------------------------ */

var STYLES_ANNEAU = {
  disponible: { color: "#b455d4", weight: 3, dashArray: null },
  active:     { color: "#b455d4", weight: 5, dashArray: null },
  eteinte:    { color: "#888888", weight: 3, dashArray: "4 5" },
  plafond:    { color: "#888888", weight: 2, dashArray: "1 6" },
  possedee:   { color: "#d4a02a", weight: 4, dashArray: null, fill: true, fillColor: "#d4a02a",
                fillOpacity: 0.25, className: "breche-possedee" }
};

function styleAnneau(statut) {
  var s = STYLES_ANNEAU[statut];
  if (!s) return null;
  return {
    radius: 17, interactive: false,
    color: s.color, weight: s.weight, dashArray: s.dashArray, opacity: 0.95,
    fill: !!s.fill, fillColor: s.fillColor || s.color, fillOpacity: s.fillOpacity || 0,
    className: s.className || "breche-anneau"
  };
}

function retirerAnneau(id) {
  if (anneaux[id]) {
    anneaux[id].remove();
    delete anneaux[id];
  }
}

/* Pose (ou repose) l'anneau d'une arene. Appelee par poserMarqueur
   et rafraichirMarqueur (js/carte.js) : chaque fois que l'arene est
   redessinee, son anneau suit. Ne fait rien pour une arene sans
   breche ou un donjon fictif. */
function poserAnneau(d) {
  if (!d || typeof d.id !== "string") return;
  retirerAnneau(d.id);
  if (!actif() || d.fictif) return;
  var info = infoArene(d);
  var style = info && styleAnneau(info.statut);
  if (!style) return;
  anneaux[d.id] = L.circleMarker([d.lat, d.lon], style).addTo(carte);
}

// Toutes les arenes connues : au demarrage, au changement de jour,
// quand le mode test allume ou eteint les breches.
function rafraichirTout() {
  for (var id in anneaux) retirerAnneau(id);
  jourVu = actif() ? aujourdhui() : null;
  // Eteint, la boucle remet aussi les infobulles sans leur ligne.
  for (var k in donjons) {
    if (marqueurs[k]) rafraichirMarqueur(donjons[k]);
    else poserAnneau(donjons[k]);
  }
}

// Appelee a chaque bandeau : minuit passe, les anneaux changent.
function verifierJour() {
  if (!actif()) {
    if (jourVu !== null) rafraichirTout();
    return;
  }
  if (aujourdhui() !== jourVu) rafraichirTout();
}

// Au demarrage du jeu (js/jeu.js), apres le chargement des arenes.
function demarrer() {
  if (!actif()) return;
  preparer();
  rafraichirTout();
}


/* ------------------------------------------------------------
   4. LA VICTOIRE

   Appelee par Ecran3 a la fin d'un combat gagne contre un boss
   (donjon.breche). Le jour inscrit est celui FIGE au debut du
   combat : un combat commence avant minuit compte pour la veille.
   Rend les lignes a ajouter au journal du combat.
   ------------------------------------------------------------ */

function victoire(d) {
  if (!d || !d.breche || !actif()) return [];
  var dn = preparer();
  if (!dn) return [];

  var b = d.breche;
  var r = inscrireVictoire(dn, b.areneId, b.categorie, b.jour, SAISONS_BRECHES);
  if (!r.ok) return [];

  donnees = r.donnees;
  sauverBreches(cle(), donnees);

  // L'arene redessinee : son anneau et son infobulle suivent.
  if (!d.fictif && donjons[b.areneId]) rafraichirMarqueur(donjons[b.areneId]);

  if (r.trophee.type === "possession") {
    return [txt("breche.victoire.possession"), txt("breche.trophee")];
  }
  return [txt("breche.victoire.jour"), txt("breche.trophee")];
}

/* ------------------------------------------------------------
   5. POUR LE MODE TEST SEULEMENT

   Ces trois fonctions refusent de travailler hors du mode test
   (enTest() faux : elles rendent false ou [] sans rien toucher). En
   mode test, cle() est CLE_BRECHES_TEST : elles ne peuvent donc pas
   ecrire dans la vraie partie.
   ------------------------------------------------------------ */

/* Une victoire sans combat, au jour du jeu (jours simules compris) :
   ce que fait "Finir la semaine". false si la breche de ce lieu ne
   se combat pas aujourd'hui. */
function simulerVictoire(d) {
  if (!enTest() || !actif()) return false;
  var info = infoArene(d);
  if (!combattable(info)) return false;
  var r = inscrireVictoire(donnees, d.id, d.categorie, info.jour, SAISONS_BRECHES);
  if (!r.ok) return false;
  donnees = r.donnees;
  sauverBreches(cle(), donnees);
  return true;
}

// Remet les breches du mode test a zero (journal et trophees compris).
function effacerTest() {
  if (!enTest()) return false;
  var mois = moisDuJour(aujourdhui());
  if (!mois) return false;
  donnees = donneesBrechesVides(mois);
  cleChargee = cle();
  sauverBreches(cleChargee, donnees);
  return true;
}

/* L'etat lisible, pour le panneau : une ligne par breche commencee,
   puis les compteurs. Rend [] hors du mode test. */
function lignesEtat() {
  if (!enTest()) return [];
  var dn = preparer();
  if (!dn) return ["Brèches éteintes"];
  var jour = aujourdhui();
  var d = dateDuJour(jour);
  var lignes = [
    "Jour " + d.quantieme + "/" + d.mois + "/" + d.annee +
      (ModeTest.joursSimules() ? " (+" + ModeTest.joursSimules() + " simulés)" : "") +
      " · saison " + dn.saison,
    "Possédées : " + compterPossedees(dn) + " · ouvertes : " + compterActives(dn.breches, jour) + "/" +
      BRECHES_ACTIVES_MAX
  ];
  dn.breches.forEach(function (b) {
    var statut = statutBreche(b, jour, dn.breches);
    var boss = bossDuJour(b, jour, SAISONS_BRECHES);
    lignes.push(b.arene_id + " · " + statut +
                (boss ? " · jour " + boss.jourDuCycle + "/" + BRECHES_CYCLE_JOURS + " " +
                        (ESPECES[boss.espece] || {}).nom + " ×" + force(boss.multiplicateur) : ""));
  });
  lignes.push("Journal : " + dn.journal.length + " · trophées : " + dn.trophees.length +
              " · saisons passées : " + dn.saisons_passees.length);
  return lignes;
}


// Pour l'ecran du combat : la ligne qui annonce le boss.
function annonce(d) {
  if (!d || !d.breche) return "";
  return txt(d.breche.role === "final" ? "breche.combat.final" : "breche.combat.annonce", {
    jour: d.breche.jourDuCycle, cycle: BRECHES_CYCLE_JOURS, force: force(d.breche.multiplicateur)
  });
}


return {
  actif: actif,
  aujourdhui: aujourdhui,
  preparer: preparer,
  oublier: oublier,
  infoArene: infoArene,
  surDonjonProche: surDonjonProche,
  noteHud: noteHud,
  ligneInfobulle: ligneInfobulle,
  poserAnneau: poserAnneau,
  rafraichirTout: rafraichirTout,
  verifierJour: verifierJour,
  demarrer: demarrer,
  victoire: victoire,
  annonce: annonce,
  cle: cle,
  simulerVictoire: simulerVictoire,
  effacerTest: effacerTest,
  lignesEtat: lignesEtat,

  // Pour verifier/breches.js seulement.
  pourTests: {
    reglerHorloge: function (maintenant, decalage) {
      horloge = { maintenant: maintenant, decalage: decalage };
    },
    styleAnneau: styleAnneau,
    anneaux: function () { return anneaux; },
    donnees: function () { return donnees; }
  }
};

})();
