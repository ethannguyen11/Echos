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

  // Les poches d'Oubli, sous leur propre cle (jamais echos_joueur_v5).
  // L'heure est lue ICI : js/poche.js ne lit jamais l'horloge.
  chargerPoches();
  if (nettoyerPoches(Date.now()) > 0) sauverPoches();

  // La permission de geolocalisation exige un geste utilisateur sur
  // iOS : cet appel doit rester dans le clic, avant toute autre chose.
  navigator.geolocation.watchPosition(positionMiseAJour, erreurPosition, {
    enableHighAccuracy: true, maximumAge: 2000, timeout: 20000
  });

  // Premier lancement : la cinematique, puis la carte.
  // Ensuite : la carte directement.
  // INTRO DESACTIVEE -- conservee pour reactivation : tant que
  // INTRO_ACTIVE (js/config.js) vaut false, Intro.demarrer n'est
  // plus appele, et le flux court (langue, nom, genre) le remplace.
  if (!profil.introVue) {
    var lancerIntro = INTRO_ACTIVE ? Intro.demarrer : Intro.demarrerCourt;
    lancerIntro(function () {
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

elem("btn-ico").addEventListener("click", Ico.ouvrir);
elem("btn-fermer-ico").addEventListener("click", Ico.fermer);

/* Un appui n'importe ou efface l'intervention d'Ico en cours.
   Branche sur le document entier, et volontairement en DERNIER :
   quand il s'execute, le bouton ou la carte ont deja recu le meme
   appui et fait leur travail. Ico efface, il ne bloque rien. */
document.addEventListener("click", Ico.surAppui);

brancherBoutonsCombat();
