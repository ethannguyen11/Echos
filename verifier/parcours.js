/* ============================================================
   LE PARCOURS DE L'INTRO
   Les tests de verifier/tests.js verifient des formules. Celui-ci
   joue vraiment la cinematique, du debut a la fin, dans un faux
   navigateur muni d'une horloge que l'on fait avancer a la main.

   Il repond aux questions qu'aucune formule ne peut trancher :
   est-ce qu'un tap saute une replique ? est-ce qu'une vieille
   sauvegarde survit ? est-ce que le repli s'affiche sans GPS ?

   Lance par node verifier.js. Ne tourne pas dans le navigateur.
   ============================================================ */

var fs = require("fs");
var vm = require("vm");
var path = require("path");

var RACINE = path.join(__dirname, "..");

// Tout sauf jeu.js : on ne veut pas brancher les boutons du jeu,
// seulement disposer de ses fonctions.
var FICHIERS = ["js/config.js", "js/especes.js", "js/lieux.js", "js/carte.js",
                "js/joueur.js", "js/combat.js", "js/grimoire.js", "js/intro.js",
                "js/modetest.js"];


/* ------------------------------------------------------------
   UN FAUX NAVIGATEUR
   ------------------------------------------------------------ */

function creerElement(tag) {
  var el = {
    tag: tag, id: "", type: "", value: "", maxLength: 0, className: "",
    enfants: [], parentNode: null, attributs: {}, ecouteurs: {},
    style: {}, focusee: false
  };

  // Comme dans un vrai navigateur : ecrire innerHTML remplace le
  // texte affiche, et ecrire textContent remplace le HTML.
  var html = "", texte = "";
  Object.defineProperty(el, "innerHTML", {
    get: function () { return html; },
    set: function (v) { html = String(v); texte = html.replace(/<[^>]*>/g, ""); }
  });
  Object.defineProperty(el, "textContent", {
    get: function () { return texte; },
    set: function (v) { texte = String(v); html = ""; }
  });

  el.classList = {
    liste: [],
    add: function (c) { if (this.liste.indexOf(c) === -1) this.liste.push(c); },
    remove: function (c) { var i = this.liste.indexOf(c); if (i !== -1) this.liste.splice(i, 1); },
    contains: function (c) { return this.liste.indexOf(c) !== -1; }
  };
  el.appendChild = function (e) { this.enfants.push(e); e.parentNode = this; return e; };
  el.removeChild = function (e) {
    var i = this.enfants.indexOf(e);
    if (i !== -1) this.enfants.splice(i, 1);
    e.parentNode = null;
    return e;
  };
  el.setAttribute = function (n, v) { this.attributs[n] = v; };
  el.getAttribute = function (n) { return this.attributs[n]; };
  el.addEventListener = function (n, f) { (this.ecouteurs[n] = this.ecouteurs[n] || []).push(f); };
  el.declencher = function (n, ev) {
    (this.ecouteurs[n] || []).forEach(function (f) {
      f(ev || { target: null, stopPropagation: function () {} });
    });
  };
  el.focus = function () { this.focusee = true; };
  el.blur = function () { this.focusee = false; };
  return el;
}

// Une horloge que l'on avance a la main : pas d'attente reelle,
// et les 90 secondes de cinematique passent en quelques millisecondes.
function creerHorloge() {
  var maintenant = 0, minuteurs = [], prochainId = 1;

  return {
    maintenant: function () { return maintenant; },
    setTimeout: function (f, d) {
      minuteurs.push({ id: prochainId, quand: maintenant + (d || 0), f: f, repete: 0 });
      return prochainId++;
    },
    setInterval: function (f, d) {
      minuteurs.push({ id: prochainId, quand: maintenant + (d || 0), f: f, repete: d || 1 });
      return prochainId++;
    },
    annuler: function (id) {
      minuteurs = minuteurs.filter(function (t) { return t.id !== id; });
    },
    avancer: function (ms) {
      var cible = maintenant + ms, garde = 0;
      while (garde++ < 100000) {
        var prochain = null;
        minuteurs.forEach(function (t) { if (!prochain || t.quand < prochain.quand) prochain = t; });
        if (!prochain || prochain.quand > cible) break;

        maintenant = prochain.quand;
        if (prochain.repete) prochain.quand = maintenant + prochain.repete;
        else minuteurs = minuteurs.filter(function (t) { return t !== prochain; });
        prochain.f();
      }
      maintenant = cible;
    }
  };
}

function creerMonde(options) {
  options = options || {};
  var horloge = creerHorloge();
  var stockage = options.stockage || {};

  // Les elements que index.html contient deja
  var statiques = {};
  ["carte", "fiche", "texte", "etat", "entrer", "depart", "btn-depart", "combat",
   "grimoire", "liste-echos", "combat-message", "equipe-combat"].forEach(function (id) {
    statiques[id] = creerElement("div");
    statiques[id].id = id;
  });

  var corps = creerElement("body");

  function fauxLeaflet() {
    return new Proxy(function () {}, {
      get: function () { return fauxLeaflet(); },
      set: function () { return true; },
      apply: function () { return fauxLeaflet(); }
    });
  }

  var ctx = {
    console: console, Math: Math, JSON: JSON, Object: Object, Array: Array,
    RegExp: RegExp, Error: Error, String: String, Number: Number, Symbol: Symbol,
    Infinity: Infinity, isFinite: isFinite,
    Date: { now: function () { return horloge.maintenant(); } },
    setTimeout: horloge.setTimeout, clearTimeout: horloge.annuler,
    setInterval: horloge.setInterval, clearInterval: horloge.annuler,
    location: { reload: function () { ctx.pageRechargee = true; } },
    fetch: function () {
      return { then: function () { return this; }, catch: function () { return this; } };
    },
    document: {
      body: corps,
      createElement: creerElement,
      getElementById: function (id) { return statiques[id] || null; },
      querySelectorAll: function () { return []; }
    },
    localStorage: {
      getItem: function (c) {
        return Object.prototype.hasOwnProperty.call(stockage, c) ? stockage[c] : null;
      },
      setItem: function (c, v) { stockage[c] = String(v); }
    },
    navigator: { geolocation: { watchPosition: function () {} } },
    L: {
      map: function () { return fauxLeaflet(); },
      tileLayer: function () { return fauxLeaflet(); },
      circleMarker: function () { return fauxLeaflet(); }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  FICHIERS.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(RACINE, f), "utf8"), ctx, { filename: f });
  });

  return { ctx: ctx, horloge: horloge, corps: corps, stockage: stockage, statiques: statiques };
}


/* ------------------------------------------------------------
   PILOTER L'INTRO
   ------------------------------------------------------------ */

function couche(m) { return m.corps.enfants[m.corps.enfants.length - 1]; }

// L'overlay est fait de zones emboitees (intro-visuel, intro-dialogue) :
// on cherche donc en profondeur, pas seulement chez les enfants directs.
function chercher(noeud, correspond) {
  if (!noeud) return null;
  for (var i = 0; i < noeud.enfants.length; i++) {
    var e = noeud.enfants[i];
    if (correspond(e)) return e;
    var trouve = chercher(e, correspond);
    if (trouve) return trouve;
  }
  return null;
}

function partie(m, id) {
  return chercher(couche(m), function (e) { return e.id === id; });
}

function zone(m, classe) {
  return chercher(couche(m), function (e) { return e.className === classe; });
}

// Ce que montre la zone haute : la silhouette, puis l'Echo de depart.
function visuelAffiche(m) {
  var z = zone(m, "intro-visuel");
  return z ? z.textContent : "";
}

function tap(m, cible) {
  var c = couche(m);
  if (c) c.declencher("click", { target: cible || null, stopPropagation: function () {} });
}

function texteAffiche(m) {
  var z = partie(m, "intro-texte");
  return z ? z.textContent : "";
}

// Deroule la cinematique entiere. Renvoie la suite des repliques vues.
function jouerIntro(m, reponses, options) {
  options = options || {};
  var nbTaps = options.taps || 1;
  var vues = [], fini = false, tours = 0;
  var dernierTexte = "";      // la derniere replique lue, pour ne pas la compter deux fois

  m.ctx.Intro.demarrer(function () { fini = true; });

  while (!fini && tours++ < 400) {
    // Assez long pour que pause, fondu et frappe se terminent :
    // sinon on mesurerait une replique a moitie ecrite.
    m.horloge.avancer(options.pas || 20000);

    var choix = partie(m, "intro-choix");
    var saisie = partie(m, "intro-saisie");

    if (choix && choix.classList.contains("visible") && choix.enfants.length) {
      var voulu = reponses.choix.shift();
      var bouton = null;
      choix.enfants.forEach(function (b) { if (b.textContent === voulu) bouton = b; });
      if (!bouton) throw new Error("option introuvable : " + voulu);

      vues.push("[choix] " + voulu);
      for (var i = 0; i < nbTaps; i++) {
        bouton.declencher("click", { target: bouton, stopPropagation: function () {} });
      }
      continue;
    }

    if (saisie && saisie.classList.contains("visible")) {
      var champ = saisie.enfants[0];
      if (options.avantSaisie) options.avantSaisie(m, champ);
      champ.value = reponses.nom;
      vues.push("[saisie] " + reponses.nom);
      for (var j = 0; j < nbTaps; j++) tap(m);
      continue;
    }

    // La zone haute change une fois : quand l'Echo remplace Ico.
    var visuel = visuelAffiche(m);
    if (visuel && vues.indexOf("[visuel] " + visuel) === -1) vues.push("[visuel] " + visuel);

    var vue = texteAffiche(m);
    if (vue && vue !== dernierTexte) { vues.push(vue); dernierTexte = vue; }
    for (var k = 0; k < nbTaps; k++) tap(m);
  }

  if (!fini) throw new Error("l'intro ne s'est jamais terminee");
  return vues;
}


/* ------------------------------------------------------------
   LES SCENARIOS
   ------------------------------------------------------------ */

function lancerParcours() {
  var resultats = [];
  var section = "";

  function bloc(t) { section = t; }
  function verifie(quoi, ok, detail) {
    resultats.push({ section: section, quoi: quoi, ok: !!ok, detail: ok ? null : detail });
  }


  /* --- A. Premier lancement, sans GPS --- */

  bloc("Premier lancement, sans GPS");

  var m = creerMonde();
  m.ctx.chargerJoueur();
  verifie("l'intro se joue au premier lancement", m.ctx.profil.introVue === false);
  verifie("l'Echo de depart est deja attribue", !!m.ctx.collection.jinchan);

  var vues = jouerIntro(m, {
    nom: "Ethan",
    choix: ["Elle est venue.", "J'écris tout ce que j'en sais.",
            "Je le recopie avant qu'il ne s'abîme.", "Je vais voir d'où il venait."]
  });

  verifie("le bloc de repli est joue quand le lieu est inconnu",
          vues.indexOf("Puis tu as cherché le nom du lieu.") !== -1 &&
          vues.indexOf("Il n'est pas venu.") !== -1);
  verifie("la ligne du lieu reel n'apparait pas",
          vues.indexOf("Puis le nom du lieu t'est revenu.") === -1);
  verifie("scene 1 : accord au masculin (le genre n'est pas encore connu)",
          vues.indexOf("Tu n'étais pas réveillé non plus.") !== -1 &&
          vues.indexOf("Tu le connaissais. Tu es sûr de l'avoir connu.") !== -1,
          vues.filter(function (l) { return /réveill|sûr/.test(l); }).join(" | "));
  verifie("scenes 5 et 6 : accord au feminin, une fois le genre connu",
          vues.indexOf("Tu n'iras pas seule.") !== -1 &&
          vues.indexOf("Tu es une archiviste. Ça se voyait déjà, mais maintenant c'est dit.") !== -1,
          vues.filter(function (l) { return /seul|Tu es une/.test(l); }).join(" | "));
  verifie("la voie sort a la majorite (2 archiviste sur 3)",
          m.ctx.profil.voie === "archiviste", m.ctx.profil.voie);
  verifie("le nom est repris dans la derniere replique",
          vues[vues.length - 1] === "Et Ethan — ce que tu n'assimiles pas, personne ne le fera après toi.",
          vues[vues.length - 1]);
  verifie("le profil est enregistre",
          m.ctx.profil.nom === "Ethan" && m.ctx.profil.genre === "f" && m.ctx.profil.introVue === true,
          JSON.stringify(m.ctx.profil));
  verifie("lieuZero reste null sans GPS", m.ctx.profil.lieuZero === null);
  verifie("la sauvegarde v3 contient le bloc joueur",
          !!m.stockage.echos_joueur_v3 &&
          JSON.parse(m.stockage.echos_joueur_v3).joueur.introVue === true);
  verifie("l'ancienne cle v2 n'est jamais reecrite", m.stockage.echos_joueur_v2 === undefined);
  verifie("l'overlay est retire de la page a la fin",
          m.corps.enfants.filter(function (e) { return e.id === "intro"; }).length === 0);
  verifie("le corps de page n'est plus verrouille",
          m.corps.classList.contains("intro-ouverte") === false);


  /* --- B. Premier lancement, avec GPS --- */

  bloc("Premier lancement, avec GPS");

  var m2 = creerMonde();
  m2.ctx.chargerJoueur();
  m2.ctx.dernierePosition = [25.033, 121.565];
  m2.ctx.donjons = {
    "node/1": { id: "node/1", lieu: "Longshan Temple", nom: "Porte du Temple de Longshan",
                lat: 25.0335, lon: 121.5655, categorie: "temple" },
    "node/2": { id: "node/2", lieu: "Daan Forest Park", nom: "Clairiere du parc Daan Forest",
                lat: 25.05, lon: 121.60, categorie: "parc" }
  };

  var vues2 = jouerIntro(m2, {
    nom: "  Léo  ",
    choix: ["Quelqu'un est venu.", "Je préviens les gens.",
            "Je le mets à l'abri.", "Je reste jusqu'à la fin."]
  });

  verifie("le nom du lieu reel est affiche",
          vues2.some(function (l) { return l.indexOf("Longshan Temple") !== -1; }),
          vues2.join(" | ").slice(0, 120));
  verifie("c'est le lieu nomme le plus proche qui est retenu",
          m2.ctx.profil.lieuZero && m2.ctx.profil.lieuZero.nom === "Longshan Temple",
          JSON.stringify(m2.ctx.profil.lieuZero));
  verifie("lieuZero garde ses coordonnees",
          m2.ctx.profil.lieuZero.lat === 25.0335 && m2.ctx.profil.lieuZero.lon === 121.5655);
  verifie("le bloc de repli n'est pas joue", vues2.indexOf("Il n'est pas venu.") === -1);
  verifie("le pseudo est nettoye de ses espaces", m2.ctx.profil.nom === "Léo", m2.ctx.profil.nom);
  verifie("accord au neutre", vues2.indexOf("Tu n'iras pas seul·e.") !== -1,
          vues2.filter(function (l) { return /seul/.test(l); }).join(" | "));
  verifie("egalite parfaite : la troisieme reponse tranche",
          m2.ctx.profil.voie === "gardien", m2.ctx.profil.voie);
  verifie("l'Echo de depart est bien celui du jeu",
          vues2.some(function (l) { return l.indexOf("Jin Chan") !== -1; }),
          vues2.filter(function (l) { return /Chan|Crapaud/.test(l); }).join(" | "));
  verifie("l'Echo de depart s'affiche dans la zone haute, pas dans le texte",
          vues2.some(function (l) { return l.indexOf("[visuel] ") === 0 && l.indexOf("Jin Chan") !== -1; }) &&
          !vues2.some(function (l) { return l.indexOf("[visuel] ") !== 0 && l.indexOf("Jin Chan") !== -1; }),
          vues2.filter(function (l) { return /Chan|Crapaud/.test(l); }).join(" | "));


  /* --- C. Taps rapides et saisie refusee --- */

  bloc("Taps rapides et saisie");

  function reponsesC() {
    return { nom: "Ico", choix: ["Il est venu.", "J'y retourne une dernière fois.",
                                 "Je pars le chercher.", "Je reste jusqu'à la fin."] };
  }

  var saisieRefusee = false;
  var mTemoin = creerMonde();
  mTemoin.ctx.chargerJoueur();
  var vuesTemoin = jouerIntro(mTemoin, reponsesC(), {
    taps: 1,
    avantSaisie: function (mm, champ) {
      champ.value = "";                       // vide
      tap(mm);
      champ.value = "     ";                  // que des espaces
      tap(mm);
      var saisie = partie(mm, "intro-saisie");
      saisieRefusee = saisie.classList.contains("visible") === true;
    }
  });

  verifie("une saisie vide ou blanche ne passe pas l'etape, sans message", saisieRefusee);

  var mRafale = creerMonde();
  mRafale.ctx.chargerJoueur();
  var vuesRafale = jouerIntro(mRafale, reponsesC(), { taps: 3 });

  verifie("trois taps par etape : exactement les memes repliques",
          JSON.stringify(vuesRafale) === JSON.stringify(vuesTemoin),
          vuesRafale.length + " repliques contre " + vuesTemoin.length);
  verifie("trois taps par etape : le meme profil enregistre",
          JSON.stringify(mRafale.ctx.profil) === JSON.stringify(mTemoin.ctx.profil),
          JSON.stringify(mRafale.ctx.profil));
  verifie("aucune replique dupliquee",
          vuesRafale.length === Object.keys(vuesRafale.reduce(function (a, l) {
            a[l] = 1; return a;
          }, {})).length);


  /* --- D. Migration d'une sauvegarde --- */

  bloc("Migration de la sauvegarde");

  var ancienne = {
    collection: {
      komainu: { espece: "komainu", niveau: 7, xp: 12, pv: 40 },
      baku:    { espece: "baku", niveau: 3, xp: 0, pv: 35 },
      fantome: { espece: "especeQuiNexistePlus", niveau: 4, xp: 0, pv: 10 }
    },
    equipe: ["komainu", "baku", "fantome", "komainu"]
  };

  var m5 = creerMonde({ stockage: { echos_joueur_v2: JSON.stringify(ancienne) } });
  var erreur = null;
  try { m5.ctx.chargerJoueur(); } catch (e) { erreur = e; }

  verifie("une sauvegarde v2 se lit sans erreur", erreur === null, erreur && erreur.message);
  verifie("la collection est conservee",
          !!m5.ctx.collection.komainu && m5.ctx.collection.komainu.niveau === 7 && !!m5.ctx.collection.baku,
          JSON.stringify(Object.keys(m5.ctx.collection)));
  verifie("l'experience est conservee", m5.ctx.collection.komainu.xp === 12);
  verifie("une espece disparue est ecartee sans crash", !m5.ctx.collection.fantome);
  verifie("l'equipe est conservee et nettoyee",
          JSON.stringify(m5.ctx.equipe) === JSON.stringify(["komainu", "baku"]),
          JSON.stringify(m5.ctx.equipe));
  verifie("sans bloc joueur, l'intro se jouera", m5.ctx.profil.introVue === false);
  verifie("le bandeau d'equipe s'affiche apres migration",
          m5.statiques.fiche.textContent.indexOf("Komainu") !== -1,
          m5.statiques.fiche.textContent);

  [["chaine vide", ""],
   ["JSON casse", "{oups"],
   ["un tableau au lieu d'un objet", "[1,2,3]"],
   ["tous les champs absents", "{}"],
   ["champs a null", '{"collection":null,"equipe":null,"joueur":null}'],
   ["types absurdes", '{"collection":{"komainu":{"niveau":"sept","pv":-9}},"equipe":"komainu","joueur":42}'],
   ["profil incomplet", '{"collection":{},"equipe":[],"joueur":{"genre":"z","voie":"pirate","lieuZero":"ici"}}']
  ].forEach(function (cas) {
    var mx = creerMonde({ stockage: { echos_joueur_v3: cas[1] } });
    var err = null;
    try { mx.ctx.chargerJoueur(); } catch (e) { err = e; }
    verifie("sauvegarde abimee (" + cas[0] + ") : aucun crash", err === null, err && err.message);
  });


  /* --- E. Second lancement --- */

  bloc("Second lancement");

  var m6 = creerMonde({ stockage: { echos_joueur_v3: m.stockage.echos_joueur_v3 } });
  m6.ctx.chargerJoueur();

  verifie("introVue est relue a vrai : pas de seconde intro", m6.ctx.profil.introVue === true);
  verifie("le nom, le genre et la voie sont relus",
          m6.ctx.profil.nom === "Ethan" && m6.ctx.profil.genre === "f" &&
          m6.ctx.profil.voie === "archiviste",
          JSON.stringify(m6.ctx.profil));
  verifie("l'equipe survit au tour complet", m6.ctx.equipe.length > 0,
          JSON.stringify(m6.ctx.equipe));

  m6.ctx.Intro.reinitialiser();
  verifie("reinitialiser remet introVue a faux", m6.ctx.profil.introVue === false);
  verifie("reinitialiser recharge la page", m6.ctx.pageRechargee === true);
  verifie("reinitialiser conserve la collection", !!m6.ctx.collection.jinchan);

  return resultats;
}

module.exports = { lancerParcours: lancerParcours };
