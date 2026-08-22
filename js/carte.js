/* ============================================================
   LA CARTE
   Leaflet, le point du joueur, les marqueurs des donjons
   et le bandeau qui annonce le lieu le plus proche.
   ============================================================ */

var carte = L.map("carte", { zoomControl: false, attributionControl: false })
             .setView([25.033, 121.565], 16);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(carte);

var joueur = L.circleMarker([25.033, 121.565], {
  radius: 9, color: "#fff", weight: 3,
  fillColor: "#3b82f6", fillOpacity: 1
}).addTo(carte);

var marqueurs = {};
var donjonProche = null;
var distanceProche = Infinity;
var dernierePosition = null;
var dernierePosRequete = null;


/* ------------------------------------------------------------
   LES MARQUEURS
   ------------------------------------------------------------ */

function estClos(d) { return d.capture || d.dissipe; }

function poserMarqueur(d) {
  var m = L.circleMarker([d.lat, d.lon], {
    radius: 11, color: "#fff", weight: 2,
    fillColor: estClos(d) ? "#555" : (COULEURS[d.categorie] || "#b455d4"),
    fillOpacity: estClos(d) ? 0.5 : 0.9
  }).addTo(carte);

  m.bindPopup(texteInfobulle(d));
  marqueurs[d.id] = m;
}

function texteInfobulle(d) {
  var e = ESPECES[d.espece];
  var bas;

  if (d.capture) bas = "Savoir assimilé";
  else if (d.dissipe) bas = "Savoir perdu";
  else bas = e.nom + ", " + e.titre + " &middot; niveau " + niveauAdversaire(d);

  return '<div class="pop-titre">' + d.nom + '</div>' +
         '<div class="pop-lieu">' + d.lieu + '</div>' +
         '<div class="pop-mons">' + bas + '</div>';
}

function rafraichirMarqueur(d) {
  var m = marqueurs[d.id];
  if (!m) return;
  m.setStyle({
    fillColor: estClos(d) ? "#555" : (COULEURS[d.categorie] || "#b455d4"),
    fillOpacity: estClos(d) ? 0.5 : 0.9
  });
  m.setPopupContent(texteInfobulle(d));
}


/* ------------------------------------------------------------
   BANDEAU DE LA CARTE
   ------------------------------------------------------------ */

/* La difficulte du lieu, lue AVANT d'y entrer.

   C'est le nouveau role du Figement : il ne pese plus sur le combat,
   il annonce ce qui attend le joueur. Il reste soumis a la lecture
   progressive : sous le seuil, une impression ; au-dessus, le
   chiffre exact. Il n'apparait jamais pendant un combat. */
function ligneDifficulte(d) {
  var valeur = figementDuLieu(d);
  var palier = palierFigement(valeur);

  var texte = experienceDuGardien() >= SEUIL_LECTURE_FIGEMENT ?
              "Figement " + Math.round(valeur) + " % — palier " + palier :
              libelleFigement(palier);

  return '<span class="difficulte">' + texte + '</span>';
}

function mettreAJourHud(lat, lon) {
  donjonProche = null;
  distanceProche = Infinity;

  for (var id in donjons) {
    var d = donjons[id];
    var dist = distanceMetres(lat, lon, d.lat, d.lon);
    if (dist < distanceProche) { distanceProche = dist; donjonProche = d; }
  }

  /* Mode test : un donjon fictif se pose a ta position et prend la
     place du plus proche, ou que tu sois. Hors mode test, ces deux
     lignes ne font rien du tout. */
  if (ModeTest.actif()) {
    ModeTest.preparerPanneau();
    donjonProche = ModeTest.donjonDeTest(lat, lon);

    // Assez pres pour entrer, assez loin pour ne pas offrir le tour
    // gratuit : sinon on ne testerait jamais un combat ordinaire.
    distanceProche = DISTANCE_ENTREE - 1;
  }

  var texte = elem("texte");
  var bouton = elem("entrer");

  if (!donjonProche) {
    texte.textContent = "Aucun lieu eveille dans les environs.";
    bouton.style.display = "none";
    return;
  }

  var e = ESPECES[donjonProche.espece];

  /* On demande l'illustration de cet Echo des qu'il devient le plus
     proche, donc pendant que le joueur marche encore vers lui. Elle
     sera en cache quand le combat s'ouvrira, et l'adversaire
     apparaitra du premier coup. prechargerEspece() ne telecharge
     qu'une fois par espece. */
  prechargerEspece(donjonProche.espece);

  if (distanceProche > DISTANCE_ENTREE) {
    texte.innerHTML = "<b>" + donjonProche.nom + "</b><br>" + Math.round(distanceProche) + " m";
    bouton.style.display = "none";
    return;
  }

  if (donjonProche.capture) {
    texte.innerHTML = "<b>" + donjonProche.nom + "</b><br>Ce savoir est deja tien.";
    bouton.style.display = "none";
  } else if (donjonProche.dissipe) {
    texte.innerHTML = "<b>" + donjonProche.nom + "</b><br>Le savoir s'est perdu ici.";
    bouton.style.display = "none";
  } else if (equipe.length === 0) {
    texte.innerHTML = "<b>" + donjonProche.nom + "</b><br>Aucun echo dans ton equipe.";
    bouton.style.display = "none";
  } else {
    texte.innerHTML = "<b>" + e.nom + "</b>, " + e.titre +
                      "<br>niveau " + niveauAdversaire(donjonProche) +
                      "<br>" + ligneDifficulte(donjonProche) +
                      (distanceProche <= DISTANCE_PREEMPTIF ?
                       "<br><span style='color:#b455d4'>Il ne t'a pas vu venir.</span>" : "");
    bouton.style.display = "block";
  }
}
