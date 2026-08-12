/* ============================================================
   BOUCLE PRINCIPALE ET DEMARRAGE
   Ce fichier doit rester le dernier charge : il branche les
   boutons, et pour cela toutes les autres fonctions doivent
   deja exister.
   ============================================================ */

function positionMiseAJour(position) {
  var lat = position.coords.latitude;
  var lon = position.coords.longitude;

  dernierePosition = [lat, lon];
  joueur.setLatLng([lat, lon]);

  if (!combat) carte.setView([lat, lon], carte.getZoom());

  if (!chargementEnCours &&
      (!dernierePosRequete ||
       distanceMetres(lat, lon, dernierePosRequete[0], dernierePosRequete[1]) > DISTANCE_RELANCE)) {
    chargerDonjons(lat, lon, 0);
  }

  if (!combat) mettreAJourHud(lat, lon);
}

function erreurPosition(err) {
  elem("texte").textContent = "Position indisponible (" + err.message + ")";
}


/* ------------------------------------------------------------
   DEMARRAGE
   ------------------------------------------------------------ */

elem("btn-depart").addEventListener("click", function () {
  elem("depart").style.display = "none";
  chargerJoueur();
  charger();

  navigator.geolocation.watchPosition(positionMiseAJour, erreurPosition, {
    enableHighAccuracy: true, maximumAge: 2000, timeout: 20000
  });
});

elem("entrer").addEventListener("click", function () {
  if (!donjonProche || estClos(donjonProche) || equipe.length === 0) return;
  demarrerCombat(donjonProche, distanceProche <= DISTANCE_PREEMPTIF);
});

elem("btn-grimoire").addEventListener("click", ouvrirGrimoire);

elem("btn-fermer-grimoire").addEventListener("click", function () {
  elem("grimoire").classList.remove("actif");
});

brancherBoutonsCombat();
