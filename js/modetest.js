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

   Aucun combat d'essai n'ecrit dans localStorage : voir
   estCombatFictif() dans js/combat.js.
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
  chapitre: MODE_TEST_CHAPITRE
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

  return {
    id: "test/fictif",
    lat: lat, lon: lon,
    lieu: "Terrain d'essai",
    nom: "Terrain d'essai",
    categorie: "temple",
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

  preparerBanc();

  boite.classList.add("actif");
  panneauPret = true;
  rafraichir();
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
  donjonDeTest: donjonDeTest,
  preparerPanneau: preparerPanneau,
  reglages: reglages
};

})();
