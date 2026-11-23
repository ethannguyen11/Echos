/* ============================================================
   LES BRECHES PERMANENTES (LES REGLES)

   Correspondance de vocabulaire : "breche" est le mot du joueur et
   celui de ce fichier. Les "poches d'Oubli" de js/poche.js (poche,
   poches, creerPoche...) sont un AUTRE systeme : des breches
   sporadiques a minuteur. Elles seront rebaptisees plus tard.

   Ce fichier ne connait ni le DOM ni l'horloge, et ne tire jamais
   au hasard : "le jour" est TOUJOURS un parametre, et c'est
   l'appelant (js/brechesjeu.js) qui lit Date.now(). Les donnees des
   saisons viennent de js/saisons.js, les reglages de js/config.js.

   Depend de js/config.js, js/especes.js et js/saisons.js.
   ============================================================ */


/* ------------------------------------------------------------
   1. LES SAISONS : CONTROLE DES DONNEES

   Rend la liste des fautes de js/saisons.js, vide si tout va bien.
   Des phrases courtes, pour le developpeur : le joueur ne les voit
   jamais. Ne leve jamais d'exception, meme sur n'importe quoi.
   ------------------------------------------------------------ */

var BRECHES_ROLES = ["a", "b", "final"];

function moisValide(mois) {
  if (typeof mois !== "string" || !/^\d{4}-\d{2}$/.test(mois)) return false;
  var m = Number(mois.slice(5, 7));
  return m >= 1 && m <= 12;
}

function validerSaisons(saisons) {
  var fautes = [];
  if (!saisons || typeof saisons.length !== "number") return ["la liste des saisons est absente"];
  if (saisons.length === 0) fautes.push("aucune saison");

  var vus = {};
  for (var i = 0; i < saisons.length; i++) {
    var s = saisons[i];
    var ici = "saison " + i;
    if (!s || typeof s !== "object") { fautes.push(ici + " : pas un objet"); continue; }

    if (!moisValide(s.mois)) fautes.push(ici + " : mois invalide (" + s.mois + ")");
    else {
      ici = "saison " + s.mois;
      if (Object.prototype.hasOwnProperty.call(vus, s.mois)) fautes.push(ici + " : mois en double");
      vus[s.mois] = true;
    }

    if (!s.nom || typeof s.nom.fr !== "string" || s.nom.fr === "") fautes.push(ici + " : nom francais absent");

    var familles = s.familles;
    if (!familles || typeof familles !== "object" || Object.keys(familles).length === 0) {
      fautes.push(ici + " : aucune famille");
      continue;
    }

    for (var fam in familles) {
      var trio = familles[fam];
      var lieu = ici + "/" + fam;
      if (!trio || typeof trio !== "object") { fautes.push(lieu + " : pas un objet"); continue; }

      var rangs = [];
      BRECHES_ROLES.forEach(function (role) {
        var id = trio[role];
        if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(ESPECES, id)) {
          fautes.push(lieu + "." + role + " : espece inconnue (" + id + ")");
          return;
        }
        if (ESPECES[id].famille !== fam) {
          fautes.push(lieu + "." + role + " : " + id + " est de la famille " + ESPECES[id].famille);
        }
        rangs.push(ECHELLE_RANGS.indexOf(ESPECES[id].rang));
      });

      if (trio.a === trio.b || trio.b === trio.final || trio.a === trio.final) {
        fautes.push(lieu + " : a, b et final doivent etre trois especes differentes");
      }
      if (rangs.length === 3 && !(rangs[0] <= rangs[1] && rangs[1] <= rangs[2])) {
        fautes.push(lieu + " : le rang descend (a <= b <= final attendu)");
      }
    }
  }
  return fautes;
}
