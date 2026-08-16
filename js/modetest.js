/* ============================================================
   LE MODE TEST
   Un donjon fictif pose a ta position, et un panneau discret pour
   regler le palier de Figement, le niveau et l'espece de
   l'adversaire. De quoi essayer un combat sans sortir de chez soi.

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
var reglages = { palier: 5, niveau: 5, espece: "sunwukong" };

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

  boite.classList.add("actif");
  panneauPret = true;
  rafraichir();
}

// Reecrit les valeurs lues a cote des reglages, puis le bandeau.
function rafraichir() {
  if (!actif()) return;

  elem("mt-palier-val").textContent = reglages.palier;
  elem("mt-niveau-val").textContent = reglages.niveau;

  // Le bandeau du bas doit suivre immediatement : c'est lui qui
  // annonce la difficulte et le niveau de l'adversaire.
  if (!combat && dernierePosition) {
    mettreAJourHud(dernierePosition[0], dernierePosition[1]);
  }
}


return {
  actif: actif,
  donjonDeTest: donjonDeTest,
  preparerPanneau: preparerPanneau,
  reglages: reglages
};

})();
