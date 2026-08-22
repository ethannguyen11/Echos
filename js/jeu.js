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

  // La permission de geolocalisation exige un geste utilisateur sur
  // iOS : cet appel doit rester dans le clic, avant toute autre chose.
  navigator.geolocation.watchPosition(positionMiseAJour, erreurPosition, {
    enableHighAccuracy: true, maximumAge: 2000, timeout: 20000
  });

  // Premier lancement : la cinematique, puis la carte.
  // Ensuite : la carte directement.
  if (!profil.introVue) {
    Intro.demarrer(function () {
      majFiche();
      if (dernierePosition) mettreAJourHud(dernierePosition[0], dernierePosition[1]);
    });
  }
});

elem("entrer").addEventListener("click", function () {
  if (!donjonProche || estClos(donjonProche) || equipe.length === 0) return;
  demarrerCombat(donjonProche, distanceProche <= DISTANCE_PREEMPTIF);
});

/* Un appui n'importe ou sur l'ecran de combat fait avancer le
   journal d'une ligne. Branche UNE SEULE FOIS, ici : #combat reste
   le meme element toute la partie, alors que les cinq boutons
   d'action sont reecrits a chaque rencontre par demarrerCombat().
   Les brancher au meme endroit empilerait les ecouteurs. */
elem("combat").addEventListener("click", avancerJournal);

elem("btn-grimoire").addEventListener("click", ouvrirGrimoire);

elem("btn-fermer-grimoire").addEventListener("click", function () {
  elem("grimoire").classList.remove("actif");
});

brancherBoutonsCombat();
