/* ============================================================
   LE GRIMOIRE
   L'ecran de collection. Il ne montre plus seulement les Echos
   lies : il montre les seize especes du bestiaire, rangees par
   famille, pour que le joueur voie ce qu'il lui reste a trouver.

   Deux etats, pas trois :
     lie      l'espece est dans la collection. Tout est visible,
              et la ligne se touche pour entrer dans l'equipe ;
     inconnu  jamais assimilee. Une silhouette : on annonce la
              famille, jamais le nom ni les statistiques.

   POINT D'ACCROCHE : un troisieme etat "apercu" (croise en
   combat, mais jamais assimile) recompenserait les combats
   perdus. Il faudrait retenir les especes rencontrees dans la
   sauvegarde ; rien ne le fait aujourd'hui, et bestiaire()
   n'aurait qu'un champ de plus a poser sur chaque ligne.
   ============================================================ */


/* ------------------------------------------------------------
   CE QUE CONTIENT LE GRIMOIRE

   bestiaire() ne touche pas a l'ecran : il repond a la question
   "ou en est la collection ?" sous forme de donnees. C'est ce
   qui permet de la verifier sans navigateur, dans le bloc
   "Grimoire" de verifier/tests.js.
   ------------------------------------------------------------ */

function bestiaire() {
  var familles = [];
  var liesEnTout = 0, especesEnTout = 0;

  // L'ordre des familles et des especes est celui d'especes.js :
  // une seule liste a tenir a jour, pas deux.
  var noms = Object.keys(ESPECES_PAR_LIEU);

  for (var i = 0; i < noms.length; i++) {
    var famille = noms[i];
    var ids = ESPECES_PAR_LIEU[famille];
    var lignes = [], lies = 0;

    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      var c = collection[id];
      if (c) lies++;

      lignes.push({
        espece:     id,
        lie:        c ? true : false,
        niveau:     c ? c.niveau : 0,
        dansEquipe: equipe.indexOf(id) !== -1
      });
    }

    liesEnTout += lies;
    especesEnTout += ids.length;

    familles.push({
      famille: famille, lignes: lignes,
      lies: lies, total: ids.length
    });
  }

  return { familles: familles, lies: liesEnTout, total: especesEnTout };
}


/* ------------------------------------------------------------
   COMMENT IL S'AFFICHE
   ------------------------------------------------------------ */

/* La vignette d'un Echo lie : son illustration si le dessin existe
   dans monstres/, son visuel de secours sinon.

   Le montage est celui de l'ecran de combat, en plus petit : le
   secours est en place d'abord, l'image se pose PAR-DESSUS quand
   elle arrive, et son propre onerror la retire si elle n'arrive
   pas. Chaque vignette est independante, donc une image manquante
   n'empeche jamais les autres de s'afficher.

   Le bord garde la couleur de la famille : c'est ce que portait la
   pastille avant, et ca reste lisible d'un coup d'oeil. */
function vignetteEcho(especeId) {
  var e = ESPECES[especeId];
  var bord = COULEURS[e.famille] || "#b455d4";

  return '<div class="pastille" style="border-color:' + bord + '">' +
         '<img src="' + DOSSIER_MONSTRES + e.image + '" alt="" ' +
         'onload="this.style.display=\'block\';this.nextElementSibling.style.display=\'none\'" ' +
         'onerror="this.style.display=\'none\'">' +
         htmlSecours(especeId, "pastille-secours") +
         '</div>';
}

function ligneLiee(l) {
  var e = ESPECES[l.espece];
  var s = statsAuNiveau(l.espece, l.niveau);

  return '<div class="ligne-echo lie' + (l.dansEquipe ? " equipee" : "") +
         '" data-espece="' + l.espece + '">' +
         vignetteEcho(l.espece) +
         '<div class="infos">' +
         '<div class="nom">' + e.nom + '</div>' +
         '<div class="titre">' + e.titre + '</div>' +
         '<div class="stats">Niv. ' + l.niveau + ' &middot; ' +
         s.pvMax + ' PV &middot; ATQ ' + s.atq + ' &middot; DEF ' + s.def + '</div>' +
         '<div class="affinite" style="color:' + COULEURS_AFFINITE[e.affinite] + '">' +
         LIBELLES_AFFINITE[e.affinite] + ' &middot; ' + LIBELLES_NATURE[e.nature] + '</div>' +
         '<div class="trait">' + e.trait + '</div>' +
         '</div></div>';
}

/* La ligne inconnue ne recoit pas d'attribut data-espece : elle
   ne doit rien apprendre a qui regarderait le code de la page,
   et elle ne se touche pas. */
function ligneInconnue() {
  return '<div class="ligne-echo inconnu">' +
         '<div class="pastille vide">?</div>' +
         '<div class="infos">' +
         '<div class="nom">Écho inconnu</div>' +
         '<div class="titre">Jamais assimilé.</div>' +
         '</div></div>';
}

function ouvrirGrimoire() {
  var b = bestiaire();
  var html = "";

  for (var i = 0; i < b.familles.length; i++) {
    var f = b.familles[i];

    html += '<div class="famille-titre" style="border-left-color:' +
            COULEURS[f.famille] + '">' + LIBELLES_FAMILLE[f.famille] +
            '<span>' + f.lies + ' / ' + f.total + '</span></div>';

    for (var j = 0; j < f.lignes.length; j++) {
      html += f.lignes[j].lie ? ligneLiee(f.lignes[j]) : ligneInconnue();
    }
  }

  elem("liste-echos").innerHTML = html;
  elem("grimoire-progression").textContent =
    b.lies + " / " + b.total + " échos liés";

  // Seules les lignes liees repondent au doigt.
  var lignes = document.querySelectorAll(".ligne-echo.lie");
  for (var k = 0; k < lignes.length; k++) {
    lignes[k].addEventListener("click", function () {
      basculerEquipe(this.getAttribute("data-espece"));
    });
  }

  elem("grimoire").classList.add("actif");

  Ico.dire("grimoire");   // DIDACTICIEL : la collection
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
