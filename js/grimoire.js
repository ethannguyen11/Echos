/* ============================================================
   LE GRIMOIRE
   L'ecran de collection : la liste des Echos lies, et le choix
   des trois qui accompagnent le joueur.
   ============================================================ */

function ouvrirGrimoire() {
  var html = "";
  var ids = Object.keys(collection);

  if (ids.length === 0) {
    html = '<div style="color:#888">Aucun echo lie pour le moment.</div>';
  }

  for (var i = 0; i < ids.length; i++) {
    var c = collection[ids[i]];
    var e = ESPECES[c.espece];
    var s = statsAuNiveau(c.espece, c.niveau);
    var dansEquipe = equipe.indexOf(c.espece) !== -1;

    html += '<div class="ligne-echo' + (dansEquipe ? " equipee" : "") +
            '" data-espece="' + c.espece + '">' +
            '<div class="pastille" style="background:' + COULEURS[e.famille] + '">' +
            c.niveau + '</div>' +
            '<div class="infos">' +
            '<div class="nom">' + e.nom + '</div>' +
            '<div class="titre">' + e.titre + '</div>' +
            '<div class="stats">' + s.pvMax + ' PV &middot; ATQ ' + s.atq + ' &middot; DEF ' + s.def + '</div>' +
            '<div class="trait">' + e.trait + '</div>' +
            '</div></div>';
  }

  elem("liste-echos").innerHTML = html;

  var lignes = document.querySelectorAll(".ligne-echo");
  for (var j = 0; j < lignes.length; j++) {
    lignes[j].addEventListener("click", function () {
      basculerEquipe(this.getAttribute("data-espece"));
    });
  }

  elem("grimoire").classList.add("actif");
}

function basculerEquipe(especeId) {
  var pos = equipe.indexOf(especeId);

  if (pos !== -1) {
    equipe.splice(pos, 1);
  } else {
    if (equipe.length >= EQUIPE_MAX) return;   // equipe pleine
    equipe.push(especeId);
  }

  sauverJoueur();
  majFiche();
  ouvrirGrimoire();
}
