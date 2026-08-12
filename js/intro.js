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

   Le texte vient de echos-ico-ouverture.md, mot pour mot.
   verifier.js compare les deux a chaque execution.

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
  { type: "recit", texte: "Tu ne dormais pas." },
  { type: "recit", texte: "Tu n'étais pas réveillé[|e|·e] non plus." },
  { type: "recit", texte: "Tu étais simplement là, sans savoir depuis combien de temps." },
  { type: "pause", duree: 1500 },

  { type: "recit", texte: "Puis le nom du lieu t'est revenu.", bloc: "lieu" },
  { type: "lieu", bloc: "lieu" },

  { type: "recit", texte: "Puis tu as cherché le nom du lieu.", bloc: "repli" },
  { type: "recit", texte: "Il n'est pas venu.", bloc: "repli" },

  { type: "pause", duree: 2000 },
  { type: "recit", texte: "Tu le connaissais. Tu es sûr[|e|·e] de l'avoir connu." },
  { type: "recit", texte: "Mais quelque chose manquait autour. Quelque chose qui aurait dû être là et qui ne l'était plus." },

  /* --- Scene 2 : Ico --- */

  { type: "apparition" },
  { type: "recit", texte: "Il y avait quelqu'un." },
  { type: "ico", texte: "Ah." },
  { type: "ico", texte: "Tu l'as entendu, toi aussi." },
  { type: "pause", duree: 1000 },
  { type: "ico", texte: "Ne cherche pas d'où ça venait. Ça ne vient de nulle part. Ça reste, c'est tout." },
  { type: "ico", texte: "Les gens appellent ça un écho. Faute de mieux." },
  { type: "pause", duree: 1000 },
  { type: "ico", texte: "Un lieu apprend des choses. Pendant des siècles, parfois. Et puis on cesse de venir, on cesse de raconter, et ce qu'il savait commence à s'effacer." },
  { type: "ico", texte: "Ce que tu entends, c'est ce qui reste. Le dernier morceau." },
  { type: "ico", texte: "Quand il s'éteint, il ne se rallume pas." },

  /* --- Scene 3 : le nom --- */

  { type: "ico", texte: "Tu peux encore les entendre. C'est rare." },
  { type: "ico", texte: "Alors autant que je sache à qui je parle." },
  { type: "saisie", cle: "nom", max: 16 },
  { type: "ico", texte: "{nom}." },
  { type: "ico", texte: "Bien. Je le retiendrai plus longtemps que la plupart." },

  /* --- Scene 4 : le genre ---
     (Didascalie du script : Ico se tourne a demi, comme s'il
     parlait a quelqu'un d'autre -- ou a personne.) */

  { type: "ico", texte: "Il faudra bien que je le note quelque part." },
  { type: "choix", cle: "genre", options: [
      { texte: "Il est venu.", valeur: "m" },
      { texte: "Elle est venue.", valeur: "f" },
      { texte: "Quelqu'un est venu.", valeur: "n" }
  ]},
  { type: "ico", texte: "C'est noté." },

  /* --- Scene 5 : les trois questions --- */

  { type: "ico", texte: "Trois questions. Réponds vite, ne réfléchis pas." },
  { type: "pause", duree: 1000 },

  { type: "ico", texte: "Un lieu que tu aimais va disparaître demain. Tu as une nuit." },
  { type: "choix", cle: "voie1", options: [
      { texte: "J'écris tout ce que j'en sais.", valeur: "archiviste" },
      { texte: "J'y retourne une dernière fois.", valeur: "arpenteur" },
      { texte: "Je préviens les gens.", valeur: "gardien" }
  ]},

  { type: "ico", texte: "Tu trouves un carnet. L'écriture est illisible, mais elle parle d'un endroit que personne ne connaît." },
  { type: "choix", cle: "voie2", options: [
      { texte: "Je le recopie avant qu'il ne s'abîme.", valeur: "archiviste" },
      { texte: "Je pars le chercher.", valeur: "arpenteur" },
      { texte: "Je le mets à l'abri.", valeur: "gardien" }
  ]},

  { type: "ico", texte: "Dernière. Un écho s'éteint devant toi. Tu ne peux pas l'arrêter." },
  { type: "choix", cle: "voie3", options: [
      { texte: "Je retiens tout ce que j'entends.", valeur: "archiviste" },
      { texte: "Je vais voir d'où il venait.", valeur: "arpenteur" },
      { texte: "Je reste jusqu'à la fin.", valeur: "gardien" }
  ]},

  { type: "calculVoie" },
  { type: "pause", duree: 1500 },
  { type: "ico", texte: "Voilà." },
  { type: "ico", texte: "Tu es un[|e|·e] {voie}. Ça se voyait déjà, mais maintenant c'est dit." },

  /* --- Scene 6 : le premier Echo --- */

  { type: "ico", texte: "Tu n'iras pas seul[|e|·e]." },
  { type: "ico", texte: "Celui-là traîne ici depuis longtemps. Il a survécu à trois temples et à deux villes. Ne te fie pas à son allure." },
  { type: "echoDepart" },
  { type: "ico", texte: "Il t'écoutera. Pas toujours, mais souvent." },
  { type: "pause", duree: 1000 },
  { type: "ico", texte: "Le reste, tu l'apprendras dehors." },
  { type: "ico", texte: "Va vers les lieux. Écoute ce qu'ils ont encore à dire." },
  { type: "ico", texte: "Et {nom} — ce que tu n'assimiles pas, personne ne le fera après toi." },

  { type: "fin" }
];


/* ------------------------------------------------------------
   3. INTERPOLATION DU TEXTE
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
var zoneTexte = null;
var zoneChoix = null;
var zoneSaisie = null;
var champ = null;
var silhouette = null;

function construireEcran() {
  couche = document.createElement("div");
  couche.id = "intro";

  silhouette = document.createElement("div");
  silhouette.id = "intro-ico";
  silhouette.setAttribute("data-defigement", "0");
  silhouette.innerHTML =
    '<svg viewBox="0 0 100 130" aria-hidden="true">' +
    '<ellipse cx="50" cy="34" rx="20" ry="23"></ellipse>' +
    '<path d="M50 57 C22 57 14 82 14 130 L86 130 C86 82 78 57 50 57 Z"></path>' +
    '</svg>';

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

  couche.appendChild(silhouette);
  couche.appendChild(zoneTexte);
  couche.appendChild(zoneSaisie);
  couche.appendChild(zoneChoix);

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
  couche = zoneTexte = zoneChoix = zoneSaisie = champ = silhouette = null;
}


/* --- La machine a ecrire --- */

var minuteurFrappe = null;
var texteEnCours = "";

function frapper(texte, surFini) {
  texteEnCours = texte;
  zoneTexte.textContent = "";

  var i = 0;
  minuteurFrappe = setInterval(function () {
    i++;
    zoneTexte.textContent = texte.slice(0, i);
    if (i >= texte.length) {
      clearInterval(minuteurFrappe);
      minuteurFrappe = null;
      surFini();
    }
  }, VITESSE_FRAPPE);
}

function completerLigne() {
  if (!minuteurFrappe) return false;
  clearInterval(minuteurFrappe);
  minuteurFrappe = null;
  zoneTexte.textContent = texteEnCours;
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
      afficherLigne(formater(e.texte, reponses), "recit");
      break;

    case "ico":
      afficherLigne(formater(e.texte, reponses), "ico");
      break;

    case "lieu":
      afficherBloc('<span class="nom-lieu">' + echapper(reponses.lieuZero.nom) + "</span>", "lieu");
      break;

    case "apparition":
      silhouette.classList.add("visible");
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
      afficherBloc(carteEchoDepart(), "echo");
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


/* --- Choix --- */

function demanderChoix(etape) {
  etat = "interaction";
  zoneChoix.innerHTML = "";

  etape.options.forEach(function (option) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = formater(option.texte, reponses);
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (etat !== "interaction" || verrou) return;
      verrou = true;
      reponses[etape.cle] = option.valeur;
      zoneChoix.classList.remove("visible");
      zoneChoix.innerHTML = "";
      verrou = false;
      suivant();
    });
    zoneChoix.appendChild(b);
  });

  zoneChoix.classList.add("visible");
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

function carteEchoDepart() {
  var echo = echoDeDepart();
  if (!echo || !ESPECES[echo.espece]) return "";

  var e = ESPECES[echo.espece];
  var couleur = COULEURS[e.famille] || "#b455d4";

  // L'image n'existe pas toujours : le substitut prend le relais,
  // comme sur l'ecran de combat.
  return '<div class="echo-depart">' +
         '<div class="echo-vignette" style="border-color:' + couleur + '">' +
         '<img src="' + DOSSIER_MONSTRES + e.img + '.png" alt="" ' +
         'onload="this.style.display=\'block\';this.nextElementSibling.style.display=\'none\'" ' +
         'onerror="this.style.display=\'none\'">' +
         '<span class="echo-substitut">&#128128;</span>' +
         '</div>' +
         '<div class="echo-nom">' + echapper(e.nom) + '</div>' +
         '<div class="echo-titre">' + echapper(e.titre) + '</div>' +
         '<div class="echo-niveau">niveau ' + echo.niveau + '</div>' +
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
  lancerRechercheLieuZero();      // en arriere-plan, des la premiere ligne
  jouerEtape();
}

// La sauvegarde n'a lieu qu'ici, a la toute fin : fermer l'app
// au milieu de l'intro la fait simplement recommencer.
function terminer() {
  if (etat === "fini") return;
  etat = "fini";

  if (recherche && !recherche.finie) conclure(null);
  if (minuteurPause) { clearTimeout(minuteurPause); minuteurPause = null; }
  if (minuteurFrappe) { clearInterval(minuteurFrappe); minuteurFrappe = null; }

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

  // Exposes pour verifier.js et verifier/tests.js uniquement
  SCRIPT: SCRIPT,
  formater: formater,
  calculerVoie: calculerVoie
};

})();
