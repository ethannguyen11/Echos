/* ============================================================
   ICO
   Le guide. Il se consulte a tout moment depuis la carte.

   Ce fichier expose un seul global : window.Ico. Comme intro.js,
   il est ecrit comme une fonction qui s'appelle elle-meme : tout
   ce qui est a l'interieur reste prive.

   Il se charge APRES intro.js et joueur.js : il se sert de
   Intro.formater() pour le texte, et des donnees du joueur
   (collection, profil, suiviIco) pour ses chiffres.

   DEUX COUCHES, JAMAIS MELANGEES
     reference  les regles. Completes des le premier lancement,
                toujours consultables, rien ne s'y debloque.
     identite   qui il est. Se debloque par paliers.

   C'est la regle qui tient le personnage : un joueur qui revient
   apres trois semaines doit pouvoir relire comment marche
   l'Assimilation sans rien avoir a meriter.

   Attention aux trois noms voisins :
     Ico        ce namespace
     suiviIco   la variable de sauvegarde (js/joueur.js)
     "ico"      le bloc dans le fichier de sauvegarde
   ============================================================ */

window.Ico = (function () {

/* ------------------------------------------------------------
   1. LE PALIER DE DEFIGEMENT

   Ico va dans le sens inverse de tout le reste du jeu : le monde
   se fige, lui se defige. Son palier suit experienceDuGardien(),
   le nombre d'especes DISTINCTES assimilees.
   ------------------------------------------------------------ */

function palier() {
  var especes = experienceDuGardien();

  // ICO_PALIERS est trie du plus haut seuil au plus bas.
  for (var i = 0; i < ICO_PALIERS.length; i++) {
    if (especes >= ICO_PALIERS[i].seuil) return ICO_PALIERS[i].palier;
  }
  return 0;
}


/* ------------------------------------------------------------
   2. LE TEXTE

   Tout passe par Intro.formater() : {nom} et les accords [m|f|n]
   fonctionnent partout, y compris dans les lignes calculees.
   On relit profil a chaque appel, jamais au chargement : il est
   remplace par chargerJoueur().
   ------------------------------------------------------------ */

function ecrire(ligne) {
  return Intro.formater(ligne, profil);
}


/* ------------------------------------------------------------
   3. LA SECTION QUI SE CALCULE

   "Ou j'en suis" n'est jamais ecrite en dur : elle se recalcule
   a chaque ouverture de l'ecran.
   ------------------------------------------------------------ */

// Le nombre total d'especes du bestiaire, compte et non devine.
function totalEspeces() {
  var total = 0;
  for (var famille in ESPECES_PAR_LIEU) total += ESPECES_PAR_LIEU[famille].length;
  return total;
}

function meilleurEcho() {
  var meilleur = null;
  for (var id in collection) {
    if (!meilleur || collection[id].niveau > meilleur.niveau) meilleur = collection[id];
  }
  return meilleur;
}

/* Les lieux dont le joueur a tire quelque chose : assimile OU
   dissipe. Le jeu ne sait pas ou le joueur est passe, seulement
   quels lieux il connait et lesquels sont clos ; c'est donc
   "resolus" et pas "visites". */
function lieuxResolus() {
  var n = 0;
  for (var id in donjons) {
    if (donjons[id].capture || donjons[id].dissipe) n++;
  }
  return n;
}

function chiffre(libelle, valeur) {
  return '<span class="ico-libelle">' + libelle + '</span>' +
         '<span class="ico-valeur">' + valeur + '</span>';
}

function lignesProgression(section) {
  var html = "";

  for (var i = 0; i < section.avant.length; i++) {
    html += '<p class="ico-ligne">' + ecrire(section.avant[i]) + '</p>';
  }

  var meilleur = meilleurEcho();

  html += '<div class="ico-chiffres">' +
          '<div class="ico-chiffre">' +
          chiffre("Échos liés", experienceDuGardien() + " sur " + totalEspeces()) +
          '</div>' +
          '<div class="ico-chiffre">' +
          chiffre("Ton Écho le plus avancé",
                  meilleur ? ESPECES[meilleur.espece].nom + ", niveau " + meilleur.niveau
                           : "aucun pour l'instant") +
          '</div>' +
          '<div class="ico-chiffre">' +
          chiffre("Lieux résolus", lieuxResolus()) +
          '</div>' +
          '</div>';

  for (var j = 0; j < section.apres.length; j++) {
    html += '<p class="ico-ligne">' + ecrire(section.apres[j]) + '</p>';
  }

  return html;
}


/* ------------------------------------------------------------
   4. L'ECRAN DE REFERENCE

   Sections repliables, UNE SEULE OUVERTE A LA FOIS : sur un
   telephone, sept sections deroulees font un mur de texte que
   personne ne lit.

   Le corps d'une section n'est construit que si elle est
   ouverte. Ca evite de recalculer "Ou j'en suis" pour rien, et ca
   garde la page legere.
   ------------------------------------------------------------ */

var sectionOuverte = null;   // la cle de la section deroulee, ou null

function corpsDeSection(section) {
  if (section.dynamique) return lignesProgression(section);

  var html = "";
  for (var i = 0; i < section.lignes.length; i++) {
    html += '<p class="ico-ligne">' + ecrire(section.lignes[i]) + '</p>';
  }
  return html;
}

/* Le squelette d'une entree repliable. Les deux couches s'en
   servent : c'est la seule chose qu'elles partagent. */
function htmlRepliable(cle, titre, corps, classe) {
  var ouverte = cle === sectionOuverte;

  return '<div class="ico-section' + (classe ? " " + classe : "") +
         (ouverte ? " ouverte" : "") + '">' +
         '<button type="button" class="ico-titre" data-cle="' + cle + '">' +
         '<span>' + titre + '</span>' +
         '<span class="ico-chevron">' + (ouverte ? "−" : "+") + '</span>' +
         '</button>' +
         '<div class="ico-corps">' + (ouverte ? corps() : "") + '</div>' +
         '</div>';
}

function htmlSections() {
  var html = "";

  for (var i = 0; i < TEXTES_ICO_REFERENCE.length; i++) {
    html += htmlRepliable(
      TEXTES_ICO_REFERENCE[i].cle,
      TEXTES_ICO_REFERENCE[i].titre,
      (function (s) { return function () { return corpsDeSection(s); }; })(TEXTES_ICO_REFERENCE[i]),
      null);
  }

  return html;
}

function dessiner() {
  elem("ico-sections").innerHTML = htmlSections();
  elem("ico-fragments").innerHTML = htmlFragments();

  var titres = document.querySelectorAll(".ico-titre");
  for (var k = 0; k < titres.length; k++) {
    titres[k].addEventListener("click", function () {
      basculerSection(this.getAttribute("data-cle"));
    });
  }
}

/* Toucher une section ouverte la referme ; en toucher une autre
   ferme la precedente. Il n'y en a donc jamais deux ouvertes, et
   les deux couches se partagent la regle : ouvrir un fragment
   referme une section de reference, et l'inverse. */
function basculerSection(cle) {
  sectionOuverte = (sectionOuverte === cle) ? null : cle;

  // Ouvrir un fragment, c'est le lire : la pastille s'eteint.
  if (sectionOuverte !== null && cle.indexOf(PREFIXE_FRAGMENT) === 0) {
    marquerLu(Number(cle.slice(PREFIXE_FRAGMENT.length)));
  }

  dessiner();
}

function ouvrir() {
  // Le portrait suit la progression du joueur (voir css/ico.css)
  elem("ico-portrait").setAttribute("data-defigement", palier());

  majPastille();
  dessiner();
  elem("ico").classList.add("actif");
}

function fermer() {
  elem("ico").classList.remove("actif");
}


/* ------------------------------------------------------------
   5. LA COUCHE IDENTITE

   Elle, et elle seule, se debloque. Un fragment par palier de
   defigement, et les fragments deja obtenus restent relisibles
   pour toujours.

   Les fragments non atteints ne sont PAS affiches, meme grises :
   Ico ne peut pas annoncer ce qu'il n'a pas encore retrouve. Une
   seule ligne dit qu'il reste quelque chose.
   ------------------------------------------------------------ */

var PREFIXE_FRAGMENT = "fragment-";

function fragmentsObtenus() {
  var p = palier();
  return TEXTES_ICO_IDENTITE.filter(function (f) { return f.palier <= p; });
}

function corpsDeFragment(f) {
  var html = "";
  for (var i = 0; i < f.lignes.length; i++) {
    html += '<p class="ico-ligne">' + ecrire(f.lignes[i]) + '</p>';
  }
  return html;
}

function htmlFragments() {
  var obtenus = fragmentsObtenus();
  var html = '<h3 class="ico-rubrique">' + ICO_TITRE_IDENTITE + '</h3>';

  for (var i = 0; i < obtenus.length; i++) {
    var neuf = obtenus[i].palier > suiviIco.palierLu;

    html += htmlRepliable(
      PREFIXE_FRAGMENT + obtenus[i].palier,
      obtenus[i].titre + (neuf ? ' <span class="ico-neuf">nouveau</span>' : ""),
      (function (f) { return function () { return corpsDeFragment(f); }; })(obtenus[i]),
      "fragment");
  }

  if (palier() < ICO_PALIER_MAX) {
    html += '<p class="ico-a-venir">' + ecrire(ICO_FRAGMENT_A_VENIR) + '</p>';
  }

  return html;
}

/* Lire un fragment eteint la pastille jusqu'au palier suivant.
   On ne redescend jamais : palierLu ne fait que monter. */
function marquerLu(p) {
  if (!(p >= 0) || p <= suiviIco.palierLu) return;

  suiviIco.palierLu = Math.min(p, ICO_PALIER_MAX);
  sauverJoueur();
  majPastille();
}

/* La pastille dit : il s'est rappele quelque chose.

   Elle s'allume des que le palier atteint depasse le dernier
   fragment lu. Au tout premier lancement, les deux valent 0 :
   pas de pastille, alors que le fragment 0 est deja lisible. Le
   palier 0 n'est pas un franchissement.

   Appelee par majFiche(), donc a chaque fois que la collection
   du joueur peut avoir change. */
function majPastille() {
  var p = palier();

  if (p > suiviIco.palierAtteint) {
    suiviIco.palierAtteint = p;
    sauverJoueur();
  }

  var pastille = elem("ico-pastille");
  if (!pastille) return;

  if (suiviIco.palierAtteint > suiviIco.palierLu) pastille.classList.add("visible");
  else pastille.classList.remove("visible");
}


/* ------------------------------------------------------------
   5. LE DIDACTICIEL CONTEXTUEL

   Des interventions courtes, au moment ou la mecanique devient
   pertinente, et UNE SEULE FOIS chacune.

   Quatre regles, et elles se tiennent :
     - deux interventions ne se chevauchent jamais : ce qui arrive
       pendant qu'une bulle est a l'ecran passe dans la file ;
     - rien ne s'affiche pendant qu'un journal de combat defile :
       on attend que la main revienne au joueur, sinon Ico parle
       par-dessus le recit ;
     - un appui n'importe ou fait disparaitre la bulle, sans
       bloquer l'action : la bulle ne recoit pas les touchers, ils
       la traversent (voir css/ico.css) ;
     - le combat d'essai n'ecrit RIEN sur le disque.
   ------------------------------------------------------------ */

var file = [];              // les cles en attente, dans l'ordre d'arrivee
var bulleVisible = false;
var verrouBulle = false;    // avale le clic fantome du tactile
var minuteurBulle = null;   // l'effacement automatique
var minuteurRelance = null; // on revient voir si le journal a fini

/* Ce qu'on a deja montre PENDANT CETTE SESSION, meme quand rien
   n'a ete enregistre. C'est ce qui evite qu'un combat d'essai
   repete la meme intervention en boucle. */
var vuesDeSession = {};

function texteDidacticiel(cle) {
  for (var i = 0; i < TEXTES_ICO_DIDACTICIEL.length; i++) {
    if (TEXTES_ICO_DIDACTICIEL[i].cle === cle) return TEXTES_ICO_DIDACTICIEL[i];
  }
  return null;
}

function dejaVu(cle) {
  if (vuesDeSession[cle]) return true;
  return suiviIco.didacticiensVus.indexOf(cle) !== -1;
}

/* Le journal de combat est-il en train de defiler ?
   combat.js est charge avant ico.js, mais on reste prudent : la
   fonction pourrait disparaitre un jour, et Ico n'a pas a se
   taire pour autant. */
function journalOccupe() {
  return typeof journalEnCours === "function" && journalEnCours();
}

/* Demande a Ico de dire quelque chose. Sans effet si
   l'intervention a deja ete jouee, ou si elle attend deja. */
function dire(cle) {
  if (!texteDidacticiel(cle)) return;
  if (dejaVu(cle)) return;
  if (file.indexOf(cle) !== -1) return;

  file.push(cle);
  traiterFile();
}

function traiterFile() {
  if (bulleVisible) return;              // une a la fois

  if (file.length === 0) {
    if (minuteurRelance) { clearTimeout(minuteurRelance); minuteurRelance = null; }
    return;
  }

  // Le recit du combat passe avant Ico : on repassera.
  if (journalOccupe()) {
    if (!minuteurRelance) {
      minuteurRelance = setTimeout(function () {
        minuteurRelance = null;
        traiterFile();
      }, ICO_RELANCE);
    }
    return;
  }

  montrer(file.shift());
}

function montrer(cle) {
  var d = texteDidacticiel(cle);
  if (!d) return;

  marquerVu(cle);

  bulleVisible = true;
  verrouBulle = true;
  setTimeout(function () { verrouBulle = false; }, ICO_BULLE_VERROU);

  var l1 = elem("ico-bulle-l1"), l2 = elem("ico-bulle-l2");
  l1.textContent = "";
  l2.textContent = "";
  elem("ico-bulle").classList.add("visible");

  // La machine a ecrire de la cinematique, pas une deuxieme :
  // la seconde ligne part quand la premiere est finie.
  Intro.frapperDans(l1, ecrire(d.lignes[0]), function () {
    if (d.lignes[1]) Intro.frapperDans(l2, ecrire(d.lignes[1]));
  });

  minuteurBulle = setTimeout(effacer, ICO_BULLE_DUREE);
}

/* Un combat d'essai ne laisse aucune trace sur le disque : ni
   l'Echo capture, ni l'experience, ni ce qu'Ico a raconte. La
   session, elle, se souvient : l'intervention ne se repete pas
   dans le meme essai. */
function marquerVu(cle) {
  vuesDeSession[cle] = true;

  if (typeof estCombatFictif === "function" && estCombatFictif()) return;
  if (suiviIco.didacticiensVus.indexOf(cle) !== -1) return;

  suiviIco.didacticiensVus.push(cle);
  sauverJoueur();
}

function effacer() {
  if (!bulleVisible) return;
  if (minuteurBulle) { clearTimeout(minuteurBulle); minuteurBulle = null; }

  bulleVisible = false;
  elem("ico-bulle").classList.remove("visible");

  // Une autre attendait peut-etre son tour.
  traiterFile();
}

/* Branche sur le document entier : un appui n'importe ou efface
   la bulle. L'evenement a deja atteint ce qui se trouve dessous
   (bouton, carte, journal) : on ne bloque rien, on efface. */
function surAppui() {
  if (!bulleVisible || verrouBulle) return;
  effacer();
}

/* Pour tout retester sans effacer la partie : les interventions
   redeviennent neuves, la collection et le profil ne bougent
   pas. A appeler depuis la console du navigateur. */
function reinitialiserDidacticiel() {
  file = [];
  vuesDeSession = {};
  suiviIco.didacticiensVus = [];
  effacer();
  sauverJoueur();
  return "Didacticiel remis a neuf. Les " +
         TEXTES_ICO_DIDACTICIEL.length + " interventions se rejoueront.";
}


return {
  ouvrir: ouvrir,
  fermer: fermer,
  dire: dire,
  surAppui: surAppui,
  reinitialiserDidacticiel: reinitialiserDidacticiel,

  majPastille: majPastille,

  // Exposes pour verifier/tests.js
  palier: palier,
  fragmentsObtenus: fragmentsObtenus,
  enAttente: function () { return file.slice(); },
  bulleAffichee: function () { return bulleVisible; }
};

})();
