/* ============================================================
   LE MODE TEST
   Un donjon fictif pose a ta position, et un panneau discret pour
   regler le palier de Figement, le niveau et l'espece de
   l'adversaire. De quoi essayer un combat sans sortir de chez soi.

   Le panneau regle aussi le CHAPITRE force. Celui-la ne touche pas
   au donjon fictif -- qui prend son espece du selecteur -- mais a
   ce que les VRAIS lieux peuvent contenir. C'est le seul reglage
   du panneau qui agit en dehors du terrain d'essai.

   Le panneau ouvre aussi le BANC 3D (bouton "Banc 3D") : le
   modele de test de js/rendu3d.js, sans combat. Voir plus bas.

   Ce fichier expose un seul global : window.ModeTest.

   IL NE FAIT RIEN quand MODE_TEST vaut false dans config.js :
   actif() rend false, et toutes les autres fonctions s'arretent
   sur cette reponse. Le fichier entier peut etre supprime sans
   rien casser ailleurs, a condition de retirer aussi son <script>
   dans index.html.

   Aucun combat d'essai n'ecrit dans la partie du joueur : voir
   estCombatFictif() dans js/combat.js. Seule exception, voulue : la
   victoire sur une breche d'essai s'inscrit sous CLE_BRECHES_TEST,
   la cle des breches propre au mode test (section LES BRECHES
   PERMANENTES, plus bas), jamais sous la vraie cle.
   ============================================================ */

window.ModeTest = (function () {

/* Ce que le panneau regle. Ce sont les seules valeurs modifiables
   du mode test ; le donjon fictif est reconstruit a partir d'elles
   a chaque rafraichissement du bandeau. */
var reglages = {
  palier: 5, niveau: 5, espece: "sunwukong",

  /* 0 = ne force rien, on suit chapitreAtteint(). Sa valeur de
     depart vient de MODE_TEST_CHAPITRE, comme le reste du panneau
     part de constantes de config.js. */
  chapitre: MODE_TEST_CHAPITRE,

  /* Le combat a plusieurs (js/ecran3.js) sur le terrain d'essai :
     l'interrupteur, et le nombre d'adversaires (1 a 3). Comme le
     reste du panneau, rien n'est enregistre : ils reviennent a
     "Non" et 1 a chaque rechargement. */
  multi: false,
  adversaires: 1,

  /* Les breches permanentes (js/brechesjeu.js) : l'interrupteur, et
     le terrain d'essai change en breche n (1 a BRECHES_TERRAINS_ESSAI,
     0 = arene normale). Comme le reste, ils reviennent a Non et 0 au
     rechargement. Les jours simules, eux, sont gardes : voir
     joursSimules() plus bas. */
  breches: false,
  brecheTerrain: 0
};

var panneauPret = false;


/* ------------------------------------------------------------
   EST-IL ACTIF ?
   Un seul endroit repond a la question. Tout le reste s'y fie.
   ------------------------------------------------------------ */

function enLocal() {
  var h = (typeof location !== "undefined" && location.hostname) || "";
  // Chaine vide : fichier ouvert directement (file://)
  return h === "" || h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function actif() {
  if (!MODE_TEST) return false;
  if (!MODE_TEST_LOCAL_SEULEMENT) return true;
  return enLocal();
}

/* LE CHAPITRE FORCE

   Lu par chapitreAtteint() dans js/lieux.js, et par personne
   d'autre. Rend 0 quand le mode test est eteint : le jeu retombe
   alors sur sa propre progression, sans rien avoir a defaire.

   Il n'ECRIT NULLE PART. Le chapitre n'existe pas dans la
   sauvegarde, donc le forcer ne peut rien y abimer, et couper le
   mode test suffit a revenir a l'etat normal.

   Ce qu'il ne peut pas defaire, en revanche : un lieu deja
   decouvert garde l'espece qu'il avait, figee dans le cache des
   donjons. Le chapitre force ne change que les lieux rencontres
   ensuite. */
function chapitreForce() {
  if (!actif()) return 0;

  var c = Math.round(Number(reglages.chapitre));
  if (!(c >= 1)) return 0;

  return Math.min(c, CHAPITRE_MAX);
}


/* ------------------------------------------------------------
   LE DONJON FICTIF

   Il n'est jamais range dans donjons, donc jamais serialise :
   sauvegarder() ne connait que donjons. Il porte fictif: true,
   marque que combat.js relit pour ne rien enregistrer a la fin
   de la rencontre.

   La generation deterministe des vrais lieux n'est pas touchee :
   ce donjon-ci ne passe pas par donjonDepuisLieu(), il est
   fabrique de toutes pieces a partir des reglages du panneau.
   ------------------------------------------------------------ */

function donjonDeTest(lat, lon) {
  if (!actif()) return null;

  /* En breche d'essai, le terrain prend un id a part par numero (les
     quatre breches sont distinctes) et la famille de l'espece choisie
     au-dessus : changer d'espece, c'est changer de famille de boss. */
  var n = Math.round(Number(reglages.brecheTerrain));
  var essai = reglages.breches === true && n >= 1 && n <= BRECHES_TERRAINS_ESSAI;

  return {
    id: essai ? "test/breche/" + n : "test/fictif",
    lat: lat, lon: lon,
    lieu: "Terrain d'essai",
    nom: essai ? "Brèche d'essai " + n : "Terrain d'essai",
    categorie: essai ? ESPECES[reglages.espece].famille : "temple",
    brecheEssai: essai,
    espece: reglages.espece,
    niveau: reglages.niveau,

    // figementDuLieu() respecte une valeur deja posee sur le lieu :
    // le panneau pilote donc le palier sans rien recalculer.
    figement: reglages.palier * FIGEMENT_PAR_PALIER,

    capture: false,
    dissipe: false,
    fictif: true
  };
}


/* ------------------------------------------------------------
   LE PANNEAU
   Construit une seule fois, au premier bandeau affiche.
   ------------------------------------------------------------ */

function preparerPanneau() {
  if (panneauPret || !actif()) return;

  var boite = elem("mode-test");
  if (!boite) return;

  // La liste des especes, dans l'ordre du bestiaire
  var options = "";
  for (var id in ESPECES) {
    options += '<option value="' + id + '"' +
               (id === reglages.espece ? " selected" : "") + '>' +
               ESPECES[id].nom + " (" + ESPECES[id].rang + ")</option>";
  }
  elem("mt-espece").innerHTML = options;

  /* Le chapitre. "Progression" est la valeur 0 : elle ne force
     rien et laisse le jeu decider, ce qui doit rester le defaut
     evident quand on ouvre le panneau. rafraichir() lui ajoutera
     le chapitre effectivement deduit, entre parentheses. */
  var chapitres = '<option value="0">Progression</option>';
  for (var c = 1; c <= CHAPITRE_MAX; c++) {
    chapitres += '<option value="' + c + '"' +
                 (c === reglages.chapitre ? " selected" : "") + '>' +
                 'Chapitre ' + c + '</option>';
  }
  elem("mt-chapitre").innerHTML = chapitres;

  elem("mt-palier").value = reglages.palier;
  elem("mt-niveau").value = reglages.niveau;

  elem("mt-palier").addEventListener("input", function () {
    reglages.palier = Number(this.value);
    rafraichir();
  });
  elem("mt-niveau").addEventListener("input", function () {
    reglages.niveau = Number(this.value);
    rafraichir();
  });
  elem("mt-espece").addEventListener("change", function () {
    reglages.espece = this.value;
    rafraichir();
  });
  elem("mt-chapitre").addEventListener("change", function () {
    reglages.chapitre = Number(this.value);
    rafraichir();
  });

  elem("mt-adversaires").value = reglages.adversaires;
  elem("mt-multi").addEventListener("click", function () {
    reglages.multi = !reglages.multi;
    majInterrupteur();
  });
  elem("mt-adversaires").addEventListener("change", function () {
    reglages.adversaires = Number(this.value);
  });
  majInterrupteur();

  preparerBreches();
  preparerBanc();

  boite.classList.add("actif");
  panneauPret = true;
  rafraichir();
}

// L'interrupteur du combat a plusieurs dit son etat en toutes lettres.
function majInterrupteur() {
  var b = elem("mt-multi");
  b.textContent = "Combat à plusieurs : " + (reglages.multi ? "Oui" : "Non");
  b.classList[reglages.multi ? "add" : "remove"]("mt-allume");
}

/* Le combat a plusieurs est-il demande par le panneau ? Lu par
   Ecran3.choisi() (js/ecran3.js). Faux des que le mode test est
   eteint : l'interrupteur ne survit pas a MODE_TEST = false. */
function combatMulti() {
  return actif() && reglages.multi === true;
}

// Reecrit les valeurs lues a cote des reglages, puis le bandeau.
function rafraichir() {
  if (!actif()) return;

  elem("mt-palier-val").textContent = reglages.palier;
  elem("mt-niveau-val").textContent = reglages.niveau;

  /* Le chapitre que la progression donnerait, affiche sur l'option
     "Progression". Sans lui, on regle un chapitre a l'aveugle sans
     savoir de quoi on s'ecarte -- et c'est justement l'ecart qu'on
     veut mesurer en testant.

     On lit la progression VRAIE, pas chapitreAtteint(), qui rendrait
     le chapitre force et afficherait donc sa propre valeur. */
  var option = elem("mt-chapitre") && elem("mt-chapitre").options[0];
  if (option) {
    var vrai = CHAPITRE_DEPART;
    while (vrai < CHAPITRE_MAX && chapitreAcheve(vrai)) vrai++;
    option.textContent = "Progression (ch. " + vrai + ")";
  }

  // Le bandeau du bas doit suivre immediatement : c'est lui qui
  // annonce la difficulte et le niveau de l'adversaire.
  if (!combat && dernierePosition) {
    mettreAJourHud(dernierePosition[0], dernierePosition[1]);
  }
}


/* ------------------------------------------------------------
   LES BRECHES PERMANENTES

   On ne peut pas attendre 7 vrais jours, ni un mois. Ces outils font
   passer le temps du jeu, et rien d'autre :
     "+1 jour", "+3 jours"  des jours simules, ajoutes au jour reel
                            (BrechesJeu.aujourdhui) ;
     "Finir la semaine"     sur la breche d'essai choisie, une
                            victoire par jour jusqu'au matin du jour 7 :
                            il reste le boss final a battre a la main ;
     "Mois suivant"         saute au 1er du mois suivant : la saison
                            bascule au prochain affichage ;
     "Etat"                 montre ce que contiennent les donnees ;
     "Reinitialiser"        remet les breches d'essai et les jours a 0.

   CE QU'ILS ECRIVENT : en mode test, js/brechesjeu.js sauve sous
   CLE_BRECHES_TEST, jamais sous la vraie cle ; les jours simules
   vivent sous CLE_BRECHES_TEST_JOURS. Mode test eteint, chaque outil
   s'arrete sur actif() et joursSimules() rend 0 : le jeu retrouve
   le vrai jour, sans rien avoir a defaire.
   ------------------------------------------------------------ */

var brechesPretes = false;
var etatOuvert = false;

// Les jours simules, relus a chaque fois : 0 hors du mode test.
function joursSimules() {
  if (!actif()) return 0;
  try {
    var n = Number(localStorage.getItem(CLE_BRECHES_TEST_JOURS));
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (e) { return 0; }
}

function ecrireJours(n) {
  try { localStorage.setItem(CLE_BRECHES_TEST_JOURS, String(Math.max(0, Math.floor(n)))); } catch (e) {}
}

// Apres chaque outil : anneaux, bandeau, et l'etat s'il est ouvert.
function apresOutil() {
  BrechesJeu.rafraichirTout();
  afficherEtatBreches();
  rafraichir();
}

function avancerJours(n) {
  if (!actif() || !(n > 0)) return false;
  ecrireJours(joursSimules() + n);
  apresOutil();
  return true;
}

function moisSuivant() {
  if (!actif() || !BrechesJeu.actif()) return false;
  var j = BrechesJeu.aujourdhui();
  return avancerJours(premierJourDuMoisSuivant(j) - j);
}

/* Une victoire par jour sur la breche d'essai, jusqu'au jour ou le
   boss final attend. S'arrete aussi sur une breche possedee ou hors
   d'atteinte. Rend un mot pour le panneau. */
function finirSemaine() {
  if (!actif() || !BrechesJeu.actif()) return "breches eteintes";
  var pos = typeof dernierePosition !== "undefined" && dernierePosition ? dernierePosition : [0, 0];
  var d = donjonDeTest(pos[0], pos[1]);
  var info = BrechesJeu.infoArene(d);
  if (!info) return "choisis une breche d'essai";

  // Gagner, passer au lendemain, recommencer. Au plus deux tours par
  // jour du cycle : la borne ne sert qu'a ne jamais boucler.
  for (var i = 0; i < 3 * BRECHES_CYCLE_JOURS && info; i++) {
    if (info.statut === "possedee" || info.statut === "plafond") break;
    if (info.statut === "eteinte") ecrireJours(joursSimules() + 1);   // le lendemain
    else if (info.boss.role === "final") break;                         // le jour 7 est la
    else if (!BrechesJeu.simulerVictoire(d)) break;
    info = BrechesJeu.infoArene(d);
  }
  apresOutil();
  return info ? info.statut : "";
}

function reinitialiserBreches() {
  if (!actif()) return false;
  ecrireJours(0);
  BrechesJeu.effacerTest();
  apresOutil();
  return true;
}

function afficherEtatBreches() {
  var boite = elem("mt-breches-texte");
  if (!boite) return;
  boite.innerHTML = etatOuvert && actif() ? BrechesJeu.lignesEtat().join("<br>") : "";
}

function majBreches() {
  var b = elem("mt-breches");
  b.textContent = "Brèches : " + (reglages.breches ? "Oui" : "Non");
  b.classList[reglages.breches ? "add" : "remove"]("mt-allume");
  elem("mt-breches-outils").classList[reglages.breches ? "add" : "remove"]("actif");
}

function preparerBreches() {
  if (brechesPretes || !actif()) return;

  var terrains = '<option value="0">Arène normale</option>';
  for (var n = 1; n <= BRECHES_TERRAINS_ESSAI; n++) {
    terrains += '<option value="' + n + '">Brèche d\'essai ' + n + '</option>';
  }
  elem("mt-breche-terrain").innerHTML = terrains;
  elem("mt-breche-terrain").value = reglages.brecheTerrain;

  elem("mt-breches").addEventListener("click", function () {
    reglages.breches = !reglages.breches;
    majBreches();
    apresOutil();
  });
  elem("mt-breche-terrain").addEventListener("change", function () {
    reglages.brecheTerrain = Number(elem("mt-breche-terrain").value);
    apresOutil();
  });
  elem("mt-jour-1").addEventListener("click", function () { avancerJours(1); });
  elem("mt-jour-3").addEventListener("click", function () { avancerJours(3); });
  elem("mt-semaine").addEventListener("click", finirSemaine);
  elem("mt-mois").addEventListener("click", moisSuivant);
  elem("mt-etat").addEventListener("click", function () {
    etatOuvert = !etatOuvert;
    afficherEtatBreches();
  });
  elem("mt-raz").addEventListener("click", reinitialiserBreches);

  majBreches();
  brechesPretes = true;
}


/* ------------------------------------------------------------
   LE BANC 3D

   Un ecran pour verifier le rendu 3D sur le telephone, sans lancer
   de combat : le cube de test (cinq clips) sur le decor de test.
   Trois essais, et le visuel montre doit etre evident a chaque fois :
     - "Cube de test"        -> la 3D, si tout va bien ;
     - "Espece sans modele"  -> le REPLI 2D (modele: null) ;
     - "Fichier absent"      -> le REPLI 2D (404 sur un .glb).
   "Simuler perte WebGL" coupe le contexte comme iOS le fait quand
   Safari passe en arriere-plan, et le rend 2 s plus tard.

   N'ecrit rien dans localStorage, ne touche ni au combat ni a la
   carte. Fermer detruit la scene et rend la memoire.
   ------------------------------------------------------------ */

// Un chemin qui n'existe pas, expres : le repli sur 404.
var MODELE_3D_ABSENT = { modele: "assets/monstres/absent.glb", echelle: 1, clips: {} };

var banc = { pret: false, essai: "", poignee: null, pertes: 0, attenteRetour: null };

function bancEtat(texte) { elem("banc-3d-etat").textContent = texte; }

/* Le visuel 2D, comme dans afficherAdversaire() (js/combat.js) :
   le secours d'abord, l'image par-dessus si elle arrive. */
function bancRepli(especeId, raison) {
  banc.poignee = null;
  bancClips();

  var vue = elem("banc-3d-vue");
  vue.innerHTML = "";

  var cadre = document.createElement("div");
  cadre.className = "banc-repli";

  var vide = document.createElement("div");
  vide.className = "banc-repli-vide";
  poserSecours(vide, especeId);
  cadre.appendChild(vide);

  var e = ESPECES[especeId];
  if (e && e.image) {
    var img = document.createElement("img");
    img.alt = "";
    img.style.display = "none";
    img.onload = function () { img.style.display = "block"; vide.style.display = "none"; };
    img.onerror = function () { img.style.display = "none"; vide.style.display = "flex"; };
    img.src = DOSSIER_MONSTRES + e.image;
    cadre.appendChild(img);
  }
  vue.appendChild(cadre);

  bancEtat("REPLI 2D -- " + raison + (banc.pertes ? " -- pertes WebGL : " + banc.pertes : ""));
}

// Un bouton par clip, actifs seulement quand un modele est la.
function bancClips() {
  var zone = elem("banc-3d-clips");
  zone.innerHTML = "";
  CLIPS_3D.forEach(function (role) {
    var b = document.createElement("button");
    b.textContent = role;
    b.disabled = !banc.poignee;
    b.addEventListener("click", function () {
      if (!banc.poignee) return;
      var ok = Rendu3D.jouerClip(banc.poignee, role);
      bancEtat("3D -- clip : " + role + (ok ? "" : " (absent du fichier)") +
               (banc.pertes ? " -- pertes WebGL : " + banc.pertes : ""));
    });
    zone.appendChild(b);
  });
}

function bancEssayer(essai) {
  banc.essai = essai;
  banc.poignee = null;
  Rendu3D.detruire();
  elem("banc-3d-vue").innerHTML = "";
  bancClips();
  bancEtat("chargement...");

  var especeRepli = essai === "sans" ? ESPECE_3D_REPLI_TEST : "jinchan";
  var rappels = {
    repli: function (raison) {
      if (raison === "contexte_perdu") banc.pertes++;
      bancRepli(especeRepli, raison);
      if (raison === "contexte_perdu") bancAttendreRetour();
    },
    pret: function (poignee) {
      banc.poignee = poignee;
      bancClips();
      bancEtat("3D -- clip : idle" + (banc.pertes ? " -- pertes WebGL : " + banc.pertes : ""));
    }
  };

  if (essai === "sans") {
    Rendu3D.essayerEspece(elem("banc-3d-vue"), ESPECE_3D_REPLI_TEST, rappels);
  } else {
    rappels.decor = DECOR_3D_TEST;
    Rendu3D.essayerModele(elem("banc-3d-vue"), essai === "absent" ? MODELE_3D_ABSENT : MODELE_3D_TEST, rappels);
  }
}

/* Apres une perte de contexte : le 2D tient l'ecran, et on relance
   la 3D quand l'app est de nouveau visible (tout de suite si elle
   l'est deja, apres une courte pause). */
function bancAttendreRetour() {
  if (banc.attenteRetour !== null) return;   // deja en attente
  function relancer() {
    if (document.hidden || !elem("banc-3d").classList.contains("actif")) return;
    document.removeEventListener("visibilitychange", relancer);
    clearTimeout(banc.attenteRetour);
    banc.attenteRetour = null;
    bancEssayer(banc.essai);
  }
  document.addEventListener("visibilitychange", relancer);
  banc.attenteRetour = setTimeout(relancer, 2500);
}

function ouvrirBanc() {
  if (!actif()) return;
  elem("banc-3d").classList.add("actif");
  bancEssayer("cube");
}

function fermerBanc() {
  clearTimeout(banc.attenteRetour);
  banc.attenteRetour = null;
  banc.poignee = null;
  Rendu3D.detruire();
  elem("banc-3d-vue").innerHTML = "";
  elem("banc-3d").classList.remove("actif");
}

function preparerBanc() {
  if (banc.pret || !actif()) return;
  elem("btn-banc-3d").addEventListener("click", ouvrirBanc);
  elem("btn-banc-cube").addEventListener("click", function () { bancEssayer("cube"); });
  elem("btn-banc-sans-modele").addEventListener("click", function () { bancEssayer("sans"); });
  elem("btn-banc-fichier-absent").addEventListener("click", function () { bancEssayer("absent"); });
  elem("btn-banc-perte").addEventListener("click", function () {
    if (!Rendu3D.simulerPerte(2000)) bancEtat("simulation impossible ici (pas de scene 3D active)");
  });
  elem("btn-banc-fermer").addEventListener("click", fermerBanc);
  banc.pret = true;
}


return {
  actif: actif,
  chapitreForce: chapitreForce,
  combatMulti: combatMulti,
  donjonDeTest: donjonDeTest,
  preparerPanneau: preparerPanneau,
  joursSimules: joursSimules,
  avancerJours: avancerJours,
  moisSuivant: moisSuivant,
  finirSemaine: finirSemaine,
  reinitialiserBreches: reinitialiserBreches,
  reglages: reglages
};

})();
