/* ============================================================
   LA CINEMATIQUE D'OUVERTURE
   Se joue une seule fois, au tout premier lancement, juste
   apres le bouton "Commencer" et avant la carte.

   Ce fichier expose un seul global : window.Intro.

   Il est ecrit comme une fonction qui s'appelle elle-meme
   (le "(function () { ... })()" tout en bas) : tout ce qui est
   a l'interieur reste prive, et seul window.Intro en sort.
   ============================================================ */

window.Intro = (function () {

/* ------------------------------------------------------------
   1. REGLAGES DE L'INTRO
   ------------------------------------------------------------ */

var VITESSE_FRAPPE   = 35;      // millisecondes par caractere
var DUREE_FONDU      = 220;     // disparition de la ligne precedente
var DELAI_LIEU_ZERO  = 4000;    // apres la position : temps laisse a Overpass
var PLAFOND_LIEU_ZERO = 12000;  // si la position elle-meme n'arrive jamais
var ATTENTE_MAX_LIEU = 2500;    // hold maximum quand la scene 1 arrive trop tot


/* ------------------------------------------------------------
   2. LE SCRIPT
   Des donnees, pas du DOM : on peut reecrire tout le texte
   ci-dessous sans toucher une ligne du moteur.

   IL N'Y A PLUS UNE SEULE PHRASE ICI. Chaque etape porte une
   CLE (cleTexte), et la phrase vit dans TEXTES, js/langues.js,
   une fois par langue. Le moteur fait donc, dans cet ordre :
   t(cle) va chercher la phrase, puis formater() resout les
   accords et les {jetons}.

   Attention : le champ s'appelle cleTexte et NON cle. "cle" est
   deja pris, sur les etapes saisie et choix, pour designer la
   case de reponse ("nom", "genre", "voie1"). Deux choses
   differentes, deux noms differents.

   Le texte francais vient de echos-ico-ouverture.md, mot pour
   mot. verifier.js compare le .md a TEXTES.fr a chaque
   execution.

   Types d'etapes :
     pause       attente automatique, qu'un tap peut abreger
     recit       texte narratif (italique, gris, centre)
     ico         replique parlee (romain, blanc, a gauche)
     lieu        affiche le nom du lieu reel, avec tremblement
     apparition  fait apparaitre la silhouette d'Ico
     saisie      demande le pseudo
     choix       propose des reponses
     calculVoie  deduit la voie des trois reponses
     echoDepart  montre l'Echo de depart deja attribue
     musique     reserve pour plus tard (ne fait rien)
     fin         ferme l'intro et enregistre

   Le champ "bloc" sert au seul endroit ou le script bifurque :
   les etapes bloc "lieu" ne se jouent que si le nom du lieu a
   ete trouve, celles du bloc "repli" seulement sinon.
   ------------------------------------------------------------ */

var SCRIPT = [

  /* --- Scene 1 : le reveil --- */

  { type: "pause", duree: 2000 },
  { type: "recit", cleTexte: "intro.eveil.pasDormi" },
  { type: "recit", cleTexte: "intro.eveil.pasReveille" },
  { type: "recit", cleTexte: "intro.eveil.simplementLa" },
  { type: "pause", duree: 1500 },

  { type: "recit", cleTexte: "intro.eveil.nomRevenu", bloc: "lieu" },
  { type: "lieu", bloc: "lieu" },

  { type: "recit", cleTexte: "intro.eveil.chercheNom", bloc: "repli" },
  { type: "recit", cleTexte: "intro.eveil.pasVenu", bloc: "repli" },

  { type: "pause", duree: 2000 },
  { type: "recit", cleTexte: "intro.eveil.tuLeConnaissais" },
  { type: "recit", cleTexte: "intro.eveil.quelqueChoseManquait" },

  /* --- Scene 2 : Ico --- */

  { type: "apparition" },
  { type: "recit", cleTexte: "intro.apparition.quelquun" },
  { type: "ico", cleTexte: "intro.ico.ah" },
  { type: "ico", cleTexte: "intro.ico.entenduAussi" },
  { type: "pause", duree: 1000 },
  { type: "ico", cleTexte: "intro.ico.neCherchePas" },
  { type: "ico", cleTexte: "intro.ico.appelleEcho" },
  { type: "pause", duree: 1000 },
  { type: "ico", cleTexte: "intro.ico.lieuApprend" },
  { type: "ico", cleTexte: "intro.ico.dernierMorceau" },
  { type: "ico", cleTexte: "intro.ico.neSeRallumePas" },

  /* --- Scene 3 : le nom --- */

  { type: "ico", cleTexte: "intro.nom.tuPeuxEntendre" },
  { type: "ico", cleTexte: "intro.nom.aQuiJeParle" },
  { type: "saisie", cle: "nom", max: 16 },
  { type: "ico", cleTexte: "intro.nom.echo" },
  { type: "ico", cleTexte: "intro.nom.jeLeRetiendrai" },

  /* --- Scene 4 : le genre ---
     (Didascalie du script : Ico se tourne a demi, comme s'il
     parlait a quelqu'un d'autre -- ou a personne.)

     En anglais, les trois reponses ne portent pas un accord mais
     un pronom : He / She / Someone. C'est la meme question, et
     c'est le meme genre enregistre. */

  { type: "ico", cleTexte: "intro.genre.noterQuelquePart" },
  { type: "choix", cle: "genre", options: [
      { cleTexte: "intro.genre.masculin", valeur: "m" },
      { cleTexte: "intro.genre.feminin",  valeur: "f" },
      { cleTexte: "intro.genre.neutre",   valeur: "n" }
  ]},
  { type: "ico", cleTexte: "intro.genre.cestNote" },

  /* --- Scene 5 : les trois questions --- */

  { type: "ico", cleTexte: "intro.voies.troisQuestions" },
  { type: "pause", duree: 1000 },

  { type: "ico", cleTexte: "intro.voies.q1" },
  { type: "choix", cle: "voie1", options: [
      { cleTexte: "intro.voies.q1.archiviste", valeur: "archiviste" },
      { cleTexte: "intro.voies.q1.arpenteur",  valeur: "arpenteur" },
      { cleTexte: "intro.voies.q1.gardien",    valeur: "gardien" }
  ]},

  { type: "ico", cleTexte: "intro.voies.q2" },
  { type: "choix", cle: "voie2", options: [
      { cleTexte: "intro.voies.q2.archiviste", valeur: "archiviste" },
      { cleTexte: "intro.voies.q2.arpenteur",  valeur: "arpenteur" },
      { cleTexte: "intro.voies.q2.gardien",    valeur: "gardien" }
  ]},

  { type: "ico", cleTexte: "intro.voies.q3" },
  { type: "choix", cle: "voie3", options: [
      { cleTexte: "intro.voies.q3.archiviste", valeur: "archiviste" },
      { cleTexte: "intro.voies.q3.arpenteur",  valeur: "arpenteur" },
      { cleTexte: "intro.voies.q3.gardien",    valeur: "gardien" }
  ]},

  { type: "calculVoie" },
  { type: "pause", duree: 1500 },
  { type: "ico", cleTexte: "intro.voies.voila" },
  { type: "ico", cleTexte: "intro.voies.resultat" },

  /* --- Scene 6 : le premier Echo --- */

  { type: "ico", cleTexte: "intro.echo.pasSeul" },
  { type: "ico", cleTexte: "intro.echo.traineIci" },
  { type: "echoDepart" },
  { type: "ico", cleTexte: "intro.echo.tEcoutera" },
  { type: "pause", duree: 1000 },
  { type: "ico", cleTexte: "intro.echo.leResteDehors" },
  { type: "ico", cleTexte: "intro.echo.vaVersLieux" },
  { type: "ico", cleTexte: "intro.echo.adieu" },

  { type: "fin" }
];


/* ------------------------------------------------------------
   3. INTERPOLATION DU TEXTE
   ELLE PASSE APRES t(), JAMAIS AVANT. t() rend la phrase brute
   de la langue courante, avec ses marqueurs intacts ; formater()
   les resout ensuite. L'ordre compte deux fois :

     - l'accord [m|f|n] doit etre resolu dans la langue
       effectivement affichee. En francais il porte un accord
       d'adjectif, en anglais un pronom (he / she / they) : meme
       syntaxe, meme fonction, phrase differente ;
     - a l'interieur de formater(), les accords passent AVANT
       {nom}. Un joueur qui se nomme "[a|b|c]" ne peut donc pas
       faire prendre son pseudo pour un accord.

   Deux mecanismes dans une seule fonction :
     {nom} et {voie}   remplaces par ce que le joueur a donne
     [m|f|n]           accord de genre, ex. "un[|e|·e]"
                       donne "un" / "une" / "un·e"
   ------------------------------------------------------------ */

var GENRES = { m: 0, f: 1, n: 2 };

function formater(texte, donnees) {
  if (typeof texte !== "string") return "";
  var d = donnees || {};

  // Accords de genre : on prend la part qui correspond au genre.
  // Un genre inconnu retombe sur le masculin, jamais sur une erreur.
  var rang = GENRES[d.genre] === undefined ? 0 : GENRES[d.genre];

  var sortie = texte.replace(/\[([^\[\]]*)\]/g, function (tout, dedans) {
    var parts = dedans.split("|");
    if (parts.length !== 3) return tout;      // ce n'est pas un accord : on n'y touche pas
    return parts[rang];
  });

  sortie = sortie.replace(/\{nom\}/g, d.nom || "");
  sortie = sortie.replace(/\{voie\}/g, d.voie || "");

  return sortie;
}


/* ------------------------------------------------------------
   4. LA VOIE
   Deux reponses identiques sur trois suffisent. En cas
   d'egalite parfaite, c'est la troisieme reponse qui tranche.
   ------------------------------------------------------------ */

function calculerVoie(voie1, voie2, voie3) {
  var comptes = {};
  [voie1, voie2, voie3].forEach(function (v) {
    if (v) comptes[v] = (comptes[v] || 0) + 1;
  });

  for (var v in comptes) {
    if (comptes[v] >= 2) return v;
  }

  return voie3 || voie2 || voie1 || "";
}


/* ------------------------------------------------------------
   5. LE LIEU ZERO
   On ne demande rien de neuf : la position vient de la boucle
   GPS du jeu (dernierePosition), les lieux nommes viennent
   d'Overpass via chargerDonjons (donjons), et on trie avec la
   fonction de distance existante.

   La recherche tourne en arriere-plan pendant que les
   premieres lignes defilent. Elle ne bloque jamais l'intro :
   au pire, elle rend null et le script bascule sur le repli.
   ------------------------------------------------------------ */

var recherche = null;   // { finie, lieu, abonnes, minuteur }

function lieuNommeLePlusProche() {
  if (!window.dernierePosition || !window.donjons) return null;

  var meilleur = null, meilleureDistance = Infinity;

  for (var id in donjons) {
    var d = donjons[id];
    if (!d || !d.lieu || !d.lat || !d.lon) continue;

    var dist = distanceMetres(dernierePosition[0], dernierePosition[1], d.lat, d.lon);
    if (dist < meilleureDistance) { meilleureDistance = dist; meilleur = d; }
  }

  if (!meilleur) return null;
  return { nom: meilleur.lieu, lat: meilleur.lat, lon: meilleur.lon };
}

function lancerRechercheLieuZero() {
  recherche = { finie: false, lieu: null, abonnes: [], minuteur: null };

  var debut = Date.now();
  var momentPosition = null;

  recherche.minuteur = setInterval(function () {
    if (!momentPosition && window.dernierePosition) momentPosition = Date.now();

    var trouve = lieuNommeLePlusProche();
    if (trouve) return conclure(trouve);

    // Position connue mais Overpass ne rend rien : on n'insiste pas
    if (momentPosition && Date.now() - momentPosition > DELAI_LIEU_ZERO) return conclure(null);

    // Position jamais arrivee (permission refusee, GPS muet) : plafond global
    if (Date.now() - debut > PLAFOND_LIEU_ZERO) return conclure(null);
  }, 250);
}

function conclure(lieu) {
  if (!recherche || recherche.finie) return;

  clearInterval(recherche.minuteur);
  recherche.finie = true;
  recherche.lieu = lieu;

  var abonnes = recherche.abonnes;
  recherche.abonnes = [];
  abonnes.forEach(function (f) { f(lieu); });
}

// Appele au moment ou le script atteint le bloc du lieu. Si la
// recherche n'a pas encore abouti, on lui laisse un dernier
// delai court, puis on tranche : le joueur ne doit pas attendre.
function resoudreLieuZero(surResultat) {
  if (!recherche) return surResultat(null);
  if (recherche.finie) return surResultat(recherche.lieu);

  var repondu = false;

  function repondreUneFois(lieu) {
    if (repondu) return;
    repondu = true;
    surResultat(lieu);
  }

  recherche.abonnes.push(repondreUneFois);
  setTimeout(function () { repondreUneFois(recherche.finie ? recherche.lieu : null); }, ATTENTE_MAX_LIEU);
}


/* ------------------------------------------------------------
   6. L'ECRAN
   ------------------------------------------------------------ */

var couche = null;      // l'overlay plein ecran
var zoneVisuel = null;  // la moitie haute : ce qu'on voit
var zoneDialogue = null;// la moitie basse : ce qu'on lit
var zoneTexte = null;
var zoneChoix = null;
var zoneSaisie = null;
var champ = null;
var silhouette = null;

/* L'ecran est fait de deux zones empilees, jamais superposees :
   la zone haute (silhouette, puis Echo de depart) et la zone
   basse (replique, saisie, choix). Le partage de la hauteur est
   decrit dans css/intro.css ; ici on ne fait que les emboiter. */
function construireEcran() {
  couche = document.createElement("div");
  couche.id = "intro";
  couche.className = "intro-overlay";

  zoneVisuel = document.createElement("div");
  zoneVisuel.className = "intro-visuel";

  silhouette = document.createElement("div");
  silhouette.id = "intro-ico";
  silhouette.setAttribute("data-defigement", "0");
  silhouette.innerHTML =
    '<svg viewBox="0 0 100 130" aria-hidden="true">' +
    '<ellipse cx="50" cy="34" rx="20" ry="23"></ellipse>' +
    '<path d="M50 57 C22 57 14 82 14 130 L86 130 C86 82 78 57 50 57 Z"></path>' +
    '</svg>';
  zoneVisuel.appendChild(silhouette);

  zoneDialogue = document.createElement("div");
  zoneDialogue.className = "intro-dialogue";

  zoneTexte = document.createElement("div");
  zoneTexte.id = "intro-texte";

  zoneSaisie = document.createElement("div");
  zoneSaisie.id = "intro-saisie";
  champ = document.createElement("input");
  champ.id = "intro-champ";
  champ.type = "text";
  champ.setAttribute("autocomplete", "off");
  champ.setAttribute("autocorrect", "off");
  champ.setAttribute("autocapitalize", "words");
  champ.setAttribute("spellcheck", "false");
  zoneSaisie.appendChild(champ);

  zoneChoix = document.createElement("div");
  zoneChoix.id = "intro-choix";

  zoneDialogue.appendChild(zoneTexte);
  zoneDialogue.appendChild(zoneSaisie);
  zoneDialogue.appendChild(zoneChoix);

  couche.appendChild(zoneVisuel);
  couche.appendChild(zoneDialogue);

  document.body.appendChild(couche);
  document.body.classList.add("intro-ouverte");

  couche.addEventListener("click", surTap);
  champ.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.keyCode === 13) { ev.preventDefault(); validerSaisie(); }
  });
}

function detruireEcran() {
  if (!couche) return;
  couche.parentNode.removeChild(couche);
  document.body.classList.remove("intro-ouverte");
  couche = zoneVisuel = zoneDialogue = null;
  zoneTexte = zoneChoix = zoneSaisie = champ = silhouette = null;
}


/* --- La machine a ecrire --- */

/* La machine a ecrire, ecrite une seule fois pour tout le jeu.

   Elle prend le noeud ou ecrire en parametre : c'est ce qui
   permet a l'ecran d'Ico (js/ico.js) de s'en servir sans qu'on
   ait a en ecrire une deuxieme. Elle est exposee par
   Intro.frapperDans.

   Elle rend une POIGNEE plutot que de poser un minuteur global :
   deux frappes peuvent ainsi vivre en meme temps dans deux
   endroits differents, sans se marcher dessus.
     .encours()   la frappe n'est pas finie
     .completer() pose le texte entier d'un coup */
function frapperDans(noeud, texte, surFini) {
  if (!noeud) return { encours: function () { return false; },
                       completer: function () { return false; } };

  noeud.textContent = "";
  var i = 0;

  var minuteur = setInterval(function () {
    i++;
    noeud.textContent = texte.slice(0, i);
    if (i >= texte.length) {
      clearInterval(minuteur);
      minuteur = null;
      if (surFini) surFini();
    }
  }, VITESSE_FRAPPE);

  return {
    encours: function () { return minuteur !== null; },
    completer: function () {
      if (minuteur === null) return false;
      clearInterval(minuteur);
      minuteur = null;
      noeud.textContent = texte;
      return true;
    }
  };
}

// La frappe de la cinematique : toujours dans zoneTexte.
var frappeEnCours = null;

function frapper(texte, surFini) {
  frappeEnCours = frapperDans(zoneTexte, texte, surFini);
}

function completerLigne() {
  if (!frappeEnCours || !frappeEnCours.completer()) return false;
  etat = "ligne";
  return true;
}

// Fait disparaitre la ligne precedente, puis ecrit la nouvelle.
function afficherLigne(texte, classe) {
  verrou = true;
  etat = "transition";
  zoneTexte.className = "sortant";

  setTimeout(function () {
    zoneTexte.className = classe;
    etat = "frappe";
    verrou = false;
    frapper(texte, function () { etat = "ligne"; });
  }, DUREE_FONDU);
}

function afficherBloc(html, classe) {
  verrou = true;
  etat = "transition";
  zoneTexte.className = "sortant";

  setTimeout(function () {
    zoneTexte.className = classe;
    zoneTexte.innerHTML = html;
    etat = "ligne";
    verrou = false;
  }, DUREE_FONDU);
}


/* ------------------------------------------------------------
   7. LE MOTEUR
   ------------------------------------------------------------ */

var index = 0;
var etat = "";          // transition | frappe | ligne | pause | interaction | fini
var verrou = false;     // empeche un tap de consommer deux etapes
var blocActif = null;   // "lieu" ou "repli", decide une seule fois
var minuteurPause = null;
var reponses = {};      // ce que le joueur a repondu, avant sauvegarde
var surTermine = null;

function suivant() {
  index++;
  jouerEtape();
}

function jouerEtape() {
  if (index >= SCRIPT.length) return terminer();

  var e = SCRIPT[index];

  // Bifurcation lieu / repli : on tranche a la premiere etape concernee
  if (e.bloc && !blocActif) {
    verrou = true;
    etat = "transition";
    return resoudreLieuZero(function (lieu) {
      reponses.lieuZero = lieu;
      blocActif = lieu ? "lieu" : "repli";
      verrou = false;
      jouerEtape();
    });
  }
  if (e.bloc && e.bloc !== blocActif) return suivant();

  switch (e.type) {

    case "pause":
      etat = "pause";
      minuteurPause = setTimeout(function () { minuteurPause = null; suivant(); }, e.duree);
      break;

    case "recit":
      afficherLigne(formater(t(e.cleTexte), reponses), "recit");
      break;

    case "ico":
      afficherLigne(formater(t(e.cleTexte), reponses), "ico");
      break;

    case "lieu":
      afficherBloc('<span class="nom-lieu">' + echapper(reponses.lieuZero.nom) + "</span>", "lieu");
      break;

    case "apparition":
      if (silhouette) silhouette.classList.add("visible");
      suivant();
      break;

    case "saisie":
      demanderSaisie(e);
      break;

    case "choix":
      demanderChoix(e);
      break;

    case "calculVoie":
      reponses.voie = calculerVoie(reponses.voie1, reponses.voie2, reponses.voie3);
      suivant();
      break;

    case "echoDepart":
      montrerEchoDepart();
      break;

    case "musique":
      // Reserve : aucun son pour l'instant, le hook existe.
      suivant();
      break;

    case "fin":
      terminer();
      break;

    default:
      // Type inconnu : on ne bloque pas la cinematique pour autant.
      suivant();
  }
}


/* --- Saisie du nom --- */

function demanderSaisie(etape) {
  etat = "interaction";
  zoneTexte.className = "";
  zoneTexte.textContent = "";
  champ.value = "";
  champ.maxLength = etape.max || 16;
  zoneSaisie.classList.add("visible");

  // Le tap qui a amene ici est un geste utilisateur : sur iOS,
  // c'est la seule occasion d'ouvrir le clavier sans re-toucher.
  try { champ.focus(); } catch (err) {}
}

function validerSaisie() {
  if (etat !== "interaction" || !champ) return;

  var valeur = champ.value.replace(/\s+/g, " ").trim();
  if (valeur.length === 0) return;      // refus silencieux, aucun message

  reponses[SCRIPT[index].cle] = valeur;
  zoneSaisie.classList.remove("visible");
  champ.blur();
  suivant();
}


/* --- Choix ---
   poserOptions() est le SEUL endroit du jeu qui fabrique un
   bouton de choix. L'ecran de langue et les choix du script s'en
   servent tous les deux : ils ont donc forcement le meme aspect
   (#intro-choix button, dans css/intro.css) et surtout le meme
   VERROU.

   Le verrou n'est pas une precaution theorique : un seul contact
   du doigt peut produire deux evenements sur mobile, et sans lui
   un tap consommerait deux etapes d'un coup. Ecrire un second
   fabricant de boutons pour l'ecran de langue aurait voulu dire
   ecrire un second verrou, et l'oublier un jour. */

function poserOptions(libelles, surChoix) {
  etat = "interaction";
  zoneChoix.innerHTML = "";

  libelles.forEach(function (libelle, rang) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = libelle;
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (etat !== "interaction" || verrou) return;
      verrou = true;
      zoneChoix.classList.remove("visible");
      zoneChoix.innerHTML = "";
      verrou = false;
      surChoix(rang);
    });
    zoneChoix.appendChild(b);
  });

  zoneChoix.classList.add("visible");
}

function demanderChoix(etape) {
  poserOptions(
    etape.options.map(function (o) { return formater(t(o.cleTexte), reponses); }),
    function (rang) {
      reponses[etape.cle] = etape.options[rang].valeur;
      suivant();
    }
  );
}


/* --- Le choix de la langue ---
   La toute premiere chose que le joueur voit, avant meme la
   premiere ligne du recit.

   Il n'est volontairement PAS dans SCRIPT. SCRIPT est le script
   narratif, celui que echos-ico-ouverture.md decrit mot pour mot
   et que verifier.js compare ligne a ligne ; un reglage
   d'interface n'y a pas sa place.

   Aucune question au-dessus des boutons : "Français" et
   "English" se lisent seuls, chacun ecrit dans sa propre langue.
   Poser la question aurait demande de choisir dans quelle langue
   la poser -- ce qui est exactement ce qu'on demande. */

function demanderLangue(apres) {
  zoneTexte.className = "";
  zoneTexte.textContent = "";

  poserOptions(
    LANGUES.map(function (code) { return t("intro.langue." + code); }),
    function (rang) {
      definirLangue(LANGUES[rang]);
      apres();
    }
  );
}


/* --- L'Echo de depart ---
   Il est deja attribue par chargerJoueur() au premier
   lancement : on ne fait que le montrer. */

function echoDeDepart() {
  var id = (typeof equipe !== "undefined" && equipe.length) ? equipe[0] : null;
  if (!id && typeof collection !== "undefined") id = Object.keys(collection)[0];
  if (!id || !collection[id]) return null;
  return collection[id];
}

/* Scene 6 : l'Echo prend la place d'Ico dans la zone haute.
   Ico s'efface d'abord, l'Echo arrive ensuite : les deux ne
   sont jamais a l'ecran en meme temps. La replique en cours
   reste lisible en dessous, dans la zone de dialogue. */
function montrerEchoDepart() {
  var html = carteEchoDepart();
  if (!html) return suivant();        // aucun Echo a montrer : on passe

  verrou = true;
  etat = "transition";
  if (silhouette) silhouette.classList.add("parti");

  setTimeout(function () {
    zoneVisuel.innerHTML = html;      // remplace la silhouette
    silhouette = null;
    etat = "ligne";
    verrou = false;
  }, DUREE_FONDU);
}

function carteEchoDepart() {
  var echo = echoDeDepart();
  if (!echo || !ESPECES[echo.espece]) return "";

  var e = ESPECES[echo.espece];
  var couleur = COULEURS[e.famille] || "#b455d4";

  // L'image n'existe pas toujours : le substitut prend le relais,
  // comme sur l'ecran de combat.
  return '<div class="echo-depart">' +
         '<div class="echo-vignette" style="border-color:' + couleur + '">' +
         '<img src="' + DOSSIER_MONSTRES + e.image + '" alt="" ' +
         'onload="this.style.display=\'block\';this.nextElementSibling.style.display=\'none\'" ' +
         'onerror="this.style.display=\'none\'">' +
         htmlSecours(echo.espece, "echo-substitut") +
         '</div>' +
         '<div class="echo-nom">' + echapper(e.nom) + '</div>' +
         '<div class="echo-titre">' + echapper(e.titre) + '</div>' +
         '<div class="echo-niveau">' +
         echapper(t("intro.echoDepart.niveau", { niveau: echo.niveau })) +
         '</div>' +
         '</div>';
}

function echapper(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


/* --- Le tap --- */

function surTap(ev) {
  if (ev && ev.target === champ) return;      // toucher le champ ne valide pas
  if (verrou) return;

  // Une ligne en cours de frappe se complete d'un coup
  if (etat === "frappe") { completerLigne(); return; }

  // Un tap abrege une pause
  if (etat === "pause") {
    if (minuteurPause) { clearTimeout(minuteurPause); minuteurPause = null; }
    verrou = true;
    etat = "transition";
    verrou = false;
    suivant();
    return;
  }

  // Pendant une saisie, le tap vaut validation
  if (etat === "interaction") {
    if (zoneSaisie && zoneSaisie.classList.contains("visible")) validerSaisie();
    return;                                   // les choix ont leurs propres boutons
  }

  if (etat === "ligne") { suivant(); return; }
}


/* ------------------------------------------------------------
   8. DEBUT ET FIN
   ------------------------------------------------------------ */

function demarrer(surFin) {
  if (couche) return;             // deja en cours

  surTermine = typeof surFin === "function" ? surFin : function () {};
  index = 0;
  etat = "";
  verrou = false;
  blocActif = null;
  reponses = { nom: "", genre: "", voie: "", lieuZero: null };

  construireEcran();

  /* La recherche du lieu zero ne demarre qu'APRES le choix de la
     langue, pas avant. Ses deux delais (DELAI_LIEU_ZERO,
     PLAFOND_LIEU_ZERO) sont comptes a partir de la premiere
     ligne : les lancer pendant que le joueur hesite entre deux
     boutons les ferait expirer avant meme le debut du recit, et
     le nom du lieu reel n'apparaitrait plus jamais. */
  demanderLangue(function () {
    lancerRechercheLieuZero();    // en arriere-plan, des la premiere ligne
    jouerEtape();
  });
}

// La sauvegarde n'a lieu qu'ici, a la toute fin : fermer l'app
// au milieu de l'intro la fait simplement recommencer.
function terminer() {
  if (etat === "fini") return;
  etat = "fini";

  if (recherche && !recherche.finie) conclure(null);
  if (minuteurPause) { clearTimeout(minuteurPause); minuteurPause = null; }
  if (frappeEnCours) { frappeEnCours.completer(); frappeEnCours = null; }

  profil.nom      = reponses.nom || "";
  profil.genre    = reponses.genre || "";
  profil.voie     = reponses.voie || "";
  profil.lieuZero = reponses.lieuZero || null;
  profil.introVue = true;
  sauverJoueur();

  detruireEcran();

  var fin = surTermine;
  surTermine = null;
  fin();
}

// Pour retester l'intro : remet introVue a false et recharge.
function reinitialiser() {
  profil.introVue = false;
  profil.nom = "";
  profil.genre = "";
  profil.voie = "";
  profil.lieuZero = null;
  sauverJoueur();
  location.reload();
}


return {
  demarrer: demarrer,
  reinitialiser: reinitialiser,

  // La machine a ecrire, partagee avec js/ico.js : il n'y a
  // qu'un seul moteur de texte dans le jeu.
  frapperDans: frapperDans,

  // Exposes pour verifier.js et verifier/tests.js uniquement
  SCRIPT: SCRIPT,
  formater: formater,
  calculerVoie: calculerVoie
};

})();
