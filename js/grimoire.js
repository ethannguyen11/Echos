/* ============================================================
   LE GRIMOIRE
   L'ecran de collection. Il ne montre plus seulement les Echos
   lies : il montre les seize especes du bestiaire, rangees par
   famille, pour que le joueur voie ce qu'il lui reste a trouver.

   Deux etats, pas trois :
     lie      l'espece est dans la collection. Tout est visible,
              et la ligne se touche pour entrer dans l'equipe ;
     inconnu  jamais assimilee. Une silhouette : on annonce la
              famille, jamais le nom ni les statistiques. Seule
              exception depuis les fragments : si la gourde garde
              quelque chose pour cette espece, on le dit -- sans
              rien nommer.

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

  // La capacite de la gourde est la meme pour toutes les especes :
  // on la lit une fois, pas seize.
  var capacite = capaciteGourde();

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

      /* Deux jeux de champs qui ne se melangent jamais.

         Une espece LIEE porte sa conscience, les fragments que
         l'Echo detient en propre, et ce qui manque pour le palier
         suivant (null au dernier palier : il n'y a plus rien
         apres).

         Une espece INCONNUE porte ce que la gourde garde pour
         elle, et la capacite du moment. Les deux valent zero et
         null de l'autre cote : l'affichage n'a jamais a se
         demander lequel des deux il regarde. */
      lignes.push({
        espece:     id,
        lie:        c ? true : false,
        niveau:     c ? c.niveau : 0,
        dansEquipe: equipe.indexOf(id) !== -1,

        conscience: c ? c.conscience : 0,
        fragments:  c ? c.fragments : fragmentsEnGourde(id),
        manque:     c ? manquePourConscience(id) : null,

        enGourde:   c ? 0 : totalFragments(fragmentsEnGourde(id)),
        capacite:   capacite
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
         blocConscience(l) +
         '</div></div>';
}

/* CE QUE L'ECHO A COMPRIS

   Trois lignes au plus, sous le trait : ou il en est, ce qu'il
   detient, ce qu'il lui manque. Lecture seule -- rien ici ne se
   touche, et monterConscience() n'a toujours aucun bouton.

   L'ordre est celui d'une question qu'on se pose en jouant :
   "il en est ou ?", puis "j'ai quoi ?", puis "il me faut quoi ?".
   La derniere ligne est la seule qui compte vraiment quand on
   cherche ou aller ce soir. */
function blocConscience(l) {
  var html = '<div class="conscience">' + paliersDessines(l.conscience) +
             ' Conscience ' + l.conscience + ' / ' + CONSCIENCE_MAX + '</div>';

  var tenus = libelleSac(l.fragments);
  html += '<div class="fragments">' +
          (tenus ? tenus : 'Aucun fragment.') + '</div>';

  /* manque vaut null au dernier palier. On le dit, plutot que de
     ne rien afficher : une ligne absente se lit comme un oubli,
     une ligne qui dit "c'est fini" se lit comme une fin. */
  if (l.manque === null) {
    html += '<div class="manque acheve">Pleinement conscient.</div>';
  } else if (totalFragments(l.manque) === 0) {
    html += '<div class="manque prete">Le palier suivant est réuni.</div>';
  } else {
    html += '<div class="manque">Il manque ' + libelleSac(l.manque) + '.</div>';
  }

  return html;
}

/* Les quatre paliers en pastilles. Dessines en CSS et non ecrits
   en caracteres : un rond plein et un rond vide ne se ressemblent
   pas d'une police a l'autre, et la fiche se lit sur un telephone
   ou l'on ne choisit pas la police. */
function paliersDessines(conscience) {
  var html = '<span class="paliers">';

  for (var i = 1; i <= CONSCIENCE_MAX; i++) {
    html += '<i' + (i <= conscience ? ' class="acquis"' : '') + '></i>';
  }

  return html + '</span>';
}

/* La ligne inconnue ne recoit pas d'attribut data-espece : elle
   ne doit rien apprendre a qui regarderait le code de la page,
   et elle ne se touche pas. */
function ligneInconnue(l) {
  var html = '<div class="ligne-echo inconnu">' +
             '<div class="pastille vide">?</div>' +
             '<div class="infos">' +
             '<div class="nom">Écho inconnu</div>' +
             '<div class="titre">Jamais assimilé.</div>';

  /* La gourde, quand elle garde quelque chose pour cette espece.

     C'est la SEULE chose qu'une ligne inconnue accepte de dire de
     plus, et elle ne nomme rien : ni l'espece, ni sa famille, ni
     sa couleur. Le joueur apprend qu'il a ramasse quelque chose
     ici, pas quoi. Sans cette ligne, les fragments d'une espece
     jamais croisee seraient invisibles jusqu'au jour de
     l'assimilation -- et ce jour-la, la gourde se viderait sans
     que personne n'ait jamais su qu'elle etait pleine. */
  if (l && l.enGourde > 0) {
    html += '<div class="gourde">Ta gourde en retient ' +
            l.enGourde + ' / ' + l.capacite + '</div>' +
            '<div class="fragments">' + libelleSac(l.fragments) + '</div>';
  }

  return html + '</div></div>';
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
      html += f.lignes[j].lie ? ligneLiee(f.lignes[j]) : ligneInconnue(f.lignes[j]);
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
