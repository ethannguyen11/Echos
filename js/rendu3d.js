/* ============================================================
   LE RENDU 3D
   Affiche un modele .glb dans un petit canvas WebGL basse
   resolution (RENDU3D_LARGEUR x RENDU3D_HAUTEUR), agrandi sans
   lissage : l'aspect Nintendo DS / PS1.

   Depend de : js/config.js (CLIPS_3D, MONSTRES_3D, BUDGET_3D...),
   et, A LA DEMANDE SEULEMENT, de lib/three/ (Three.js r147,
   licence MIT). Ce fichier n'en a pas besoin pour se charger :
   il ajoute lui-meme les deux <script> de lib/three/ a la page la
   premiere fois qu'on demande de la 3D. Le demarrage du jeu et la
   carte ne paient donc rien.

   Deux parties :
     - les REGLES (fonctions globales, sans DOM, sans WebGL) :
       quel visuel montrer, quel nom de clip jouer, une cinematique
       est-elle bien formee. Testees par verifier/parcours.js ;
     - window.Rendu3D : le canvas, Three.js, le chargement, la
       boucle d'affichage. Se verifie a la main (banc 3D du mode
       test, voir js/modetest.js).

   LE REPLI EST LA REGLE, PAS L'EXCEPTION. Pas de fichier, fichier
   introuvable, WebGL absent, Three.js qui ne se telecharge pas,
   contexte WebGL coupe par iOS : dans tous ces cas l'appelant
   recoit repli(raison) et remet le visuel 2D actuel. Aucune
   erreur ne remonte, rien ne s'affiche dans la console.

   LE COMBAT N'EST PAS BRANCHE. js/combat.js n'appelle rien ici.
   Le futur point d'accroche : afficherAdversaire() (js/combat.js),
   a cote du secours existant. Le secours 2D y est pose AVANT la
   tentative d'image ; la 3D viendra au meme endroit, de la meme
   facon : poser le 2D, puis Rendu3D.essayerEspece() par-dessus,
   et repli() ne fait que remettre le 2D deja pret.

   LE COMBAT 3 CONTRE 3 viendra dans une tache separee. Elle devra
   gerer PLUSIEURS modeles dans la meme scene : chargerModele() rend
   deja une poignee par modele (chacun son mixer, ses clips), mais
   il n'y a qu'UNE scene et UN canvas a la fois. Le placement des
   six combattants, la camera et les cinematiques restent a faire.
   ============================================================ */


/* ------------------------------------------------------------
   LES REGLES (sans DOM, sans WebGL)
   ------------------------------------------------------------ */

function entreeMonstre3D(especeId) {
  return Object.prototype.hasOwnProperty.call(MONSTRES_3D, especeId) ? MONSTRES_3D[especeId] : null;
}

/* Le nom du clip a chercher dans le fichier pour un role de
   CLIPS_3D. Par defaut le role lui-meme ; entree.clips peut le
   renommer. Rend "" pour un role inconnu. */
function nomClip3D(entree, role) {
  if (CLIPS_3D.indexOf(role) === -1) return "";
  var c = entree && entree.clips;
  if (c && typeof c[role] === "string" && c[role] !== "") return c[role];
  return role;
}

/* Pourquoi on ne montrera PAS la 3D. "" = rien ne s'y oppose.
   etat vient de Rendu3D.etat() (ou d'un test) :
     { webgl: bool, lib: "absente"|"en_cours"|"prete"|"echec",
       contextePerdu: bool, echecs: { chemin: true } }
   L'ordre compte : on donne la premiere raison, la plus simple. */
function raisonRepli3D(entree, etat) {
  if (!entree) return "pas_au_manifeste";
  if (typeof entree.modele !== "string" || entree.modele === "") return "pas_de_modele";
  if (!etat || !etat.webgl) return "webgl_indisponible";
  if (etat.lib === "echec") return "lib_absente";
  if (etat.contextePerdu) return "contexte_perdu";
  if (etat.echecs && Object.prototype.hasOwnProperty.call(etat.echecs, entree.modele)) {
    return "chargement_echoue";
  }
  return "";
}

// "3d" ou "2d" pour une espece.
function choisirVisuel3D(especeId, etat) {
  return raisonRepli3D(entreeMonstre3D(especeId), etat) === "" ? "3d" : "2d";
}

function vecteur3D(v) {
  return v && typeof v.length === "number" && v.length === 3 &&
         v.every(function (x) { return typeof x === "number" && isFinite(x); });
}

/* Verifie une cinematique d'attaque (format decrit dans
   js/config.js). Rend "" si elle est bien formee, sinon la
   premiere faute trouvee. Ne joue rien. */
function validerCinematique3D(c) {
  function fini(x) { return typeof x === "number" && isFinite(x); }

  if (!c || typeof c !== "object") return "pas_un_objet";
  if (typeof c.id !== "string" || c.id === "") return "id";
  if (!c.attaquant || CLIPS_3D.indexOf(c.attaquant.clip) === -1) return "attaquant.clip";
  if (!fini(c.duree) || c.duree <= 0) return "duree";

  if (!c.camera || typeof c.camera.length !== "number" || c.camera.length === 0) return "camera";
  var avant = -1;
  for (var i = 0; i < c.camera.length; i++) {
    var p = c.camera[i];
    if (!p || !fini(p.t) || p.t < 0 || p.t > c.duree || p.t <= avant) return "camera[" + i + "].t";
    if (!vecteur3D(p.position)) return "camera[" + i + "].position";
    if (!vecteur3D(p.cible)) return "camera[" + i + "].cible";
    avant = p.t;
  }

  var e = c.effet;
  if (!e || EFFETS_3D.indexOf(e.type) === -1) return "effet.type";
  if (!fini(e.debut) || e.debut < 0) return "effet.debut";
  if (!fini(e.duree) || e.duree <= 0 || e.debut + e.duree > c.duree) return "effet.duree";
  if (typeof e.couleur !== "string" || !/^#[0-9a-fA-F]{6}$/.test(e.couleur)) return "effet.couleur";

  return "";
}


/* ------------------------------------------------------------
   window.Rendu3D : le canvas et Three.js
   ------------------------------------------------------------ */

window.Rendu3D = (function () {

var webglConnu = null;     // null = pas encore teste
var lib = "absente";       // "absente" | "en_cours" | "prete" | "echec"
var enAttenteLib = [];     // les rappels qui attendent lib/three/
var echecs = {};           // chemin -> true : ne pas retenter cette session

/* L'UNIQUE scene active, ou null. Une seule a la fois : en creer
   une deuxieme detruit la premiere (iOS limite le nombre de
   contextes WebGL ouverts). */
var s = null;


/* WebGL existe-t-il ? On cree un contexte d'essai et on le rend
   aussitot. Le resultat est garde : on ne demande qu'une fois. */
function webglDisponible() {
  if (webglConnu !== null) return webglConnu;
  webglConnu = false;
  try {
    var c = document.createElement("canvas");
    var gl = c.getContext && (c.getContext("webgl2") || c.getContext("webgl"));
    if (gl) {
      webglConnu = true;
      var perte = gl.getExtension && gl.getExtension("WEBGL_lose_context");
      if (perte) perte.loseContext();
    }
  } catch (e) { webglConnu = false; }
  return webglConnu;
}

function etat() {
  return {
    webgl: webglDisponible(),
    lib: lib,
    contextePerdu: !!(s && s.perdu),
    echecs: echecs
  };
}


/* Ajoute lib/three/ a la page, un fichier apres l'autre (le
   chargeur a besoin de THREE). fini(true|false). Un echec est
   garde pour la session : on ne retelecharge pas en boucle. */
function chargerLib(fini) {
  if (typeof THREE !== "undefined" && THREE.GLTFLoader) lib = "prete";
  if (lib === "prete") { fini(true); return; }
  if (lib === "echec") { fini(false); return; }

  enAttenteLib.push(fini);
  if (lib === "en_cours") return;
  lib = "en_cours";

  function terminer(ok) {
    lib = ok ? "prete" : "echec";
    var attente = enAttenteLib;
    enAttenteLib = [];
    attente.forEach(function (f) { f(ok); });
  }

  var i = 0;
  function suivant() {
    if (i >= FICHIERS_LIB_3D.length) {
      terminer(typeof THREE !== "undefined" && !!THREE.GLTFLoader);
      return;
    }
    var script = document.createElement("script");
    script.src = DOSSIER_LIB_3D + FICHIERS_LIB_3D[i++];
    script.onload = suivant;
    script.onerror = function () { terminer(false); };
    (document.head || document.body).appendChild(script);
  }
  suivant();
}


/* ---------- initialiser ----------
   Cree le canvas dans conteneur. rappels (facultatifs) :
     surPerte()  : iOS a coupe le contexte (app en arriere-plan...)
     surRetour() : le contexte est revenu ; le plus sur est de tout
                   detruire et de recommencer.
   Suppose lib/three/ deja la. Rend true si la scene est prete. */
function initialiser(conteneur, rappels) {
  detruire();
  rappels = rappels || {};

  try {
    var renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: true, powerPreference: "low-power"
    });
    renderer.setPixelRatio(1);   // jamais x3 sur iPhone : on VEUT les gros pixels
    renderer.setSize(RENDU3D_LARGEUR, RENDU3D_HAUTEUR, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    var canvas = renderer.domElement;
    canvas.className = "rendu3d";

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, RENDU3D_LARGEUR / RENDU3D_HAUTEUR, 0.1, 100);
    camera.position.set(0, 1.6, 4);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x403040, 1));
    var soleil = new THREE.DirectionalLight(0xffffff, 0.8);
    soleil.position.set(2, 4, 3);
    scene.add(soleil);

    s = {
      renderer: renderer, canvas: canvas, scene: scene, camera: camera,
      horloge: new THREE.Clock(), modeles: [], boucle: null,
      perdu: false, rappels: rappels, ecouteurs: {}
    };

    /* iOS coupe le contexte WebGL quand Safari passe en arriere-plan
       ou manque de memoire. preventDefault() demande au navigateur
       de pouvoir le rendre plus tard. */
    s.ecouteurs.perdu = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (!s) return;
      s.perdu = true;
      arreterBoucle();
      if (s.rappels.surPerte) s.rappels.surPerte();
    };
    s.ecouteurs.retour = function () {
      if (!s) return;
      s.perdu = false;
      if (s.rappels.surRetour) s.rappels.surRetour();
    };
    // Rien a dessiner pendant que l'app est cachee : on economise.
    s.ecouteurs.visibilite = function () {
      if (!s) return;
      if (document.hidden) arreterBoucle();
      else if (!s.perdu) afficher();
    };
    canvas.addEventListener("webglcontextlost", s.ecouteurs.perdu, false);
    canvas.addEventListener("webglcontextrestored", s.ecouteurs.retour, false);
    document.addEventListener("visibilitychange", s.ecouteurs.visibilite, false);

    conteneur.appendChild(canvas);
    return true;
  } catch (e) {
    detruire();
    return false;
  }
}


/* ---------- chargerModele ----------
   Charge un .glb et l'ajoute a la scene. fini(poignee | null).
   La poignee : { racine, mixer, animations, entree, action, role }.
   Un echec (404, fichier abime) est memorise : le meme chemin ne
   sera plus demande pendant la session. */
function chargerModele(entree, fini) {
  var chemin = entree && entree.modele;
  if (!s || typeof chemin !== "string" || Object.prototype.hasOwnProperty.call(echecs, chemin)) {
    fini(null);
    return;
  }

  var sceneDuDepart = s;
  try {
    new THREE.GLTFLoader().load(chemin, function (gltf) {
      // La scene a ete detruite pendant le telechargement
      if (s !== sceneDuDepart) { libererObjet(gltf.scene); fini(null); return; }

      var racine = gltf.scene;
      var echelle = typeof entree.echelle === "number" && entree.echelle > 0 ? entree.echelle : 1;
      racine.scale.setScalar(echelle);
      s.scene.add(racine);

      var poignee = {
        racine: racine, entree: entree,
        animations: gltf.animations || [],
        mixer: new THREE.AnimationMixer(racine),
        action: null, role: ""
      };
      // Apres une attaque ou un degat, on revient au repos. ko et
      // victoire restent figes sur leur derniere pose.
      poignee.mixer.addEventListener("finished", function () {
        if (poignee.role === "attaque" || poignee.role === "degat") jouerClip(poignee, "idle");
      });
      s.modeles.push(poignee);
      fini(poignee);
    }, undefined, function () {
      echecs[chemin] = true;
      fini(null);
    });
  } catch (e) {
    echecs[chemin] = true;
    fini(null);
  }
}


/* ---------- jouerClip ----------
   role : un nom de CLIPS_3D. Rend false si le fichier n'a pas ce
   clip (le modele garde alors sa pose, sans erreur). */
function jouerClip(poignee, role) {
  if (!poignee || !poignee.mixer) return false;
  var nom = nomClip3D(poignee.entree, role);
  if (!nom) return false;

  var clip = null;
  for (var i = 0; i < poignee.animations.length; i++) {
    if (poignee.animations[i].name === nom) { clip = poignee.animations[i]; break; }
  }
  if (!clip) return false;

  var action = poignee.mixer.clipAction(clip);
  if (poignee.action && poignee.action !== action) poignee.action.stop();
  action.reset();
  if (role === "idle") {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
  } else {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }
  action.play();
  poignee.action = action;
  poignee.role = role;
  return true;
}


/* ---------- afficher ----------
   Lance la boucle d'affichage (une image par rafraichissement de
   l'ecran). Sans effet si elle tourne deja, si l'app est cachee
   ou si le contexte est perdu. */
function afficher() {
  if (!s || s.perdu || s.boucle !== null || document.hidden) return;
  s.horloge.getDelta();   // oublie le temps passe a l'arret

  function image() {
    if (!s || s.perdu) return;
    try {
      var dt = s.horloge.getDelta();
      s.modeles.forEach(function (p) { if (p.mixer) p.mixer.update(dt); });
      s.renderer.render(s.scene, s.camera);
      s.boucle = requestAnimationFrame(image);
    } catch (e) {
      s.boucle = null;
    }
  }
  s.boucle = requestAnimationFrame(image);
}

function arreterBoucle() {
  if (s && s.boucle !== null) {
    cancelAnimationFrame(s.boucle);
    s.boucle = null;
  }
}


/* ---------- detruire ----------
   Rend TOUT : geometries, materiaux, textures, le contexte WebGL
   lui-meme, et retire le canvas de la page. Sans effet s'il n'y a
   pas de scene. A appeler en quittant l'ecran. */
function libererObjet(racine) {
  if (!racine || !racine.traverse) return;
  racine.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    var materiaux = Array.isArray(o.material) ? o.material : [o.material];
    materiaux.forEach(function (m) {
      for (var cle in m) {
        if (m[cle] && m[cle].isTexture) m[cle].dispose();
      }
      m.dispose();
    });
  });
}

function detruire() {
  if (!s) return;
  var ancienne = s;
  s = null;   // d'abord : les ecouteurs qui partiraient encore ne trouvent plus rien

  try {
    if (ancienne.boucle !== null) cancelAnimationFrame(ancienne.boucle);
    ancienne.canvas.removeEventListener("webglcontextlost", ancienne.ecouteurs.perdu, false);
    ancienne.canvas.removeEventListener("webglcontextrestored", ancienne.ecouteurs.retour, false);
    document.removeEventListener("visibilitychange", ancienne.ecouteurs.visibilite, false);

    ancienne.modeles.forEach(function (p) {
      if (p.mixer) { p.mixer.stopAllAction(); p.mixer.uncacheRoot(p.racine); }
    });
    libererObjet(ancienne.scene);
    ancienne.renderer.dispose();
    ancienne.renderer.forceContextLoss();
  } catch (e) {}

  if (ancienne.canvas && ancienne.canvas.parentNode) {
    ancienne.canvas.parentNode.removeChild(ancienne.canvas);
  }
}


/* ---------- essayer ----------
   Le point d'entree pour un ecran : tout faire, ou se replier.
   rappels :
     repli(raison) : remettre le visuel 2D. Peut arriver tout de
                     suite, apres un telechargement, ou bien plus
                     tard (contexte perdu).
     pret(poignee) : le modele est a l'ecran, en clip "idle".
     decor         : chemin d'un .glb de decor, facultatif. Un decor
                     qui echoue n'empeche pas le monstre.
   Ne leve jamais d'exception.

   CONTEXTE PERDU : tout est detruit et repli("contexte_perdu")
   part. On ne compte PAS sur la restauration de Three.js (les
   textures ne reviennent pas toujours sur iOS) : quand l'app
   revient au premier plan, l'APPELANT relance essayerModele(),
   qui repart de zero. Le 2D tient l'ecran entre les deux. */
function essayerModele(conteneur, entree, rappels) {
  rappels = rappels || {};
  var dejaReplie = false;
  function repli(raison) {
    if (dejaReplie) return;
    dejaReplie = true;
    detruire();
    if (rappels.repli) rappels.repli(raison);
  }

  try {
    var raison = raisonRepli3D(entree, etat());
    if (raison) { repli(raison); return; }

    chargerLib(function (ok) {
      try {
        if (!ok) { repli("lib_absente"); return; }
        var pret = initialiser(conteneur, {
          surPerte: function () { repli("contexte_perdu"); }
        });
        if (!pret) { repli("webgl_indisponible"); return; }

        var scene = s;
        function monstre() {
          chargerModele(entree, function (poignee) {
            if (s !== scene) return;   // detruit entre-temps
            if (!poignee) { repli("chargement_echoue"); return; }
            jouerClip(poignee, "idle");
            afficher();
            if (rappels.pret) rappels.pret(poignee);
          });
        }

        if (rappels.decor) {
          chargerModele({ modele: rappels.decor, echelle: 1, clips: {} }, function () { monstre(); });
        } else {
          monstre();
        }
      } catch (e) { repli("erreur"); }
    });
  } catch (e) { repli("erreur"); }
}

function essayerEspece(conteneur, especeId, rappels) {
  essayerModele(conteneur, entreeMonstre3D(especeId), rappels);
}

/* Pour le banc 3D : provoque une vraie perte de contexte, puis son
   retour apres delaiMs, comme iOS le ferait. Rend false si le
   navigateur ne sait pas le simuler. */
function simulerPerte(delaiMs) {
  if (!s) return false;
  try {
    var ext = s.renderer.getContext().getExtension("WEBGL_lose_context");
    if (!ext) return false;
    ext.loseContext();
    setTimeout(function () { try { ext.restoreContext(); } catch (e) {} }, delaiMs);
    return true;
  } catch (e) { return false; }
}

return {
  etat: etat,
  initialiser: initialiser,
  chargerModele: chargerModele,
  jouerClip: jouerClip,
  afficher: afficher,
  detruire: detruire,
  essayerModele: essayerModele,
  essayerEspece: essayerEspece,
  simulerPerte: simulerPerte,
  actif: function () { return s !== null; }
};

})();
