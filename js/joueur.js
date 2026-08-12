/* ============================================================
   LE JOUEUR : sa collection et son equipe
   ============================================================ */

var collection = {};   // { komainu: { espece, niveau, xp, pv } }
var equipe = [];       // jusqu'a 3 identifiants d'espece

function nouvelEcho(especeId, niveau) {
  var s = statsAuNiveau(especeId, niveau);
  return { espece: especeId, niveau: niveau, xp: 0, pv: s.pvMax };
}

function ajouterAlaCollection(especeId, niveau) {
  var existant = collection[especeId];

  if (!existant) {
    collection[especeId] = nouvelEcho(especeId, niveau);
    if (equipe.length < EQUIPE_MAX) equipe.push(especeId);
    return "nouveau";
  }

  if (niveau > existant.niveau) {
    existant.niveau = niveau;
    existant.pv = statsAuNiveau(especeId, niveau).pvMax;
    return "renforce";
  }

  return "connu";
}

function xpRequis(niveau) { return 12 + niveau * 14; }

function gagnerXp(especeId, gain) {
  var e = collection[especeId];
  if (!e) return null;

  e.xp += gain;
  var montees = 0;

  while (e.xp >= xpRequis(e.niveau) && e.niveau < 50) {
    e.xp -= xpRequis(e.niveau);
    e.niveau++;
    montees++;
    e.pv = statsAuNiveau(especeId, e.niveau).pvMax;   // soin a la montee
  }

  return montees;
}


/* ------------------------------------------------------------
   SAUVEGARDE DU JOUEUR
   ------------------------------------------------------------ */

function sauverJoueur() {
  try {
    localStorage.setItem(CLE_JOUEUR, JSON.stringify({ collection: collection, equipe: equipe }));
  } catch (e) {}
}

function chargerJoueur() {
  try {
    var brut = localStorage.getItem(CLE_JOUEUR);
    if (brut) {
      var d = JSON.parse(brut);
      collection = d.collection || {};
      equipe = d.equipe || [];
    }
  } catch (e) {}

  // Premier lancement : Jin Chan te suit deja, au niveau 3.
  // En dessous, un Echo seul ne survit a aucune rencontre.
  if (Object.keys(collection).length === 0) {
    ajouterAlaCollection("jinchan", 3);
    sauverJoueur();
  }

  majFiche();
}

function majFiche() {
  var f = document.getElementById("fiche");

  if (equipe.length === 0) {
    f.textContent = "Equipe vide";
    return;
  }

  var noms = [];
  for (var i = 0; i < equipe.length; i++) {
    var e = collection[equipe[i]];
    noms.push(ESPECES[e.espece].nom + " " + e.niveau);
  }

  f.textContent = noms.join(" \u00b7 ");
}
