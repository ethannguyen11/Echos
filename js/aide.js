/* ============================================================
   L'AIDE
   Le bouton "?" de la carte : quatre lignes pour jouer, rien de
   plus. Elle remplace le panneau d'Ico tant que celui-ci est
   desactive (ICO_PANNEAU_ACTIVE dans js/config.js).

   Ce fichier expose un seul global : window.Aide. Les phrases ne
   sont pas ici : elles vivent dans js/langues.js (cles "aide.*"),
   et la liste des lignes dans js/config.js (AIDE_LIGNES).

   Le texte est relu a CHAQUE ouverture : changer de langue suffit,
   rien n'est fige au chargement.
   ============================================================ */

window.Aide = (function () {

// Les phrases, dans la langue courante. Exposee pour les tests.
function lignes() {
  return AIDE_LIGNES.map(function (cle) { return txt(cle); });
}

function dessiner() {
  elem("aide-titre").textContent = txt("aide.titre");
  elem("btn-fermer-aide").textContent = txt("aide.fermer");

  var zone = elem("aide-lignes");
  zone.innerHTML = "";
  lignes().forEach(function (l) {
    var p = document.createElement("p");
    p.className = "aide-ligne";
    p.textContent = l;
    zone.appendChild(p);
  });
}

function ouvrir() {
  dessiner();
  elem("aide").classList.add("actif");
}

function fermer() {
  elem("aide").classList.remove("actif");
}

/* Le bouton "Ico" de la barre n'est montre que si son panneau
   est active. Le panneau, son code et la pastille restent la :
   repasser ICO_PANNEAU_ACTIVE a true suffit a tout retrouver. */
function appliquerPanneauIco() {
  var b = elem("btn-ico");
  if (b) b.style.display = ICO_PANNEAU_ACTIVE ? "" : "none";
}

return {
  ouvrir: ouvrir,
  fermer: fermer,
  appliquerPanneauIco: appliquerPanneauIco,

  // Expose pour verifier/parcours.js
  lignes: lignes
};

})();
