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
var FICHIERS = ["js/config.js", "js/langues.js", "js/especes.js", "js/lieux.js", "js/carte.js",
                "js/joueur.js", "js/fragments.js", "js/poche.js", "js/combat.js", "js/combat3.js", "js/grimoire.js", "js/intro.js",
                "js/rendu3d.js", "js/modetest.js", "js/ecran3.js"];


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
  // Le premier enfant, comme dans un vrai navigateur (pour vider un noeud).
  Object.defineProperty(el, "firstChild", {
    get: function () { return el.enfants.length ? el.enfants[0] : null; }
  });
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
      querySelectorAll: function () { return []; },
      addEventListener: function () {}
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

  var lancer = options.court ? m.ctx.Intro.demarrerCourt : m.ctx.Intro.demarrer;
  lancer(function () { fini = true; });

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
    choix: ["Français", "Elle est venue.", "J'écris tout ce que j'en sais.",
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
  verifie("la sauvegarde v5 contient le bloc joueur",
          !!m.stockage.echos_joueur_v5 &&
          JSON.parse(m.stockage.echos_joueur_v5).joueur.introVue === true);
  verifie("la sauvegarde v5 contient le bloc ico",
          !!m.stockage.echos_joueur_v5 &&
          JSON.stringify(JSON.parse(m.stockage.echos_joueur_v5).ico) ===
          '{"didacticiensVus":[],"palierLu":0,"palierAtteint":0}',
          m.stockage.echos_joueur_v5 &&
          JSON.stringify(JSON.parse(m.stockage.echos_joueur_v5).ico));
  verifie("la sauvegarde v5 contient la gourde et le savoir",
          !!m.stockage.echos_joueur_v5 &&
          JSON.stringify(JSON.parse(m.stockage.echos_joueur_v5).gourde) === "{}" &&
          JSON.stringify(JSON.parse(m.stockage.echos_joueur_v5).savoir) ===
          '{"combats":0,"jours":[],"lieux":[]}',
          m.stockage.echos_joueur_v5);
  verifie("l'Echo de depart nait au premier palier de conscience",
          m.ctx.collection.jinchan.conscience === 1 &&
          JSON.stringify(m.ctx.collection.jinchan.fragments) ===
          '{"mince":0,"grand":0,"complet":0}',
          JSON.stringify(m.ctx.collection.jinchan));
  verifie("les anciennes cles ne sont jamais reecrites",
          m.stockage.echos_joueur_v4 === undefined &&
          m.stockage.echos_joueur_v3 === undefined &&
          m.stockage.echos_joueur_v2 === undefined);
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
    choix: ["Français", "Quelqu'un est venu.", "Je préviens les gens.",
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
    return { nom: "Ico", choix: ["Français", "Il est venu.", "J'y retourne une dernière fois.",
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

  /* Une v3 : elle a un bloc joueur, mais aucun bloc ico. Le bloc
     doit etre cree avec ses valeurs par defaut, sans rien perdre
     du reste. C'est la migration ajoutee avec l'ecran d'Ico. */
  var v3 = {
    version: 3,
    collection: { peng: { espece: "peng", niveau: 5, xp: 8, pv: 40 } },
    equipe: ["peng"],
    joueur: { nom: "Ethan", genre: "n", voie: "gardien", lieuZero: null, introVue: true }
  };

  var m7 = creerMonde({ stockage: { echos_joueur_v3: JSON.stringify(v3) } });
  var erreurV3 = null;
  try { m7.ctx.chargerJoueur(); } catch (e) { erreurV3 = e; }

  verifie("une sauvegarde v3 se lit sans erreur", erreurV3 === null, erreurV3 && erreurV3.message);
  verifie("v3 : le bloc ico est cree par defaut",
          JSON.stringify(m7.ctx.suiviIco) === '{"didacticiensVus":[],"palierLu":0,"palierAtteint":0}',
          JSON.stringify(m7.ctx.suiviIco));
  verifie("v3 : le profil est conserve",
          m7.ctx.profil.nom === "Ethan" && m7.ctx.profil.introVue === true,
          JSON.stringify(m7.ctx.profil));
  verifie("v3 : la collection est conservee", m7.ctx.collection.peng.xp === 8);

  /* Une v4 : elle a tout ce que la v3 avait, plus le bloc ico,
     mais ni gourde, ni savoir, et ses Echos n'ont ni conscience ni
     fragments. C'est la sauvegarde que les vrais joueurs ont sur
     leur telephone aujourd'hui : ce scenario decrit exactement ce
     qui leur arrivera au prochain lancement. */
  var v4 = {
    version: 4,
    collection: { komainu: { espece: "komainu", niveau: 22, xp: 40, pv: 90 } },
    equipe: ["komainu"],
    joueur: { nom: "Ethan", genre: "f", voie: "arpenteur", lieuZero: null, introVue: true },
    ico: { didacticiensVus: ["combat"], palierLu: 2, palierAtteint: 3 }
  };

  var m8 = creerMonde({ stockage: { echos_joueur_v4: JSON.stringify(v4) } });
  var erreurV4 = null;
  try { m8.ctx.chargerJoueur(); } catch (e) { erreurV4 = e; }

  verifie("une sauvegarde v4 se lit sans erreur", erreurV4 === null, erreurV4 && erreurV4.message);
  verifie("v4 : rien n'est perdu de la collection",
          m8.ctx.collection.komainu.niveau === 22 && m8.ctx.collection.komainu.xp === 40,
          JSON.stringify(m8.ctx.collection.komainu));
  verifie("v4 : le profil et le bloc ico sont conserves",
          m8.ctx.profil.nom === "Ethan" && m8.ctx.suiviIco.palierAtteint === 3,
          JSON.stringify(m8.ctx.profil) + " " + JSON.stringify(m8.ctx.suiviIco));
  verifie("v4 : l'equipe est conservee",
          JSON.stringify(m8.ctx.equipe) === '["komainu"]', JSON.stringify(m8.ctx.equipe));

  /* Le coeur de la migration. Un Echo de niveau 22 redemarre au
     premier palier de conscience, les mains vides : rien dans une
     v4 ne dit ce que le joueur avait compris de sa creature, et
     inventer une conscience retroactive serait pire que de la
     laisser a 1. */
  verifie("v4 : chaque Echo demarre au premier palier, sans fragment",
          m8.ctx.collection.komainu.conscience === 1 &&
          m8.ctx.collection.komainu.fragments.mince === 0 &&
          m8.ctx.collection.komainu.fragments.grand === 0 &&
          m8.ctx.collection.komainu.fragments.complet === 0,
          JSON.stringify(m8.ctx.collection.komainu));
  verifie("v4 : la gourde et le savoir sont crees vides",
          JSON.stringify(m8.ctx.gourde) === "{}" &&
          JSON.stringify(m8.ctx.savoir) === '{"combats":0,"jours":[],"lieux":[]}',
          JSON.stringify(m8.ctx.gourde) + " " + JSON.stringify(m8.ctx.savoir));

  /* Et surtout : la v4 reste sur le disque. Tant que le joueur ne
     sauvegarde pas, rien n'est ecrit ; et quand il sauvegarde,
     c'est sous la cle v5. La partie d'hier repond encore. */
  verifie("v4 : la sauvegarde d'origine n'est pas touchee",
          m8.stockage.echos_joueur_v4 === JSON.stringify(v4),
          m8.stockage.echos_joueur_v4);

  m8.ctx.sauverJoueur();
  verifie("v4 : la sauvegarde suivante s'ecrit en v5, a cote",
          !!m8.stockage.echos_joueur_v5 &&
          JSON.parse(m8.stockage.echos_joueur_v5).version === 5 &&
          m8.stockage.echos_joueur_v4 === JSON.stringify(v4),
          m8.stockage.echos_joueur_v5);
  verifie("v4 : la conscience survit a un aller-retour sur le disque",
          JSON.parse(m8.stockage.echos_joueur_v5).collection.komainu.conscience === 1 &&
          !!JSON.parse(m8.stockage.echos_joueur_v5).collection.komainu.fragments,
          m8.stockage.echos_joueur_v5);


  // Un bloc ico abime ne doit pas plus bloquer qu'une collection abimee.
  [["palier negatif", -3, "sept"],
   ["palier absurde", 900, 900],
   ["paliers absents", undefined, undefined]
  ].forEach(function (cas) {
    var abime = {
      version: 5, collection: {}, equipe: [], joueur: {},
      ico: { didacticiensVus: ["combat", 42, "combat", null], palierLu: cas[1], palierAtteint: cas[2] }
    };
    var mi = creerMonde({ stockage: { echos_joueur_v5: JSON.stringify(abime) } });
    var err = null;
    try { mi.ctx.chargerJoueur(); } catch (e) { err = e; }

    var i = mi.ctx.suiviIco;
    var sain = err === null &&
               JSON.stringify(i.didacticiensVus) === '["combat"]' &&
               i.palierLu >= 0 && i.palierLu <= 5 &&
               i.palierAtteint >= 0 && i.palierAtteint <= 5;
    verifie("bloc ico abime (" + cas[0] + ") : remis d'aplomb", sain,
            err ? err.message : JSON.stringify(i));
  });

  [["chaine vide", ""],
   ["JSON casse", "{oups"],
   ["un tableau au lieu d'un objet", "[1,2,3]"],
   ["tous les champs absents", "{}"],
   ["champs a null", '{"collection":null,"equipe":null,"joueur":null}'],
   ["types absurdes", '{"collection":{"komainu":{"niveau":"sept","pv":-9}},"equipe":"komainu","joueur":42}'],
   ["profil incomplet", '{"collection":{},"equipe":[],"joueur":{"genre":"z","voie":"pirate","lieuZero":"ici"}}']
  ].forEach(function (cas) {
    var mx = creerMonde({ stockage: { echos_joueur_v5: cas[1] } });
    var err = null;
    try { mx.ctx.chargerJoueur(); } catch (e) { err = e; }
    verifie("sauvegarde abimee (" + cas[0] + ") : aucun crash", err === null, err && err.message);
  });


  /* --- E. Second lancement --- */

  bloc("Second lancement");

  var m6 = creerMonde({ stockage: { echos_joueur_v5: m.stockage.echos_joueur_v5 } });
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


  /* --- F. Le flux court (INTRO_ACTIVE a false) ---
     Ce que voit un nouveau joueur tant que la cinematique est
     coupee : la langue, le nom, le genre, puis la carte. Il doit
     laisser derriere lui exactement la meme sauvegarde que l'intro
     entiere, aux deux champs pres qu'il ne demande pas. */

  bloc("Flux court, sans cinematique");

  verifie("INTRO_ACTIVE existe dans config.js", typeof m.ctx.INTRO_ACTIVE === "boolean",
          typeof m.ctx.INTRO_ACTIVE);

  var mc = creerMonde();
  mc.ctx.chargerJoueur();
  verifie("un nouveau joueur n'a pas encore vu l'intro", mc.ctx.profil.introVue === false);

  var vuesCourt = jouerIntro(mc, { nom: "Ethan", choix: ["Français", "Elle est venue."] },
                             { court: true });

  verifie("le flux court va droit a la langue, au nom et au genre",
          JSON.stringify(vuesCourt) === JSON.stringify([
            "[choix] Français",
            "Alors autant que je sache à qui je parle.",
            "[saisie] Ethan",
            "Il faudra bien que je le note quelque part.",
            "[choix] Elle est venue."
          ]),
          JSON.stringify(vuesCourt));
  verifie("le nom et le genre sont enregistres, introVue est vrai",
          mc.ctx.profil.nom === "Ethan" && mc.ctx.profil.genre === "f" &&
          mc.ctx.profil.introVue === true,
          JSON.stringify(mc.ctx.profil));
  verifie("voie vide et lieuZero null, comme une intro sans reponse",
          mc.ctx.profil.voie === "" && mc.ctx.profil.lieuZero === null,
          JSON.stringify(mc.ctx.profil));
  verifie("les accords suivent le genre choisi",
          mc.ctx.Intro.formater("Tu n'iras pas seul[|e|·e], {nom}.", mc.ctx.profil) ===
          "Tu n'iras pas seule, Ethan.");

  var sauveCourt = mc.stockage.echos_joueur_v5 ? JSON.parse(mc.stockage.echos_joueur_v5) : null;
  verifie("la sauvegarde v5 a les memes cles qu'apres l'intro entiere",
          !!sauveCourt &&
          JSON.stringify(Object.keys(sauveCourt)) ===
          JSON.stringify(Object.keys(JSON.parse(m.stockage.echos_joueur_v5))) &&
          JSON.stringify(Object.keys(sauveCourt.joueur)) ===
          '["nom","genre","voie","lieuZero","introVue"]',
          sauveCourt && JSON.stringify(sauveCourt.joueur));
  verifie("Jin Chan est la, comme apres l'intro", !!mc.ctx.collection.jinchan);
  verifie("l'overlay est retire a la fin",
          mc.corps.enfants.filter(function (e) { return e.id === "intro"; }).length === 0 &&
          mc.corps.classList.contains("intro-ouverte") === false);

  var mcRelu = creerMonde({ stockage: { echos_joueur_v5: mc.stockage.echos_joueur_v5 } });
  mcRelu.ctx.chargerJoueur();
  verifie("au lancement suivant, ni intro ni flux court",
          mcRelu.ctx.profil.introVue === true && mcRelu.ctx.profil.nom === "Ethan");

  // Deux evenements par contact du doigt : le verrou doit tenir.
  var mcDouble = creerMonde();
  mcDouble.ctx.chargerJoueur();
  jouerIntro(mcDouble, { nom: "Ethan", choix: ["Français", "Quelqu'un est venu."] },
             { court: true, taps: 2 });
  verifie("flux court : un double tap ne saute aucune question",
          mcDouble.ctx.profil.nom === "Ethan" && mcDouble.ctx.profil.genre === "n",
          JSON.stringify(mcDouble.ctx.profil));

  // Une sauvegarde existante (celle de l'intro entiere, plus haut)
  // ne doit pas bouger d'un octet au chargement.
  var existante = m.stockage.echos_joueur_v5;
  var mExist = creerMonde({ stockage: { echos_joueur_v5: existante } });
  mExist.ctx.chargerJoueur();
  verifie("une sauvegarde existante est relue sans etre reecrite",
          mExist.stockage.echos_joueur_v5 === existante);
  verifie("une sauvegarde existante garde sa voie et ne relance rien",
          mExist.ctx.profil.introVue === true && mExist.ctx.profil.voie === "archiviste",
          JSON.stringify(mExist.ctx.profil));


  /* --- G. Les poches d'Oubli ---
     Le modele seul : on fabrique une poche et on compte ce qu'on
     y depose. Rien n'est encore enregistre ni affiche. */

  bloc("Poches d'Oubli");

  var mp = creerMonde();
  var t0 = 1700000000000;
  var lieuP = { lat: 48.8566, lon: 2.3522, arene_id: "way/123" };

  var leger = mp.ctx.creerPoche("leger", lieuP, t0);
  verifie("une poche legere est creee ouverte, vide, au bon seuil",
          !!leger && leger.statut === "ouvert" && leger.niveau === "leger" &&
          leger.fragments_deposes.length === 0 && leger.seuil_total === 12,
          JSON.stringify(leger));
  verifie("elle expire 150 minutes apres sa creation",
          !!leger && leger.timestamp_creation === t0 &&
          leger.timestamp_expiration === t0 + 150 * 60000);
  verifie("elle garde son lieu et l'arene liee",
          !!leger && leger.lieu.lat === 48.8566 && leger.lieu.lon === 2.3522 &&
          leger.lieu.arene_id === "way/123",
          leger && JSON.stringify(leger.lieu));

  var profond = mp.ctx.creerPoche("profond", { lat: 1, lon: 2 }, t0);
  var critique = mp.ctx.creerPoche("critique", { lat: 1, lon: 2 }, t0);
  verifie("profond : seuil 30, 60 minutes, sans arene",
          !!profond && profond.seuil_total === 30 &&
          profond.timestamp_expiration === t0 + 60 * 60000 && profond.lieu.arene_id === null);
  verifie("critique : seuil 60, expire au bout de ses 15 minutes de formation",
          !!critique && critique.seuil_total === 60 &&
          critique.timestamp_expiration === t0 + 15 * 60000);
  verifie("un niveau inconnu ou un lieu sans coordonnees ne fabrique rien",
          mp.ctx.creerPoche("abyssal", lieuP, t0) === null &&
          mp.ctx.creerPoche("toString", lieuP, t0) === null &&
          mp.ctx.creerPoche("leger", { lat: "ici" }, t0) === null);
  verifie("le complet n'est pas deposable",
          mp.ctx.FRAGMENTS_DEPOSABLES.indexOf("complet") === -1 &&
          mp.ctx.FRAGMENT_VALEURS.complet === 10);

  leger.fragments_deposes.push(
    { joueur_id: "j1", espece: "peng",    valeur: mp.ctx.FRAGMENT_VALEURS.mince, type: "mince", timestamp: t0 + 1 },
    { joueur_id: "j1", espece: "komainu", valeur: mp.ctx.FRAGMENT_VALEURS.grand, type: "grand", timestamp: t0 + 2 },
    { joueur_id: "j2", espece: "peng",    valeur: mp.ctx.FRAGMENT_VALEURS.grand, type: "grand", timestamp: t0 + 3 },
    { joueur_id: "j2", espece: "peng",    valeur: "trois", type: "grand", timestamp: t0 + 4 },
    null
  );
  verifie("la somme additionne les depots et ignore les entrees abimees",
          mp.ctx.calculerSommeFragments(leger) === 7,
          mp.ctx.calculerSommeFragments(leger));
  verifie("une poche vide ou absente vaut zero",
          mp.ctx.calculerSommeFragments(profond) === 0 &&
          mp.ctx.calculerSommeFragments(null) === 0);
  verifie("creer une poche n'ecrit rien dans la sauvegarde",
          Object.keys(mp.stockage).length === 0, JSON.stringify(Object.keys(mp.stockage)));


  /* --- H. Expiration et gate break ---
     Tout est fonction de "maintenant", passe en parametre : on
     se place a l'instant voulu, a la milliseconde pres. */

  bloc("Expiration et gate break");

  var ctxP = mp.ctx;
  var MIN = 60000;
  var origine = { lat: 48.8566, lon: 2.3522 };

  // Un depot de "points" points, pour remplir une poche a la main
  function deposer(poche, points) {
    for (var n = 0; n < points; n++) {
      poche.fragments_deposes.push({ joueur_id: "j1", espece: "peng", valeur: 1,
                                     type: "mince", timestamp: t0 + n });
    }
    return poche;
  }

  var pe = ctxP.creerPoche("leger", origine, t0);
  var echeance = pe.timestamp_expiration;
  verifie("1 ms avant l'echeance, la poche est encore ouverte",
          ctxP.verifierExpirationPoche(pe, echeance - 1) === "ouvert");
  verifie("a l'instant exact de l'echeance, elle expire",
          ctxP.verifierExpirationPoche(pe, echeance) === "expire");
  verifie("verifier ne modifie pas la poche",
          pe.statut === "ouvert" && pe.fragments_deposes.length === 0, pe.statut);

  var pr = deposer(ctxP.creerPoche("leger", origine, t0), 12);
  verifie("remplie avant l'echeance : rempli",
          ctxP.verifierExpirationPoche(pr, echeance - 1) === "rempli");
  verifie("remplie mais controlee apres l'echeance : toujours rempli",
          ctxP.verifierExpirationPoche(pr, echeance + 10 * MIN) === "rempli");
  verifie("un point de moins que le seuil, a l'echeance : expire",
          ctxP.verifierExpirationPoche(deposer(ctxP.creerPoche("leger", origine, t0), 11), echeance) === "expire");

  var finale = deposer(ctxP.creerPoche("leger", origine, t0), 12);
  finale.statut = "expire";
  var finaleRemplie = ctxP.creerPoche("leger", origine, t0);
  finaleRemplie.statut = "rempli";
  verifie("un statut final ne change plus",
          ctxP.verifierExpirationPoche(finale, t0) === "expire" &&
          ctxP.verifierExpirationPoche(finaleRemplie, echeance + 999 * MIN) === "rempli");

  var pc = deposer(ctxP.creerPoche("critique", origine, t0), 59);
  verifie("critique a 59 sur 60 : encore ouverte",
          ctxP.verifierExpirationPoche(pc, t0 + 1) === "ouvert");
  deposer(pc, 1);
  verifie("critique au seuil : fermee, pas remplie",
          ctxP.verifierExpirationPoche(pc, t0 + 1) === "ferme");

  // Arenes a ~222 m (dans le rayon leger), ~445 m (hors leger,
  // dans profond) et ~945 m (dans critique seulement) au nord.
  var areneProche  = { id: "way/1", lat: origine.lat + 0.002,  lon: origine.lon };
  var areneMoyenne = { id: "way/2", lat: origine.lat + 0.004,  lon: origine.lon };
  var areneLoin    = { id: "way/3", lat: origine.lat + 0.0085, lon: origine.lon };
  var finLeger = echeance + 60 * MIN;

  verifie("malus actif : arene dans le rayon d'une poche legere cassee",
          ctxP.malusGateBreak(areneProche, [pe], echeance) === 1 &&
          ctxP.malusGateBreak(areneProche, [pe], finLeger - 1) === 1);
  verifie("malus eteint a la fin exacte de la duree",
          ctxP.malusGateBreak(areneProche, [pe], finLeger) === 0);
  verifie("aucun malus avant l'echeance",
          ctxP.malusGateBreak(areneProche, [pe], echeance - 1) === 0);
  verifie("aucun malus hors rayon",
          ctxP.malusGateBreak(areneMoyenne, [pe], echeance) === 0);
  verifie("une poche remplie ne casse pas",
          ctxP.malusGateBreak(areneProche, [pr], echeance + 1) === 0);

  var pcCassee = ctxP.creerPoche("critique", origine, t0);
  var ppCassee = ctxP.creerPoche("profond", origine, t0);
  var tard = t0 + 150 * MIN;   // les trois sont expirees et encore actives
  verifie("chevauchement : la plus forte compte, pas la somme",
          ctxP.malusGateBreak(areneProche, [pe, ppCassee, pcCassee], tard) === 5,
          ctxP.malusGateBreak(areneProche, [pe, ppCassee, pcCassee], tard));
  verifie("chevauchement : chaque poche garde son propre rayon",
          ctxP.malusGateBreak(areneMoyenne, [pe, ppCassee], tard) === 3 &&
          ctxP.malusGateBreak(areneLoin, [pe, ppCassee, pcCassee], tard) === 5 &&
          ctxP.malusGateBreak(areneLoin, [pe, ppCassee], tard) === 0);
  verifie("arene, liste ou poche abimee : malus nul, aucun crash",
          ctxP.malusGateBreak(null, [pe], echeance) === 0 &&
          ctxP.malusGateBreak({ lat: "?" }, [pe], echeance) === 0 &&
          ctxP.malusGateBreak(areneProche, null, echeance) === 0 &&
          ctxP.malusGateBreak(areneProche, [null, { niveau: "abyssal", lieu: origine }], echeance) === 0);
  verifie("le malus ne modifie aucune poche",
          pe.statut === "ouvert" && pcCassee.statut === "ouvert");


  /* --- I. Le depot de fragments ---
     La gourde est passee en parametre : on en fabrique une a la
     main, sans toucher a celle du jeu ni a la sauvegarde. */

  bloc("Depot de fragments");

  // L'etat complet de la poche et de la gourde, pour prouver
  // qu'un refus n'a rien touche.
  function photo(poche, gourde) { return JSON.stringify([poche, gourde]); }

  var pd = ctxP.creerPoche("leger", origine, t0);
  var gd = { peng: { mince: 2, grand: 1, complet: 1 } };

  var r1 = ctxP.deposerFragment(pd, gd, "j1", "peng", "grand", t0 + 5);
  verifie("depot valide : accepte, gourde debitee d'un seul fragment",
          r1.ok === true && r1.raison === "" &&
          gd.peng.grand === 0 && gd.peng.mince === 2 && gd.peng.complet === 1,
          JSON.stringify(r1) + " " + JSON.stringify(gd));
  verifie("depot valide : enregistre dans la poche, somme mise a jour",
          pd.fragments_deposes.length === 1 && ctxP.calculerSommeFragments(pd) === 3 && r1.somme === 3 &&
          JSON.stringify(pd.fragments_deposes[0]) ===
          JSON.stringify({ joueur_id: "j1", espece: "peng", valeur: 3, type: "grand", timestamp: t0 + 5 }),
          JSON.stringify(pd.fragments_deposes));
  verifie("depot valide : la poche reste ouverte sous le seuil",
          r1.statut === "ouvert" && pd.statut === "ouvert" && r1.franchi === false);

  // Chaque refus : la bonne raison, et RIEN de touche.
  function refuse(quoi, poche, gourde, args, raison) {
    var avant = photo(poche, gourde);
    var r = ctxP.deposerFragment.apply(null, [poche, gourde].concat(args));
    verifie(quoi + " (" + raison + ") et rien n'est touche",
            r.ok === false && r.raison === raison && photo(poche, gourde) === avant,
            JSON.stringify(r) + (photo(poche, gourde) === avant ? "" : " -- poche ou gourde modifiee"));
  }

  refuse("le fragment complet est refuse", pd, gd, ["j1", "peng", "complet", t0 + 6], "fragment_complet");
  refuse("une taille inconnue est refusee", pd, gd, ["j1", "peng", "geant", t0 + 6], "taille_non_deposable");
  refuse("une espece inconnue est refusee", pd, gd, ["j1", "dragon", "mince", t0 + 6], "espece_inconnue");
  refuse("une gourde vide pour cette taille est refusee", pd, gd, ["j1", "peng", "grand", t0 + 6], "aucun_fragment");
  refuse("une espece absente de la gourde est refusee", pd, gd, ["j1", "baku", "mince", t0 + 6], "aucun_fragment");
  refuse("un joueur absent est refuse", pd, gd, ["", "peng", "mince", t0 + 6], "joueur_absent");
  refuse("une poche expiree est refusee", pd, gd,
         ["j1", "peng", "mince", pd.timestamp_expiration], "poche_expiree");
  refuse("l'expiration passe avant la taille", pd, gd,
         ["j1", "peng", "complet", pd.timestamp_expiration], "poche_expiree");

  // Franchir le seuil (12) : onze minces font 11, puis un grand
  // (+3) porte la poche a 14. Il est accepte en entier.
  var ps = ctxP.creerPoche("leger", origine, t0);
  var gs = { komainu: { mince: 20, grand: 5, complet: 0 } };
  for (var q = 0; q < 11; q++) ctxP.deposerFragment(ps, gs, "j1", "komainu", "mince", t0 + q);
  var rSeuil = ctxP.deposerFragment(ps, gs, "j1", "komainu", "grand", t0 + 20);
  verifie("le depot qui franchit le seuil est accepte en entier, sans rien rendre",
          rSeuil.ok === true && rSeuil.somme === 14 && rSeuil.franchi === true &&
          rSeuil.statut === "rempli" && ps.statut === "rempli" &&
          gs.komainu.grand === 4 && gs.komainu.mince === 9,
          JSON.stringify(rSeuil) + " " + JSON.stringify(gs));
  refuse("apres le seuil, plus aucun depot", ps, gs, ["j2", "komainu", "mince", t0 + 21], "poche_remplie");

  var pk = ctxP.creerPoche("critique", origine, t0);
  var gk = { peng: { mince: 0, grand: 25, complet: 0 } };
  var rk = null;
  for (var k2 = 0; k2 < 20; k2++) rk = ctxP.deposerFragment(pk, gk, "j1", "peng", "grand", t0 + k2);
  verifie("critique : fermee des que le seuil est atteint",
          rk.ok === true && rk.somme === 60 && rk.statut === "ferme" && pk.statut === "ferme" && rk.franchi === true,
          JSON.stringify(rk));
  refuse("critique fermee : depot suivant refuse", pk, gk, ["j2", "peng", "grand", t0 + 30], "poche_fermee");

  var pj = ctxP.creerPoche("profond", origine, t0);
  var gj1 = { peng: { mince: 3, grand: 1, complet: 0 }, komainu: { mince: 0, grand: 1, complet: 0 } };
  var gj2 = { peng: { mince: 0, grand: 2, complet: 0 } };
  ctxP.deposerFragment(pj, gj1, "j1", "peng", "mince", t0 + 1);
  ctxP.deposerFragment(pj, gj2, "j2", "peng", "grand", t0 + 2);
  ctxP.deposerFragment(pj, gj1, "j1", "peng", "grand", t0 + 3);
  ctxP.deposerFragment(pj, gj1, "j1", "komainu", "grand", t0 + 4);
  ctxP.deposerFragment(pj, gj2, "j2", "peng", "grand", t0 + 5);
  var avantContrib = photo(pj, null);
  var contrib = ctxP.contributionsParJoueur(pj);
  verifie("contributions de deux joueurs : points, fragments et detail par espece",
          JSON.stringify(contrib) === JSON.stringify({
            j1: { points: 7, fragments: 3, especes: { peng: { points: 4, fragments: 2 },
                                                       komainu: { points: 3, fragments: 1 } } },
            j2: { points: 6, fragments: 2, especes: { peng: { points: 6, fragments: 2 } } }
          }),
          JSON.stringify(contrib));
  verifie("contributions : la somme des joueurs egale celle de la poche",
          contrib.j1.points + contrib.j2.points === ctxP.calculerSommeFragments(pj));
  verifie("contributionsParJoueur ne touche pas la poche", photo(pj, null) === avantContrib);
  verifie("contributions d'une poche vide ou absente : objet vide",
          JSON.stringify(ctxP.contributionsParJoueur(ctxP.creerPoche("leger", origine, t0))) === "{}" &&
          JSON.stringify(ctxP.contributionsParJoueur(null)) === "{}");
  verifie("deposer n'ecrit rien dans la sauvegarde",
          Object.keys(mp.stockage).length === 0, JSON.stringify(Object.keys(mp.stockage)));


  /* --- J. La liste des poches et sa sauvegarde ---
     Une cle a part, echos_poches_v1. La sauvegarde du joueur ne
     doit jamais en souffrir : on la photographie avant, et on la
     compare apres. */

  bloc("Liste des poches et sauvegarde");

  // Une vraie sauvegarde de joueur, avec de quoi deposer : Peng
  // n'est pas assimile, ses fragments sont donc en gourde.
  var mj = creerMonde();
  mj.ctx.chargerJoueur();
  mj.ctx.gourde.peng = { mince: 2, grand: 1, complet: 0 };
  mj.ctx.sauverJoueur();
  var joueurS = mj.stockage.echos_joueur_v5;

  function mondeAvec(cles) {
    var st = { echos_joueur_v5: joueurS };
    for (var c in cles) st[c] = cles[c];
    var w = creerMonde({ stockage: st });
    w.ctx.chargerJoueur();
    return w;
  }

  var w0 = mondeAvec({});
  var err0 = null;
  try { w0.ctx.chargerPoches(); } catch (e) { err0 = e; }
  verifie("sauvegarde existante sans cle de poches : demarrage normal, liste vide",
          err0 === null && w0.ctx.poches.length === 0 && w0.ctx.profil.introVue === mj.ctx.profil.introVue &&
          !!w0.ctx.collection.jinchan,
          err0 && err0.message);
  verifie("charger sans donnees n'ecrit aucune cle de poches",
          !Object.prototype.hasOwnProperty.call(w0.stockage, "echos_poches_v1"));

  var corrompus = ["{pas du json", "null", "42", '"texte"', '{"poches":"texte"}', '{"version":1}', "[]"];
  var corrompuOk = corrompus.every(function (brut) {
    var w = mondeAvec({ echos_poches_v1: brut });
    try { w.ctx.chargerPoches(); } catch (e) { return false; }
    return w.ctx.poches.length === 0;
  });
  verifie("JSON corrompu ou format inattendu : liste vide, aucune exception", corrompuOk);

  var valide = ctxP.creerPoche("leger", origine, t0);
  var abimees = [
    valide,
    null, 42, "poche",
    { niveau: "leger", lieu: origine, timestamp_creation: t0, timestamp_expiration: t0 + 1 },          // sans id
    { id: "x1", niveau: "abyssal", lieu: origine, timestamp_creation: t0, timestamp_expiration: t0 + 1 },
    { id: "x2", niveau: "leger", lieu: { lat: "?" }, timestamp_creation: t0, timestamp_expiration: t0 + 1 },
    { id: "x3", niveau: "leger", lieu: origine, timestamp_creation: "hier", timestamp_expiration: t0 + 1 },
    { id: valide.id, niveau: "profond", lieu: origine, timestamp_creation: t0, timestamp_expiration: t0 + 9 },  // doublon
    { id: "rattrapee", niveau: "profond", lieu: origine, statut: "zarbi", seuil_total: -4, intrus: true,
      timestamp_creation: t0 + 1, timestamp_expiration: t0 + 2,
      fragments_deposes: [
        { joueur_id: "j1", espece: "peng", valeur: 3, type: "grand", timestamp: t0 },
        { joueur_id: "", espece: "peng", valeur: 3, type: "grand", timestamp: t0 },
        { joueur_id: "j1", espece: "peng", valeur: 3, type: "geant", timestamp: t0 },
        null
      ] }
  ];
  var wa = mondeAvec({ echos_poches_v1: JSON.stringify({ version: 1, poches: abimees }) });
  wa.ctx.chargerPoches();
  var rattrapee = wa.ctx.poches[1];
  verifie("poches abimees ecartees, doublon ecarte (le premier gagne)",
          wa.ctx.poches.length === 2 && wa.ctx.poches[0].id === valide.id &&
          wa.ctx.poches[0].niveau === "leger" && rattrapee && rattrapee.id === "rattrapee",
          JSON.stringify(wa.ctx.poches.map(function (p) { return p.id + ":" + p.niveau; })));
  verifie("poche rattrapee : statut, seuil et depots remis d'aplomb, champ intrus perdu",
          !!rattrapee && rattrapee.statut === "ouvert" && rattrapee.seuil_total === 30 &&
          rattrapee.fragments_deposes.length === 1 && rattrapee.intrus === undefined,
          JSON.stringify(rattrapee));

  // Aller-retour : ajouter, deposer, sauver, relire ailleurs.
  var wr = mondeAvec({});
  wr.ctx.chargerPoches();
  var pa = wr.ctx.creerPoche("leger", origine, t0);
  var pb = wr.ctx.creerPoche("critique", { lat: 1, lon: 2, arene_id: "node/7" }, t0 + 1000);
  var ajoutA = wr.ctx.ajouterPoche(pa), ajoutB = wr.ctx.ajouterPoche(pb);
  wr.ctx.deposerFragment(pa, { peng: { mince: 1, grand: 0, complet: 0 } }, "j1", "peng", "mince", t0 + 5);
  wr.ctx.sauverPoches();
  var ecrit = JSON.parse(wr.stockage.echos_poches_v1);
  verifie("la sauvegarde a le format { version: 1, poches: [...] }",
          ecrit.version === 1 && Object.keys(ecrit).join(",") === "version,poches" && ecrit.poches.length === 2,
          wr.stockage.echos_poches_v1);
  var wr2 = mondeAvec({ echos_poches_v1: wr.stockage.echos_poches_v1 });
  wr2.ctx.chargerPoches();
  verifie("aller-retour sauvegarde / chargement : les poches reviennent a l'identique",
          ajoutA.ok && ajoutB.ok &&
          JSON.stringify(wr2.ctx.poches) === JSON.stringify(wr.ctx.poches),
          JSON.stringify(wr2.ctx.poches));

  verifie("ajouterPoche refuse une poche invalide",
          wr.ctx.ajouterPoche({ id: "rien" }).raison === "poche_invalide" &&
          wr.ctx.ajouterPoche(null).raison === "poche_invalide");
  verifie("ajouterPoche refuse un id deja present",
          wr.ctx.ajouterPoche(wr.ctx.creerPoche("leger", origine, t0)).raison === "id_deja_present" &&
          wr.ctx.poches.length === 2);
  verifie("ajouterPoche range la poche elle-meme, pas une copie", wr.ctx.poches[0] === pa);

  // Nettoyage. Une legere jamais remplie expire a echeance ; son
  // effet dure 60 min, la marge 60 min de plus.
  var wn = mondeAvec({});
  wn.ctx.chargerPoches();
  var casse = wn.ctx.creerPoche("leger", origine, t0);
  var remplie = deposer(wn.ctx.creerPoche("leger", { lat: 3, lon: 3 }, t0), 12);
  var ouverte = wn.ctx.creerPoche("critique", { lat: 4, lon: 4 }, t0 + 999 * MIN);
  [casse, remplie, ouverte].forEach(function (p) { wn.ctx.ajouterPoche(p); });
  var finNettoyage = casse.timestamp_expiration + 120 * MIN;

  var retireesTot = wn.ctx.nettoyerPoches(finNettoyage);
  verifie("a la fin exacte de l'effet + marge, la poche est encore gardee",
          retireesTot === 0 && wn.ctx.poches.length === 3, retireesTot);
  var listeAvant = wn.ctx.poches;
  var retirees = wn.ctx.nettoyerPoches(finNettoyage + 1);
  verifie("1 ms plus tard : les poches terminees partent, l'ouverte reste",
          retirees === 2 && wn.ctx.poches.length === 1 && wn.ctx.poches[0] === ouverte,
          retirees + " " + JSON.stringify(wn.ctx.poches.map(function (p) { return p.id; })));
  verifie("le nettoyage modifie la liste en place", wn.ctx.poches === listeAvant);
  verifie("une poche ouverte n'est jamais nettoyee",
          wn.ctx.nettoyerPoches(t0 + 999 * MIN + 1) === 0 && wn.ctx.poches.length === 1);

  // Plafond : a l'ajout, au chargement, et au nettoyage.
  var wp = mondeAvec({});
  wp.ctx.chargerPoches();
  for (var n1 = 0; n1 < 50; n1++) wp.ctx.ajouterPoche(wp.ctx.creerPoche("leger", origine, t0 + n1));
  verifie("plafond : la 51e poche est refusee",
          wp.ctx.poches.length === 50 &&
          wp.ctx.ajouterPoche(wp.ctx.creerPoche("leger", origine, t0 + 50)).raison === "liste_pleine");

  var cinquanteCinq = [];
  for (var n2 = 0; n2 < 55; n2++) cinquanteCinq.push(ctxP.creerPoche("leger", origine, t0 + n2));
  var wl = mondeAvec({ echos_poches_v1: JSON.stringify({ version: 1, poches: cinquanteCinq }) });
  wl.ctx.chargerPoches();
  var plusAncienne = Math.min.apply(null, wl.ctx.poches.map(function (p) { return p.timestamp_creation; }));
  verifie("plafond au chargement : les 50 plus recentes sont gardees",
          wl.ctx.poches.length === 50 && plusAncienne === t0 + 5, wl.ctx.poches.length + " " + plusAncienne);

  // 55 poches poussees de force : 10 cassees (effet encore actif),
  // 45 ouvertes. Le nettoyage retire les 5 cassees les plus anciennes.
  var wf = mondeAvec({});
  wf.ctx.chargerPoches();
  for (var n3 = 0; n3 < 10; n3++) wf.ctx.poches.push(wf.ctx.creerPoche("leger", origine, t0 + n3));
  for (var n4 = 0; n4 < 45; n4++) wf.ctx.poches.push(wf.ctx.creerPoche("leger", origine, t0 + 200 * MIN + n4));
  var tPlafond = t0 + 160 * MIN;   // les 10 premieres ont casse, aucune n'est terminee
  var retireesPlafond = wf.ctx.nettoyerPoches(tPlafond);
  var restantes = wf.ctx.poches.map(function (p) { return p.timestamp_creation; });
  verifie("plafond au nettoyage : les finies les plus anciennes partent d'abord",
          retireesPlafond === 5 && wf.ctx.poches.length === 50 &&
          restantes.indexOf(t0 + 4) === -1 && restantes.indexOf(t0 + 5) !== -1 &&
          restantes.indexOf(t0 + 200 * MIN) !== -1,
          retireesPlafond + " " + wf.ctx.poches.length);

  verifie("echos_joueur_v5 inchangee apres chargement, ajout, sauvegarde et nettoyage",
          [w0, wa, wr, wr2, wn, wp, wl, wf].every(function (w) { return w.stockage.echos_joueur_v5 === joueurS; }));

  // deposerEtSauver : l'ordre des ecritures est enregistre au passage.
  var ordre = [];
  var stockageEspion = new Proxy({ echos_joueur_v5: joueurS }, {
    set: function (cible, cle, valeur) { ordre.push(cle); cible[cle] = valeur; return true; }
  });
  var wd = creerMonde({ stockage: stockageEspion });
  wd.ctx.chargerJoueur();
  wd.ctx.chargerPoches();
  var pd2 = wd.ctx.creerPoche("leger", origine, t0);
  wd.ctx.ajouterPoche(pd2);

  var horsListe = wd.ctx.creerPoche("leger", { lat: 9, lon: 9 }, t0);
  var rHors = wd.ctx.deposerEtSauver(horsListe, "j1", "peng", "mince", t0 + 1);
  var rRefus = wd.ctx.deposerEtSauver(pd2, "j1", "peng", "complet", t0 + 1);
  verifie("deposerEtSauver : poche hors liste ou refus -> aucune ecriture, gourde intacte",
          rHors.raison === "poche_inconnue" && rRefus.raison === "fragment_complet" &&
          ordre.length === 0 && horsListe.fragments_deposes.length === 0 &&
          wd.ctx.gourde.peng.mince === 2,
          JSON.stringify([rHors, rRefus, ordre]));

  var rOk = wd.ctx.deposerEtSauver(pd2, "j1", "peng", "mince", t0 + 2);
  verifie("deposerEtSauver : sauverPoches puis sauverJoueur, dans cet ordre",
          rOk.ok === true && JSON.stringify(ordre) === '["echos_poches_v1","echos_joueur_v5"]',
          JSON.stringify(ordre));
  var avantJ = JSON.parse(joueurS), apresJ = JSON.parse(stockageEspion.echos_joueur_v5);
  var autresBlocs = Object.keys(avantJ).filter(function (b) { return b !== "gourde"; });
  verifie("apres un depot, seule la gourde change dans echos_joueur_v5 (meme version, memes blocs)",
          apresJ.version === avantJ.version &&
          Object.keys(apresJ).join(",") === Object.keys(avantJ).join(",") &&
          autresBlocs.every(function (b) { return JSON.stringify(apresJ[b]) === JSON.stringify(avantJ[b]); }) &&
          apresJ.gourde.peng.mince === 1 && avantJ.gourde.peng.mince === 2,
          JSON.stringify(apresJ.gourde));
  var pochesRelues = JSON.parse(stockageEspion.echos_poches_v1).poches;
  verifie("apres un depot, la poche enregistree porte le depot",
          pochesRelues.length === 1 && pochesRelues[0].fragments_deposes.length === 1 &&
          pochesRelues[0].fragments_deposes[0].joueur_id === "j1");


  /* ----------------------------------------------------------
     RENDU 3D : MANIFESTE ET REPLI
     La partie WebGL se verifie a la main (banc 3D du mode test).
     Ici : le manifeste, les noms de clips, le repli 2D, et la
     promesse que lib/three/ n'est jamais chargee au demarrage.
     ---------------------------------------------------------- */

  bloc("Rendu 3D : manifeste et repli");

  var mr = creerMonde();
  var R = mr.ctx;

  // Aucun <script> ajoute au demarrage : Three.js ne pese rien tant
  // qu'on ne demande pas de 3D.
  function scriptsAjoutes(m) {
    return m.corps.enfants.filter(function (e) { return e.tag === "script"; });
  }
  verifie("au demarrage, lib/three/ n'est pas chargee",
          scriptsAjoutes(mr).length === 0 && typeof R.THREE === "undefined" &&
          R.Rendu3D.etat().lib === "absente");

  var cleEspeces = Object.keys(R.ESPECES).sort().join(",");
  var cleManifeste = Object.keys(R.MONSTRES_3D).sort().join(",");
  verifie("le manifeste couvre exactement les especes de js/especes.js",
          cleEspeces === cleManifeste, cleManifeste);

  var fautesManifeste = [];
  Object.keys(R.MONSTRES_3D).forEach(function (id) {
    var e = R.MONSTRES_3D[id];
    if (!(typeof e.echelle === "number" && e.echelle > 0)) fautesManifeste.push(id + " : echelle");
    if (!e.clips || typeof e.clips !== "object") fautesManifeste.push(id + " : clips");
    Object.keys(e.clips || {}).forEach(function (role) {
      if (R.CLIPS_3D.indexOf(role) === -1) fautesManifeste.push(id + " : role inconnu " + role);
    });
    if (e.modele !== null) {
      if (e.modele !== "assets/monstres/" + id + ".glb") fautesManifeste.push(id + " : chemin hors convention");
      else if (!fs.existsSync(path.join(RACINE, e.modele))) fautesManifeste.push(id + " : fichier absent");
    }
  });
  Object.keys(R.DECORS_3D).forEach(function (type) {
    var d = R.DECORS_3D[type];
    if (d.modele !== null &&
        (d.modele !== "assets/decors/" + type + ".glb" || !fs.existsSync(path.join(RACINE, d.modele)))) {
      fautesManifeste.push("decor " + type + " : chemin ou fichier");
    }
  });
  verifie("manifeste : echelles > 0, roles connus, chaque modele suit la convention et existe",
          fautesManifeste.length === 0, fautesManifeste.join(" | "));

  verifie("decors : exactement les types de lieu de js/lieux.js (monument pour les musees)",
          Object.keys(R.DECORS_3D).sort().join(",") === "metro,monument,parc,temple",
          Object.keys(R.DECORS_3D).join(","));

  verifie("les cinq clips attendus, dans l'ordre",
          R.CLIPS_3D.join(",") === "idle,attaque,degat,ko,victoire", R.CLIPS_3D.join(","));

  var renomme = { modele: "x.glb", echelle: 1, clips: { attaque: "Morsure" } };
  verifie("nomClip3D : le role par defaut, le nom propre au fichier sinon, rien pour un role inconnu",
          R.nomClip3D(renomme, "idle") === "idle" && R.nomClip3D(renomme, "attaque") === "Morsure" &&
          R.nomClip3D(renomme, "danse") === "" && R.nomClip3D(null, "ko") === "ko" &&
          R.nomClip3D({ clips: { ko: "" } }, "ko") === "ko");

  // Le repli, cas par cas
  var tout = { webgl: true, lib: "prete", contextePerdu: false, echecs: {} };
  function avec(modif) {
    var e = { webgl: tout.webgl, lib: tout.lib, contextePerdu: tout.contextePerdu, echecs: {} };
    for (var k in modif) e[k] = modif[k];
    return e;
  }
  var entreeOk = { modele: "assets/monstres/test.glb", echelle: 1, clips: {} };
  verifie("raisonRepli3D : chaque cas de repli a sa raison, et rien quand tout va bien",
          R.raisonRepli3D(null, tout) === "pas_au_manifeste" &&
          R.raisonRepli3D({ modele: null, echelle: 1, clips: {} }, tout) === "pas_de_modele" &&
          R.raisonRepli3D(entreeOk, avec({ webgl: false })) === "webgl_indisponible" &&
          R.raisonRepli3D(entreeOk, null) === "webgl_indisponible" &&
          R.raisonRepli3D(entreeOk, avec({ lib: "echec" })) === "lib_absente" &&
          R.raisonRepli3D(entreeOk, avec({ contextePerdu: true })) === "contexte_perdu" &&
          R.raisonRepli3D(entreeOk, avec({ echecs: { "assets/monstres/test.glb": true } })) === "chargement_echoue" &&
          R.raisonRepli3D(entreeOk, tout) === "");

  verifie("choisirVisuel3D : 2d pour une espece sans modele ou inconnue, meme avec WebGL",
          R.choisirVisuel3D("komainu", tout) === "2d" && R.choisirVisuel3D("inconnue", tout) === "2d" &&
          Object.keys(R.ESPECES).every(function (id) { return R.choisirVisuel3D(id, tout) === "2d"; }));

  R.MONSTRES_3D.komainu.modele = "assets/monstres/komainu.glb";   // le temps d'un test
  var visuels = [R.choisirVisuel3D("komainu", tout),
                 R.choisirVisuel3D("komainu", avec({ webgl: false })),
                 R.choisirVisuel3D("komainu", avec({ echecs: { "assets/monstres/komainu.glb": true } }))];
  R.MONSTRES_3D.komainu.modele = null;
  verifie("choisirVisuel3D : 3d avec un modele, 2d des que WebGL manque ou que le fichier a echoue",
          visuels.join(",") === "3d,2d,2d", visuels.join(","));

  // Sans WebGL (le faux navigateur n'en a pas) : repli immediat,
  // aucune exception, rien de telecharge.
  var raisons = [];
  var vue = R.document.createElement("div");
  R.Rendu3D.essayerEspece(vue, "komainu", { repli: function (r) { raisons.push(r); } });
  R.Rendu3D.essayerModele(vue, entreeOk, { repli: function (r) { raisons.push(r); } });
  verifie("essayer sans modele puis sans WebGL : repli 2D, aucun canvas, aucun script ajoute",
          raisons.join(",") === "pas_de_modele,webgl_indisponible" &&
          vue.enfants.length === 0 && scriptsAjoutes(mr).length === 0, raisons.join(","));

  /* Avec un WebGL et un Three.js de theatre : juste assez pour
     suivre le chemin du code sans vrai rendu. */
  function monde3D(fichiers) {
    var m = creerMonde();
    var journal = { chargements: [], liberes: 0, perdus: 0, rendus: 0 };
    var creer = m.ctx.document.createElement;
    m.ctx.document.createElement = function (tag) {
      var el = creer(tag);
      if (tag === "canvas") {
        el.getContext = function () { return { getExtension: function () { return { loseContext: function () {} }; } }; };
      }
      return el;
    };
    m.ctx.document.removeEventListener = function () {};
    m.ctx.requestAnimationFrame = function () { journal.rendus++; return 7; };
    m.ctx.cancelAnimationFrame = function () {};

    function vec() { return { set: function () {}, setScalar: function (v) { this.valeur = v; } }; }
    function Mixer() {
      var actions = [];
      this.addEventListener = function () {};
      this.clipAction = function (clip) {
        var a = { clip: clip, joue: false, reset: function () {}, setLoop: function () {},
                  play: function () { this.joue = true; }, stop: function () { this.joue = false; } };
        actions.push(a);
        return a;
      };
      this.update = function () {};
      this.stopAllAction = function () {};
      this.uncacheRoot = function () {};
      this.actions = actions;
    }
    m.ctx.THREE = {
      LoopRepeat: 1, LoopOnce: 2,
      WebGLRenderer: function () {
        this.domElement = creer("canvas");
        this.domElement.removeEventListener = function () {};
        this.setPixelRatio = this.setSize = this.render = function () {};
        this.dispose = function () { journal.liberes++; };
        this.forceContextLoss = function () { journal.perdus++; };
      },
      Scene: function () { this.add = function () {}; this.traverse = function () {}; },
      PerspectiveCamera: function () { this.position = vec(); this.lookAt = function () {}; },
      HemisphereLight: function () {},
      DirectionalLight: function () { this.position = vec(); },
      Clock: function () { this.getDelta = function () { return 0; }; },
      AnimationMixer: Mixer,
      GLTFLoader: function () {
        this.load = function (url, ok, progres, echec) {
          journal.chargements.push(url);
          if (fichiers[url]) {
            ok({ scene: { scale: vec(), traverse: function () {} },
                 animations: fichiers[url].map(function (n) { return { name: n }; }) });
          } else {
            echec(new Error("404"));
          }
        };
      }
    };
    return { m: m, journal: journal };
  }

  var w3 = monde3D({ "assets/monstres/test.glb": ["idle", "attaque", "degat", "ko", "victoire"] });
  var vueAbsent = w3.m.ctx.document.createElement("div");
  var replis = [];
  var absent = { modele: "assets/monstres/absent.glb", echelle: 1, clips: {} };
  w3.m.ctx.Rendu3D.essayerModele(vueAbsent, absent, { repli: function (r) { replis.push(r); } });
  w3.m.ctx.Rendu3D.essayerModele(vueAbsent, absent, { repli: function (r) { replis.push(r); } });
  verifie("fichier absent : repli 2D, scene rendue (dispose + perte forcee), canvas retire",
          replis[0] === "chargement_echoue" && w3.journal.liberes === 1 && w3.journal.perdus === 1 &&
          vueAbsent.enfants.length === 0 && !w3.m.ctx.Rendu3D.actif(), JSON.stringify([replis, w3.journal]));
  verifie("fichier absent : l'echec est memorise, le fichier n'est pas redemande",
          replis[1] === "chargement_echoue" && w3.journal.chargements.length === 1,
          JSON.stringify(w3.journal.chargements));

  var vueOk = w3.m.ctx.document.createElement("div");
  var pret = null, replisOk = [];
  w3.m.ctx.Rendu3D.essayerModele(vueOk, { modele: "assets/monstres/test.glb", echelle: 2, clips: {} },
    { pret: function (p) { pret = p; }, repli: function (r) { replisOk.push(r); } });
  verifie("fichier present : le modele s'affiche en idle, a son echelle, sans repli",
          pret !== null && replisOk.length === 0 && vueOk.enfants.length === 1 &&
          vueOk.enfants[0].className === "rendu3d" && pret.racine.scale.valeur === 2 &&
          pret.action.clip.name === "idle" && w3.journal.rendus > 0);

  var clipsJoues = R.CLIPS_3D.map(function (role) {
    return w3.m.ctx.Rendu3D.jouerClip(pret, role) && pret.action.clip.name === role;
  });
  verifie("les cinq clips du fichier se jouent par leur nom",
          clipsJoues.every(Boolean), JSON.stringify(clipsJoues));

  var w4 = monde3D({ "assets/monstres/x.glb": ["Repos", "Morsure"] });
  var pRen = null;
  w4.m.ctx.Rendu3D.essayerModele(w4.m.ctx.document.createElement("div"),
    { modele: "assets/monstres/x.glb", echelle: 1, clips: { idle: "Repos", attaque: "Morsure" } },
    { pret: function (p) { pRen = p; } });
  verifie("clips renommes : idle -> Repos au depart, attaque -> Morsure ; ko absent -> false sans erreur",
          pRen && pRen.action.clip.name === "Repos" &&
          w4.m.ctx.Rendu3D.jouerClip(pRen, "attaque") === true && pRen.action.clip.name === "Morsure" &&
          w4.m.ctx.Rendu3D.jouerClip(pRen, "ko") === false && pRen.action.clip.name === "Morsure");

  w3.m.ctx.Rendu3D.detruire();
  verifie("detruire : tout est rendu, le canvas quitte la page, un second appel ne fait rien",
          vueOk.enfants.length === 0 && w3.journal.liberes === 2 && w3.journal.perdus === 2 &&
          (w3.m.ctx.Rendu3D.detruire(), w3.journal.liberes === 2));

  // La perte de contexte : repli, puis tout est rendu.
  var w5 = monde3D({ "assets/monstres/test.glb": ["idle"] });
  var vuePerte = w5.m.ctx.document.createElement("div"), replisPerte = [];
  w5.m.ctx.Rendu3D.essayerModele(vuePerte, entreeOk, { repli: function (r) { replisPerte.push(r); } });
  var canvas = vuePerte.enfants[0];
  var empeche = false;
  canvas.declencher("webglcontextlost", { preventDefault: function () { empeche = true; } });
  verifie("contexte WebGL perdu (iOS en arriere-plan) : preventDefault, repli 2D, scene rendue",
          empeche && replisPerte.join(",") === "contexte_perdu" && vuePerte.enfants.length === 0 &&
          w5.journal.liberes === 1 && !w5.m.ctx.Rendu3D.actif(), JSON.stringify(replisPerte));
  w5.m.ctx.Rendu3D.essayerModele(vuePerte, entreeOk, { repli: function (r) { replisPerte.push(r); } });
  verifie("apres une perte, on peut relancer : la 3D revient",
          replisPerte.length === 1 && vuePerte.enfants.length === 1 && w5.m.ctx.Rendu3D.actif());

  // Sans Three.js : il est ajoute a la page, et son echec donne le repli
  var w6 = monde3D({});
  delete w6.m.ctx.THREE;
  var replisLib = [];
  w6.m.ctx.Rendu3D.essayerModele(w6.m.ctx.document.createElement("div"), entreeOk,
    { repli: function (r) { replisLib.push(r); } });
  var ajoutes = scriptsAjoutes(w6.m);
  verifie("a la premiere demande, lib/three/three.min.js est ajoute a la page",
          ajoutes.length === 1 && ajoutes[0].src === "lib/three/three.min.js" && replisLib.length === 0,
          JSON.stringify(ajoutes.map(function (s) { return s.src; })));
  ajoutes[0].onerror();
  w6.m.ctx.Rendu3D.essayerModele(w6.m.ctx.document.createElement("div"), entreeOk,
    { repli: function (r) { replisLib.push(r); } });
  verifie("lib/three/ introuvable : repli, et pas de second telechargement",
          replisLib.join(",") === "lib_absente,lib_absente" && scriptsAjoutes(w6.m).length === 1,
          replisLib.join(","));

  // Les cinematiques
  var cine = JSON.parse(fs.readFileSync(path.join(RACINE, "assets/attaques/test.json"), "utf8"));
  verifie("assets/attaques/test.json est une cinematique valide",
          R.validerCinematique3D(cine) === "", R.validerCinematique3D(cine));
  function abimee(f) { var c = JSON.parse(JSON.stringify(cine)); f(c); return R.validerCinematique3D(c); }
  var fautes = [
    abimee(function (c) { c.attaquant.clip = "danse"; }),
    abimee(function (c) { c.duree = 0; }),
    abimee(function (c) { c.camera = []; }),
    abimee(function (c) { c.camera[1].t = 0; }),
    abimee(function (c) { c.camera[2].t = 9; }),
    abimee(function (c) { c.camera[0].position = [0, 1]; }),
    abimee(function (c) { c.effet.type = "laser"; }),
    abimee(function (c) { c.effet.duree = 5; }),
    abimee(function (c) { c.effet.couleur = "or"; }),
    R.validerCinematique3D(null)
  ];
  verifie("une cinematique abimee est refusee, avec la faute",
          fautes.join(",") === "attaquant.clip,duree,camera,camera[1].t,camera[2].t," +
                               "camera[0].position,effet.type,effet.duree,effet.couleur,pas_un_objet",
          fautes.join(","));

  // Les fichiers de test eux-memes : de vrais GLB, dans le budget
  function lireGlb(f) {
    var b = fs.readFileSync(path.join(RACINE, f));
    if (b.readUInt32LE(0) !== 0x46546C67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(8) !== b.length) return null;
    var longueur = b.readUInt32LE(12);
    if (b.readUInt32LE(16) !== 0x4E4F534A) return null;
    var json = JSON.parse(b.slice(20, 20 + longueur).toString("utf8"));
    var triangles = 0;
    json.meshes.forEach(function (me) {
      me.primitives.forEach(function (p) { triangles += json.accessors[p.indices].count / 3; });
    });
    return { json: json, triangles: triangles, ko: b.length / 1024 };
  }
  var glbM = lireGlb(R.MODELE_3D_TEST.modele), glbD = lireGlb(R.DECOR_3D_TEST);
  verifie("monstres/test.glb : GLB 2.0, les cinq clips, dans le budget",
          glbM && (glbM.json.animations || []).map(function (a) { return a.name; }).join(",") === R.CLIPS_3D.join(",") &&
          glbM.triangles <= R.BUDGET_3D.monstre.triangles && glbM.ko <= R.BUDGET_3D.monstre.ko,
          glbM ? glbM.triangles + " triangles, " + glbM.ko.toFixed(1) + " Ko" : "pas un GLB");
  verifie("decors/test.glb : GLB 2.0, dans le budget",
          glbD && glbD.triangles <= R.BUDGET_3D.decor.triangles && glbD.ko <= R.BUDGET_3D.decor.ko,
          glbD ? glbD.triangles + " triangles" : "pas un GLB");
  verifie("test.json dans le budget des cinematiques",
          fs.statSync(path.join(RACINE, "assets/attaques/test.json")).size / 1024 <= R.BUDGET_3D.attaque.ko);

  // lib/three/ : des scripts classiques, licence en tete
  var libFautes = [];
  R.FICHIERS_LIB_3D.forEach(function (f) {
    var t = fs.readFileSync(path.join(RACINE, R.DOSSIER_LIB_3D + f), "utf8");
    if (/^\s*(import|export)\s/m.test(t)) libFautes.push(f + " : module ES6");
    if (t.slice(0, 300).indexOf("SPDX-License-Identifier: MIT") === -1) libFautes.push(f + " : en-tete de licence");
  });
  if (!fs.existsSync(path.join(RACINE, "lib/three/LICENSE"))) libFautes.push("LICENSE absent");
  verifie("lib/three/ : scripts classiques (aucun import/export), licence MIT en tete",
          libFautes.length === 0, libFautes.join(" | "));

  var html3d = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  verifie("index.html n'appelle jamais lib/three/ directement",
          html3d.indexOf("lib/three") === -1);

  verifie("rien du rendu 3D n'a ecrit dans localStorage",
          [mr, w3.m, w4.m, w5.m, w6.m].every(function (m) { return Object.keys(m.stockage).length === 0; }));

  /* ------------------------------------------------------------
     ICO EN RETRAIT : LE BOUTON "?" ET LES BULLES COUPEES
     Le panneau d'Ico est en pause (ICO_PANNEAU_ACTIVE), ses bulles
     sont coupees (ICO_BULLES_ACTIVES), et le bouton "?" (js/aide.js)
     prend sa place. La sauvegarde, elle, ne doit pas bouger : les
     blocs "ico" et "savoir" ressortent tels qu'ils sont entres.
     ------------------------------------------------------------ */
  bloc("Ico en retrait : aide et bulles");

  // Un monde qui charge aussi ico.js et aide.js, avec les elements
  // de index.html dont ils se servent.
  function mondeAide(stockage) {
    var m = creerMonde({ stockage: stockage || {} });
    ["btn-ico", "ico-pastille", "ico", "ico-portrait", "ico-sections", "ico-fragments",
     "ico-bulle", "ico-bulle-l1", "ico-bulle-l2",
     "btn-aide", "aide", "aide-titre", "aide-lignes", "btn-fermer-aide"].forEach(function (id) {
      m.statiques[id] = creerElement("div");
      m.statiques[id].id = id;
    });
    ["js/ico.js", "js/aide.js"].forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(RACINE, f), "utf8"), m.ctx, { filename: f });
    });
    return m;
  }

  var ma = mondeAide();
  var A = ma.ctx;

  verifie("ICO_PANNEAU_ACTIVE et ICO_BULLES_ACTIVES existent, et valent false",
          A.ICO_PANNEAU_ACTIVE === false && A.ICO_BULLES_ACTIVES === false,
          A.ICO_PANNEAU_ACTIVE + " / " + A.ICO_BULLES_ACTIVES);
  verifie("l'aide tient en 3 a 5 lignes",
          A.AIDE_LIGNES.length >= 3 && A.AIDE_LIGNES.length <= 5, A.AIDE_LIGNES.length);

  // --- Le bouton "Ico" cache, le panneau qui ne s'ouvre plus ---
  A.Aide.appliquerPanneauIco();
  verifie("panneau en pause : le bouton Ico est cache",
          ma.statiques["btn-ico"].style.display === "none", ma.statiques["btn-ico"].style.display);
  var erreurOuvrir = null;
  try { A.Ico.ouvrir(); } catch (e) { erreurOuvrir = e; }
  verifie("panneau en pause : Ico.ouvrir() n'ouvre rien",
          erreurOuvrir === null && !ma.statiques.ico.classList.contains("actif"),
          erreurOuvrir && erreurOuvrir.message);

  A.ICO_PANNEAU_ACTIVE = true;
  A.Aide.appliquerPanneauIco();
  verifie("panneau remis a true : le bouton Ico revient",
          ma.statiques["btn-ico"].style.display === "", ma.statiques["btn-ico"].style.display);
  A.ICO_PANNEAU_ACTIVE = false;
  A.Aide.appliquerPanneauIco();

  // --- Le bouton "?" ---
  /* Dans un vrai navigateur, innerHTML = "" retire les lignes de
     l'ouverture precedente ; le faux navigateur garde ses enfants.
     On ne lit donc que les lignes de la DERNIERE ouverture. */
  function lignesAffichees(m) {
    var enfants = m.statiques["aide-lignes"].enfants;
    return enfants.slice(enfants.length - m.ctx.AIDE_LIGNES.length)
                  .map(function (p) { return p.textContent; });
  }

  A.Aide.ouvrir();
  var fr = lignesAffichees(ma);
  verifie("le ? ouvre l'aide", ma.statiques.aide.classList.contains("actif"));
  verifie("l'aide montre les lignes de AIDE_LIGNES, en francais",
          fr.length === A.AIDE_LIGNES.length &&
          JSON.stringify(fr) === JSON.stringify(A.AIDE_LIGNES.map(function (c) { return A.TEXTES.fr[c]; })),
          JSON.stringify(fr));
  verifie("titre et bouton Fermer en francais",
          ma.statiques["aide-titre"].textContent === A.TEXTES.fr["aide.titre"] &&
          ma.statiques["btn-fermer-aide"].textContent === A.TEXTES.fr["aide.fermer"],
          ma.statiques["aide-titre"].textContent + " / " + ma.statiques["btn-fermer-aide"].textContent);
  A.Aide.fermer();
  verifie("Fermer referme l'aide", !ma.statiques.aide.classList.contains("actif"));

  // Chaque cle doit exister dans LES DEUX tables : pas de repli
  // silencieux sur le francais pour l'aide.
  var clesAide = A.AIDE_LIGNES.concat(["aide.titre", "aide.fermer"]);
  var absentesAide = [];
  ["fr", "en"].forEach(function (lg) {
    clesAide.forEach(function (c) {
      if (typeof A.TEXTES[lg][c] !== "string" || A.TEXTES[lg][c] === "") absentesAide.push(lg + ":" + c);
    });
  });
  verifie("chaque texte de l'aide existe en francais ET en anglais",
          absentesAide.length === 0, absentesAide.join(", "));

  A.definirLangue("en");
  A.Aide.ouvrir();
  var en = lignesAffichees(ma);
  verifie("en anglais, l'aide est en anglais (relue a l'ouverture)",
          JSON.stringify(en) === JSON.stringify(A.AIDE_LIGNES.map(function (c) { return A.TEXTES.en[c]; })) &&
          ma.statiques["aide-titre"].textContent === A.TEXTES.en["aide.titre"] &&
          en.every(function (l, i) { return l !== fr[i]; }),
          JSON.stringify(en));
  A.Aide.fermer();
  A.definirLangue("fr");

  var textesAide = [];
  ["fr", "en"].forEach(function (lg) {
    clesAide.forEach(function (c) { textesAide.push(A.TEXTES[lg][c] || ""); });
  });
  verifie("aucune cle brute affichee",
          fr.concat(en).every(function (l) { return l && l.indexOf("aide.") !== 0; }));
  verifie("le mot Figement n'apparait pas dans l'aide",
          textesAide.every(function (t) { return !/figement/i.test(t); }));

  // --- Les bulles coupees ---
  var stockAvant = JSON.stringify(ma.stockage);
  var vusAvant = JSON.stringify(A.suiviIco);
  var affichees = [];
  A.TEXTES_ICO_DIDACTICIEL.forEach(function (d) {
    A.Ico.dire(d.cle);
    if (A.Ico.bulleAffichee() || A.Ico.enAttente().length) affichees.push(d.cle);
  });
  ma.horloge.avancer(60000);
  verifie("bulles coupees : aucune des " + A.TEXTES_ICO_DIDACTICIEL.length + " interventions ne s'affiche",
          affichees.length === 0 && !A.Ico.bulleAffichee() &&
          !ma.statiques["ico-bulle"].classList.contains("visible") &&
          ma.statiques["ico-bulle-l1"].textContent === "",
          affichees.join(", "));
  verifie("bulles coupees : rien n'est note comme vu, rien n'est ecrit",
          JSON.stringify(A.suiviIco) === vusAvant && JSON.stringify(ma.stockage) === stockAvant,
          JSON.stringify(A.suiviIco));

  // --- Les anciennes sauvegardes demarrent, les blocs ne bougent pas ---
  var icoPlein = { didacticiensVus: ["combat", "victoire"], palierLu: 2, palierAtteint: 3 };
  var savoirPlein = { combats: 4, jours: ["2026-10-01", "2026-10-02"], lieux: ["lieu-a", "lieu-b"] };
  var joueurAncien = { nom: "Ethan", genre: "n", voie: "gardien", lieuZero: null, introVue: true };
  function pengAncien() { return { peng: { espece: "peng", niveau: 5, xp: 8, pv: 40 } }; }
  var anciennes = [
    ["v2", "echos_joueur_v2", { collection: pengAncien(), equipe: ["peng"] }],
    ["v3", "echos_joueur_v3", { version: 3, collection: pengAncien(), equipe: ["peng"], joueur: joueurAncien }],
    ["v4", "echos_joueur_v4", { version: 4, collection: pengAncien(), equipe: ["peng"], joueur: joueurAncien,
                                ico: icoPlein }],
    ["v5", "echos_joueur_v5", { version: 5, collection: pengAncien(), equipe: ["peng"], joueur: joueurAncien,
                                ico: icoPlein, savoir: savoirPlein }]
  ];

  anciennes.forEach(function (a) {
    var st = {};
    st[a[1]] = JSON.stringify(a[2]);
    var mv = mondeAide(st);
    var err = null;
    try {
      mv.ctx.chargerJoueur();
      mv.ctx.Aide.appliquerPanneauIco();
      mv.ctx.Ico.dire("combat");
      mv.ctx.Ico.dire("aptitudes");
      mv.ctx.sauverJoueur();
    } catch (e) { err = e; }

    verifie(a[0] + " : se charge et se sauve sans erreur, avec le ? et Ico en retrait",
            err === null && !!mv.ctx.collection.peng, err && err.message);

    var relu = JSON.parse(mv.stockage.echos_joueur_v5 || "{}");
    var icoAttendu = a[2].ico || { didacticiensVus: [], palierLu: 0, palierAtteint: 0 };
    var savoirAttendu = a[2].savoir || { combats: 0, jours: [], lieux: [] };
    verifie(a[0] + " : le bloc ico ressort identique",
            JSON.stringify(relu.ico) === JSON.stringify(icoAttendu), JSON.stringify(relu.ico));
    verifie(a[0] + " : le bloc savoir ressort identique",
            JSON.stringify(relu.savoir) === JSON.stringify(savoirAttendu), JSON.stringify(relu.savoir));
  });

  /* ------------------------------------------------------------
     LE COMBAT A PLUSIEURS (js/combat3.js)
     Le moteur seul, sans ecran. Le hasard vient d'une suite fixe :
     chaque test rejoue exactement la meme chose.
     ------------------------------------------------------------ */
  bloc("Combat a plusieurs : le moteur");

  /* Un moteur casse peut lever une exception au milieu du bloc : on
     la signale ici, sous son vrai nom, au lieu de faire tomber tout
     le parcours. */
  try {

  var mc = creerMonde();
  var K = mc.ctx;

  // Une suite fixe qui tourne en boucle : le "hasard" des tests.
  function suite(valeurs) {
    var i = 0;
    return function () { return valeurs[i++ % valeurs.length]; };
  }
  function photo(c) { return JSON.stringify(c); }
  function creer(eq, adv, options) {
    var r = K.creerCombatMulti(eq, adv, options);
    if (!r.ok) throw new Error("creation refusee : " + r.refus);
    return r.combat;
  }
  function E(espece, niveau) { return { espece: espece, niveau: niveau }; }
  function ids(liste) { return liste.map(function (u) { return u.id; }).join(","); }
  var zero = suite([0]), milieu = suite([0.5]);

  // --- Les donnees ---
  var sansVit = Object.keys(K.ESPECES).filter(function (id) {
    return !(typeof K.ESPECES[id].vit === "number" && K.ESPECES[id].vit > 0);
  });
  verifie("chaque espece a une vitesse (vit) dans especes.js", sansVit.length === 0, sansVit.join(", "));
  verifie("vitesse : +6 % par niveau (komainu 5 au niveau 1, 8 au niveau 11)",
          K.VITESSE_CROISSANCE === 0.06 &&
          K.vitesseAuNiveau("komainu", 1) === 5 && K.vitesseAuNiveau("komainu", 11) === 8,
          K.vitesseAuNiveau("komainu", 1) + " / " + K.vitesseAuNiveau("komainu", 11));
  verifie("l'espece compte plus que le niveau (komainu niv. 7 reste plus lent que vinci niv. 1)",
          K.vitesseAuNiveau("komainu", 7) < K.vitesseAuNiveau("vinci", 1),
          K.vitesseAuNiveau("komainu", 7));

  // --- Le boost des sauvages ---
  function memeBoost(b, pv, atq) { return !!b && b.pv === pv && b.atq === atq; }
  verifie("boost plein : 1 adversaire x2.5 / x2.2, 2 x1.6 / x1.4, 3 x1.2 / x1.1",
          memeBoost(K.boostSauvage(1), 2.5, 2.2) && memeBoost(K.boostSauvage(2), 1.6, 1.4) &&
          memeBoost(K.boostSauvage(3), 1.2, 1.1) && K.boostSauvage(4) === null);
  verifie("boost module par ton equipe : plein avec 3 Echos, 1 + (b - 1) / 3 avec un seul",
          memeBoost(K.boostEffectif(1, 3), 2.5, 2.2) && memeBoost(K.boostEffectif(1, 1), 1.5, 1.4) &&
          memeBoost(K.boostEffectif(3, 2), 1.1333, 1.0667),
          JSON.stringify([K.boostEffectif(1, 3), K.boostEffectif(1, 1), K.boostEffectif(3, 2)]));

  var equipe3 = [E("komainu", 10), E("peng", 10), E("baku", 10)];
  var equipeAvant = photo(equipe3);
  var cb = creer(equipe3, [E("hinezumi", 8)]);
  var sH = K.statsAuNiveau("hinezumi", 8);
  verifie("un sauvage seul contre 3 Echos : PV x2.5, ATQ x2.2, niveau et DEF inchanges",
          cb.adversaires[0].pvMax === Math.round(sH.pvMax * 2.5) && cb.adversaires[0].pv === cb.adversaires[0].pvMax &&
          cb.adversaires[0].atq === Math.round(sH.atq * 2.2) &&
          cb.adversaires[0].niveau === 8 && cb.adversaires[0].def === sH.def &&
          cb.adversaires[0].vit === K.vitesseAuNiveau("hinezumi", 8),
          JSON.stringify(cb.adversaires[0]));
  verifie("la creation ne touche pas aux Echos qu'on lui passe", photo(equipe3) === equipeAvant);

  var cb1 = creer([E("komainu", 10)], [E("hinezumi", 8)]);
  verifie("contre un seul Echo, le sauvage seul n'a que PV x1.5 et ATQ x1.4",
          cb1.adversaires[0].pvMax === Math.round(sH.pvMax * 1.5) && cb1.adversaires[0].atq === Math.round(sH.atq * 1.4),
          cb1.adversaires[0].pvMax + " / " + cb1.adversaires[0].atq);

  var cb3 = creer(equipe3, [E("hinezumi", 8), E("palantir", 8), E("baku", 8)]);
  verifie("trois sauvages contre 3 Echos : PV x1.2, ATQ x1.1 chacun",
          cb3.adversaires[0].pvMax === Math.round(sH.pvMax * 1.2) && cb3.adversaires[0].atq === Math.round(sH.atq * 1.1),
          cb3.adversaires[0].pvMax + " / " + cb3.adversaires[0].atq);

  var cbG = creer(equipe3, [{ espece: "hinezumi", niveau: 8, sauvage: false }]);
  verifie("un adversaire non sauvage n'est pas booste",
          cbG.adversaires[0].pvMax === sH.pvMax && cbG.adversaires[0].atq === sH.atq);

  // --- Les refus a la creation ---
  var refusCreation = [
    K.creerCombatMulti([], [E("peng", 1)]).refus,
    K.creerCombatMulti([E("peng", 1), E("baku", 1), E("komainu", 1), E("vinci", 1)], [E("peng", 1)]).refus,
    K.creerCombatMulti([E("peng", 1)], []).refus,
    K.creerCombatMulti([E("peng", 1)], [E("peng", 1), E("peng", 1), E("peng", 1), E("peng", 1)]).refus,
    K.creerCombatMulti([E("inconnue", 1)], [E("peng", 1)]).refus,
    K.creerCombatMulti([E("peng", 1)], [E("peng", 0)]).refus
  ];
  verifie("creation refusee : equipe de 0 ou 4, 0 ou 4 adversaires, espece ou niveau impossibles",
          JSON.stringify(refusCreation) === JSON.stringify(["equipe_invalide", "equipe_invalide",
            "adversaires_invalides", "adversaires_invalides", "equipe_invalide", "adversaires_invalides"]),
          JSON.stringify(refusCreation));

  // --- Le gate break, fige a la creation ---
  var optionsGB = { malusGateBreak: 3 };
  var cgb = creer(equipe3, [E("hinezumi", 8)], optionsGB);
  optionsGB.malusGateBreak = 5;
  verifie("malusGateBreak : 0 par defaut, sinon recopie et ajoute au niveau de combat, puis fige",
          cb.malusGateBreak === 0 && cgb.malusGateBreak === 3 && cgb.adversaires[0].niveau === 11 &&
          cgb.adversaires[0].pvMax === Math.round(K.statsAuNiveau("hinezumi", 11).pvMax * 2.5),
          cgb.malusGateBreak + " / niv. " + cgb.adversaires[0].niveau);

  // --- L'ordre des tours ---
  // vitesses au niveau 1 : hinezumi 9, palantir 5, komainu 5, baku 5
  var co = creer([E("palantir", 1), E("komainu", 1)], [E("baku", 1), E("hinezumi", 1)]);
  verifie("ordre : le plus rapide d'abord ; egalite : ton camp, puis l'ordre des places",
          ids(K.ordreDesTours(co)) === "a1,j0,j1,a0", ids(K.ordreDesTours(co)));

  var vus = [], finTour = false, garde = 0;
  while (co.tour === 1 && garde++ < 10) {
    var qui = K.acteurCourant(co);
    vus.push(qui.id);
    var act = qui.camp === "adverse" ? K.actionAdverse(co, zero) : { type: "defendre" };
    var r = K.jouerActionMulti(co, act, milieu);
    if (r.evenements.some(function (e) { return e.type === "finTour"; })) finTour = true;
  }
  verifie("un tour de table : chacun joue une fois, dans l'ordre, puis le tour 2 commence",
          vus.join(",") === "a1,j0,j1,a0" && finTour && co.tour === 2 && K.acteurCourant(co).id === "a1",
          vus.join(",") + " / tour " + co.tour);

  // --- Le KO retire un monstre de l'ordre ---
  var ck = creer([E("hinezumi", 10)], [E("palantir", 1), E("baku", 1)]);
  ck.adversaires[0].pv = 1;
  var rk = K.jouerActionMulti(ck, { type: "attaque", cible: "a0" }, milieu);
  verifie("KO : l'adversaire a 0 PV sort de l'ordre et des cibles",
          rk.ok && rk.evenements.some(function (e) { return e.type === "ko" && e.cible === "a0"; }) &&
          ids(K.ordreDesTours(ck)).indexOf("a0") === -1 &&
          K.ciblesValides(ck, ck.equipe[0], "attaque").join(",") === "a1" &&
          K.acteurCourant(ck).id === "a1" && rk.issue === null,
          ids(K.ordreDesTours(ck)) + " / " + JSON.stringify(rk));

  // --- Les refus en combat, sans mutation ---
  // ck : c'est au tour de a1 (baku, adversaire). On le fait jouer
  // pour revenir a hinezumi.
  K.jouerActionMulti(ck, K.actionAdverse(ck, zero), milieu);
  var cr = creer([E("komainu", 1), E("peng", 1)], [E("palantir", 1), E("baku", 1)]);
  // peng 7, puis komainu, palantir, baku (5) : c'est a peng (j1)
  cr.adversaires[1].pv = 0;
  var essais = [
    ["attaque sur un coequipier",           { type: "attaque", cible: "j0" },          zero, "cible_invalide"],
    ["attaque sur un id inconnu",           { type: "attaque", cible: "z9" },          zero, "cible_invalide"],
    ["attaque sur un adversaire KO",        { type: "attaque", cible: "a1" },          zero, "cible_invalide"],
    ["attaque sans cible",                  { type: "attaque" },                       zero, "cible_invalide"],
    ["assimiler un coequipier",             { type: "assimiler", cible: "j0" },        zero, "cible_invalide"],
    ["aptitude pas encore apprise",         { type: "aptitude", cle: "percee", cible: "a0" }, zero, "aptitude_inconnue"],
    ["aptitude qui n'existe pas",           { type: "aptitude", cle: "danse", cible: "a0" },  zero, "aptitude_inconnue"],
    ["action inconnue",                     { type: "danser" },                        zero, "action_inconnue"],
    ["sans generateur de hasard",           { type: "defendre" },                      null, "alea_invalide"]
  ];
  var refusFaux = [];
  essais.forEach(function (e) {
    var avant = photo(cr);
    var r = K.jouerActionMulti(cr, e[1], e[2]);
    if (r.ok || r.refus !== e[3] || photo(cr) !== avant) refusFaux.push(e[0] + " -> " + JSON.stringify(r));
  });
  verifie("cibles et actions invalides refusees avec leur code, sans rien muter",
          refusFaux.length === 0, refusFaux.join(" | "));

  var cad = creer([E("palantir", 1)], [E("hinezumi", 1)]);   // hinezumi joue d'abord
  var avantAd = photo(cad);
  var rad = K.jouerActionMulti(cad, { type: "defendre" }, zero);
  verifie("un adversaire ne peut qu'attaquer (action_interdite, sans mutation)",
          !rad.ok && rad.refus === "action_interdite" && photo(cad) === avantAd, JSON.stringify(rad));

  // --- Le ciblage adverse, au hasard injecte ---
  var cc = creer([E("palantir", 1), E("penghou", 1), E("jinchan", 1)], [E("hinezumi", 1)]);
  var avantCc = photo(cc);
  var cibles = [suite([0]), suite([0.5]), suite([0.99])].map(function (g) { return K.actionAdverse(cc, g).cible; });
  verifie("l'adversaire vise un de tes Echos debout tire au hasard (0 -> j0, 0.5 -> j1, 0.99 -> j2), sans muter",
          cibles.join(",") === "j0,j1,j2" && photo(cc) === avantCc, cibles.join(","));
  cc.equipe[0].pv = 0;
  verifie("il ne vise jamais un Echo KO",
          K.actionAdverse(cc, suite([0])).cible === "j1" && K.actionAdverse(cc, suite([0.99])).cible === "j2");
  var ccTourJoueur = creer([E("hinezumi", 1)], [E("palantir", 1)]);
  verifie("actionAdverse rend null quand c'est a toi de jouer", K.actionAdverse(ccTourJoueur, zero) === null);

  // --- Victoire et defaite ---
  var cv = creer([E("hinezumi", 10)], [E("palantir", 1)]);
  cv.adversaires[0].pv = 1;
  var rv = K.jouerActionMulti(cv, { type: "attaque", cible: "a0" }, milieu);
  var avantFini = photo(cv);
  var rApres = K.jouerActionMulti(cv, { type: "defendre" }, milieu);
  verifie("victoire quand tous les adversaires sont KO ; ensuite combat_fini, sans mutation",
          rv.issue === "victoire" && K.issueCombatMulti(cv) === "victoire" && K.acteurCourant(cv) === null &&
          !rApres.ok && rApres.refus === "combat_fini" && photo(cv) === avantFini,
          JSON.stringify(rv) + " " + JSON.stringify(rApres));

  var cd = creer([E("palantir", 1), E("komainu", 1)], [E("hinezumi", 10)]);
  cd.equipe[0].pv = 0;
  cd.equipe[1].pv = 1;
  var rd = K.jouerActionMulti(cd, K.actionAdverse(cd, zero), milieu);
  verifie("defaite quand tous tes Echos sont KO (pas avant)",
          rd.issue === "defaite" && cd.equipe[1].pv === 0, JSON.stringify(rd));

  var cd2 = creer([E("palantir", 1), E("komainu", 1)], [E("hinezumi", 10)]);
  cd2.equipe[0].pv = 1;
  var rd2 = K.jouerActionMulti(cd2, { type: "attaque", cible: "j0" }, milieu);
  verifie("un seul Echo KO sur deux : le combat continue", rd2.ok && rd2.issue === null, JSON.stringify(rd2));

  // --- L'assimilation : un seul par combat, au niveau 1 ---
  var collectionAvant = photo(K.collection);
  // palantir au niveau 3 : on doit voir qu'il arrive au niveau 1,
  // pas a son niveau de combat.
  var ca = creer([E("komainu", 30)], [E("palantir", 3), E("chiguo", 1)]);
  var ra = K.jouerActionMulti(ca, { type: "assimiler", cible: "a0" }, zero);
  var evA = ra.evenements[0];
  verifie("assimilation reussie : le compte rendu donne l'espece au niveau 1",
          ra.ok && evA.type === "assimilation" && evA.reussi && evA.espece === "palantir" && evA.niveau === 1 &&
          ca.assimile && ca.assimile.espece === "palantir" && ca.assimile.niveau === K.ASSIMILATION_NIVEAU_ENTREE &&
          K.ASSIMILATION_NIVEAU_ENTREE === 1,
          JSON.stringify(ra));
  verifie("l'assimile sort de l'ordre et des cibles",
          ids(K.ordreDesTours(ca)).indexOf("a0") === -1 && K.ciblesValides(ca, ca.equipe[0], "assimiler").join(",") === "a1");
  // chiguo joue, puis c'est de nouveau a komainu
  K.jouerActionMulti(ca, K.actionAdverse(ca, zero), milieu);
  var avantA2 = photo(ca);
  var ra2 = K.jouerActionMulti(ca, { type: "assimiler", cible: "a1" }, zero);
  verifie("un seul Echo assimile par combat : le second est refuse (deja_assimile), sans mutation",
          !ra2.ok && ra2.refus === "deja_assimile" && photo(ca) === avantA2, JSON.stringify(ra2));
  verifie("le moteur n'ecrit pas dans la collection", photo(K.collection) === collectionAvant);

  var ca1 = creer([E("komainu", 30)], [E("palantir", 1)]);
  var raV = K.jouerActionMulti(ca1, { type: "assimiler", cible: "a0" }, zero);
  verifie("assimiler le dernier adversaire, c'est la victoire", raV.issue === "victoire", JSON.stringify(raV));

  var caR = creer([E("palantir", 1)], [E("mechadrill", 3)]);   // rang S : 5 % de chance
  var raR = K.jouerActionMulti(caR, { type: "assimiler", cible: "a0" }, suite([0.99]));
  verifie("assimilation ratee : le tour passe, rien n'est assimile",
          raR.ok && raR.evenements[0].reussi === false && caR.assimile === null && caR.tentatives === 1,
          JSON.stringify(raR));

  var caX = creer([E("komainu", 30)], [{ espece: "palantir", niveau: 1, rang: "X" }]);
  var avantX = photo(caX);
  var rX = K.jouerActionMulti(caX, { type: "assimiler", cible: "a0" }, zero);
  verifie("un adversaire de rang X est inassimilable (refus, sans mutation)",
          !rX.ok && rX.refus === "inassimilable" && photo(caX) === avantX, JSON.stringify(rX));

  // --- Preemptif ---
  var cp = creer([E("palantir", 1)], [E("hinezumi", 1)], { preemptif: true });
  var premier = K.acteurCourant(cp).id;
  K.jouerActionMulti(cp, { type: "defendre" }, zero);
  verifie("preemptif : les adversaires perdent leur premier tour, puis jouent au tour 2",
          premier === "j0" && cp.tour === 2 && K.acteurCourant(cp).id === "a0", premier + " / tour " + cp.tour);

  // --- Defendre : garde jusqu'a son prochain tour, +10 au tour suivant ---
  // tortuedragon (vit 2) joue en dernier.
  var cDef = creer([E("hinezumi", 5)], [E("tortuedragon", 5)]);
  var cNu  = creer([E("hinezumi", 5)], [E("tortuedragon", 5)]);
  K.jouerActionMulti(cDef, { type: "defendre" }, milieu);
  K.jouerActionMulti(cNu, { type: "attaque", cible: "a0" }, milieu);
  var pvAvantDef = cDef.equipe[0].pv, pvAvantNu = cNu.equipe[0].pv;
  K.jouerActionMulti(cDef, { type: "attaque", cible: "j0" }, milieu);
  K.jouerActionMulti(cNu, { type: "attaque", cible: "j0" }, milieu);
  var subiDef = pvAvantDef - cDef.equipe[0].pv, subiNu = pvAvantNu - cNu.equipe[0].pv;
  verifie("Defendre : les degats subis sont reduits (x" + K.DEFENDRE_REDUCTION + ")",
          subiDef === Math.max(1, Math.round(subiNu * K.DEFENDRE_REDUCTION)) && subiDef < subiNu,
          subiDef + " contre " + subiNu);
  verifie("Defendre : +" + K.DEFENDRE_BONUS_ASSIMILATION + " d'assimilation au tour de table suivant, puis la garde tombe",
          cDef.bonusDefense === K.DEFENDRE_BONUS_ASSIMILATION && cNu.bonusDefense === 0 &&
          cDef.equipe[0].enDefense === true &&
          K.jouerActionMulti(cDef, { type: "attaque", cible: "a0" }, milieu).ok &&
          cDef.equipe[0].enDefense === false,
          cDef.bonusDefense + " / " + cDef.equipe[0].enDefense);

  // --- Fuir ---
  var cf = creer([E("hinezumi", 1)], [E("palantir", 1), E("baku", 10)]);
  cf.adversaires[1].pv = 0;     // le plus haut niveau est KO : on compare au niveau 1
  var rfx = K.jouerActionMulti(cf, { type: "fuir" }, suite([0.6]));
  verifie("fuite ratee : la chance se calcule sur le plus haut adversaire DEBOUT, et le tour passe",
          rfx.ok && rfx.evenements[0].chance === K.FUITE_BASE && rfx.evenements[0].reussi === false &&
          rfx.issue === null && K.acteurCourant(cf).id === "a0",
          JSON.stringify(rfx));
  var cf2 = creer([E("hinezumi", 1)], [E("palantir", 1)]);
  var rf = K.jouerActionMulti(cf2, { type: "fuir" }, suite([0.4]));
  verifie("fuite reussie : le combat se termine sur \"fuite\"",
          rf.issue === "fuite" && K.issueCombatMulti(cf2) === "fuite", JSON.stringify(rf));

  // --- Les aptitudes : immobilise, recharge ---
  // sunwukong niv. 15 connait doubleFrappe, percee, frappeLourde.
  var cap = creer([E("sunwukong", 15)], [E("tortuedragon", 5)]);
  var rap = K.jouerActionMulti(cap, { type: "aptitude", cle: "frappeLourde", cible: "a0" }, milieu);
  K.jouerActionMulti(cap, K.actionAdverse(cap, zero), milieu);   // tortue joue ; tour 2 : sunwukong se repose
  var tour3 = cap.tour, acteur3 = K.acteurCourant(cap).id;
  var avantRech = photo(cap);
  var rRech = K.jouerActionMulti(cap, { type: "aptitude", cle: "frappeLourde", cible: "a0" }, milieu);
  var intactRech = photo(cap) === avantRech;
  verifie("Frappe lourde : degats, puis le tour suivant est perdu (repos automatique)",
          rap.ok && rap.evenements[0].degats > 0 && acteur3 === "a0" && tour3 === 2,
          JSON.stringify(rap) + " / tour " + tour3 + " / " + acteur3);
  K.jouerActionMulti(cap, K.actionAdverse(cap, zero), milieu);   // tour 3 : sunwukong
  var avantRech3 = photo(cap);
  var rRech3 = K.jouerActionMulti(cap, { type: "aptitude", cle: "frappeLourde", cible: "a0" }, milieu);
  var intactRech3 = photo(cap) === avantRech3;
  verifie("une aptitude en recharge est refusee (aptitude_en_recharge), sans mutation ; pas pendant le tour adverse non plus",
          !rRech.ok && rRech.refus === "action_interdite" && intactRech &&
          !rRech3.ok && rRech3.refus === "aptitude_en_recharge" && intactRech3,
          JSON.stringify(rRech) + " " + JSON.stringify(rRech3));

  var cSc = creer([E("komainu", 10)], [E("tortuedragon", 5)]);
  var atqAvant = cSc.adversaires[0].atq;
  K.jouerActionMulti(cSc, { type: "aptitude", cle: "sceau", cible: "a0" }, milieu);
  verifie("Sceau vise un adversaire precis et reduit son ATQ (x" + K.APTITUDES.sceau.affaiblit + ")",
          cSc.adversaires[0].sceau === K.APTITUDES.sceau.affaiblit && cSc.adversaires[0].atq === atqAvant);

  // --- Le combat 1 contre 1 n'a pas bouge ---
  verifie("le moteur ne touche ni au combat du jeu ni au disque",
          K.combat === null && Object.keys(mc.stockage).length === 0, Object.keys(mc.stockage).join(","));

  } catch (e) {
    verifie("combat a plusieurs : les tests vont au bout sans exception", false,
            String(e && e.stack || e).split(/\r?\n/).slice(0, 2).join(" "));
  }


  /* ------------------------------------------------------------
     L'ECRAN DU COMBAT A PLUSIEURS (js/ecran3.js)
     On joue de vrais combats dans le faux navigateur : on touche
     les commandes et les cartes, on fait avancer l'horloge, et on
     regarde l'ecran, le journal et le disque.
     ------------------------------------------------------------ */
  bloc("Combat a plusieurs : l'ecran");

  try {

  // Un monde avec les elements des deux ecrans de combat, et Ico
  // (l'ancien combat l'appelle).
  function mondeC3(stockage) {
    var m = creerMonde({ stockage: stockage || {} });
    ["combat3", "c3-lieu", "c3-adversaires", "c3-ordre", "c3-equipe", "c3-journal",
     "c3-commandes", "c3-aptitudes",
     "combat-lieu", "m-nom", "monstre-img", "monstre-vide", "combat-actions",
     "aptitudes", "liste-aptitudes", "btn-fermer-aptitudes", "figement-bloc",
     "f-jauge", "f-libelle", "f-val", "m-fleche", "m-affinite", "m-pv", "m-jauge", "scene",
     "btn-attaquer", "btn-aptitude", "btn-assimiler", "btn-defendre", "btn-fuir",
     "btn-ico", "ico-pastille", "ico", "ico-portrait", "ico-sections", "ico-fragments",
     "ico-bulle", "ico-bulle-l1", "ico-bulle-l2"].forEach(function (id) {
      m.statiques[id] = creerElement("div");
      m.statiques[id].id = id;
    });
    ["js/ico.js", "js/aide.js"].forEach(function (f) {
      vm.runInContext(fs.readFileSync(path.join(RACINE, f), "utf8"), m.ctx, { filename: f });
    });
    m.ctx.chargerJoueur();
    m.ctx.MODE_TEST = true;     // le terrain d'essai, meme sur la copie de livraison
    return m;
  }

  // L'equipe voulue, enregistree : [["hinezumi", 15], ...]
  function equipeDe(m, liste) {
    m.ctx.collection = {};
    m.ctx.equipe = [];
    liste.forEach(function (e) { m.ctx.ajouterAlaCollection(e[0], e[1]); });
    m.ctx.sauverJoueur();
    // Comme le jeu apres tout changement de collection : Ico note son
    // palier ici, et non pendant le rechargement du combat d'essai.
    m.ctx.majFiche();
  }

  function lieu3(espece, niveau, fictif) {
    return { id: "test/c3/" + espece, lat: 48.85, lon: 2.35, nom: "Lieu d'essai", lieu: "Lieu",
             categorie: "temple", espece: espece, niveau: niveau, figement: 0,
             capture: false, dissipe: false, fictif: !!fictif };
  }

  function fixe(v) { return function () { return v; }; }
  function clic(b) { b.declencher("click", { target: null, stopPropagation: function () {} }); }
  function etat3(m) { return m.ctx.Ecran3.pourTests.etat(); }

  // Avance l'horloge jusqu'a ce que la main revienne (ou la fin).
  function attendreMain(m) {
    for (var i = 0; i < 400; i++) {
      var e = etat3(m);
      if (!e || e.phase === "commande" || e.phase === "fin") return e;
      m.horloge.avancer(250);
    }
    return etat3(m);
  }

  // Attaque la premiere cible jusqu'a la fin du combat. Rend l'issue.
  function finirEnAttaquant(m) {
    for (var i = 0; i < 300; i++) {
      var e = attendreMain(m);
      if (!e || e.phase === "fin") break;
      clic(e.cmd.attaquer);
      if (e.phase === "ciblage") clic(e.cartes[e.cibles[0]].racine);
    }
    m.horloge.avancer(120000);    // le journal de fin
    return etat3(m) && etat3(m).issue;
  }

  function lignes3(m) { return etat3(m).historique.map(function (h) { return h.ligne; }); }
  function contient(liste, morceau) { return liste.some(function (l) { return l.indexOf(morceau) !== -1; }); }

  // --- Le choix de l'ecran : l'ancien reste celui du jeu ---
  var m0 = mondeC3();
  var X0 = m0.ctx, S0 = m0.statiques;
  verifie("COMBAT_MULTI_ACTIF vaut false et l'interrupteur du mode test part sur Non",
          X0.COMBAT_MULTI_ACTIF === false && X0.ModeTest.reglages.multi === false &&
          X0.ModeTest.reglages.adversaires === 1 && X0.COMBAT_MULTI_ADVERSAIRES_LIEU === 1 &&
          X0.Ecran3.choisi() === false);
  X0.Ecran3.lancer(lieu3("komainu", 3), false);
  var actions0 = S0["combat-actions"].innerHTML;
  verifie("reglage a false : Approcher ouvre l'ANCIEN combat, avec ses 5 boutons, et pas le nouveau",
          S0.combat.classList.contains("actif") && !S0.combat3.classList.contains("actif") &&
          X0.combat !== null && !X0.Ecran3.enCours() &&
          ['id="btn-attaquer">Attaquer', 'id="btn-aptitude">Aptitude',
           'id="btn-assimiler" class="assimilation">Assimiler', 'id="btn-defendre">Défendre',
           'id="btn-fuir" class="discret">Fuir'].every(function (b) { return actions0.indexOf(b) !== -1; }),
          actions0);

  var m1 = mondeC3();
  var X1 = m1.ctx;
  X1.ModeTest.reglages.multi = true;
  var parPanneau = X1.Ecran3.choisi();
  X1.MODE_TEST = false;
  var panneauEteint = X1.Ecran3.choisi();
  X1.COMBAT_MULTI_ACTIF = true;
  var parConfig = X1.Ecran3.choisi();
  verifie("l'interrupteur du mode test allume le nouvel ecran ; mode test eteint, il ne compte plus ; COMBAT_MULTI_ACTIF suffit seul",
          parPanneau === true && panneauEteint === false && parConfig === true,
          parPanneau + " / " + panneauEteint + " / " + parConfig);

  // --- Trois adversaires sur le terrain d'essai : le ciblage ---
  var m = mondeC3();
  var X = m.ctx, S = m.statiques;
  equipeDe(m, [["hinezumi", 15], ["jinchan", 3]]);
  X.ModeTest.reglages.multi = true;
  X.ModeTest.reglages.adversaires = 3;
  X.Ecran3.pourTests.reglerAlea(fixe(0));
  var disqueAvant = JSON.stringify(m.stockage);
  var dEssai = lieu3("chiguo", 3, true);

  X.Ecran3.lancer(dEssai, false);
  verifie("mode test sur Oui : le nouvel ecran s'ouvre, l'ancien reste ferme",
          S.combat3.classList.contains("actif") && !S.combat.classList.contains("actif") &&
          X.combat === null && X.Ecran3.enCours());
  var e = attendreMain(m);
  if (!e) throw new Error("le nouvel ecran ne s'est pas ouvert : la suite du bloc est sans objet");
  var c = e.combat;
  var nomChiguo = X.ESPECES.chiguo.nom;
  verifie("le selecteur du mode test decide : 3 adversaires, 3 cartes, nommes A, B, C",
          c.adversaires.length === 3 && S["c3-adversaires"].enfants.length === 3 &&
          e.cartes.a2.nom.textContent === nomChiguo + " C",
          c.adversaires.length + " / " + e.cartes.a2.nom.textContent);

  var ordre = X.ordreDesTours(c).map(function (u) { return e.cartes[u.id].nom.textContent; });
  var jetons = e.jetons.map(function (j) { return j.textContent; });
  var actifs = e.jetons.filter(function (j) { return j.className.indexOf("c3-actif") !== -1; });
  verifie("la barre d'ordre suit ordreDesTours, et met en evidence celui dont c'est le tour",
          jetons.join(",") === ordre.join(",") && actifs.length === 1 &&
          actifs[0].textContent === X.ESPECES.hinezumi.nom &&
          e.cartes.j0.racine.className.indexOf("c3-actif") !== -1 &&
          S["c3-ordre"].enfants[0].textContent === X.txt("c3.tour", { n: 1 }),
          jetons.join(",") + " / " + ordre.join(","));

  var photoAvant = JSON.stringify(c);
  clic(e.cmd.attaquer);
  var ciblables = ["a0", "a1", "a2", "j0", "j1"].filter(function (id) {
    return e.cartes[id].racine.className.indexOf("c3-ciblable") !== -1;
  });
  verifie("Attaquer avec 3 adversaires : on attend une cible, et seuls les 3 adversaires s'allument",
          e.phase === "ciblage" && ciblables.join(",") === "a0,a1,a2" &&
          e.cmd.grille.style.display === "none" && e.cmd.ciblage.style.display === "" &&
          JSON.stringify(c) === photoAvant,
          e.phase + " / " + ciblables.join(","));
  clic(e.cmd.annuler);
  verifie("Annuler revient aux commandes sans rien jouer",
          e.phase === "commande" && JSON.stringify(c) === photoAvant &&
          !["a0", "a1", "a2"].some(function (id) { return e.cartes[id].racine.className.indexOf("c3-ciblable") !== -1; }),
          e.phase);

  clic(e.cmd.attaquer);
  clic(e.cartes.a1.racine);
  verifie("toucher la carte B frappe B, et seulement B",
          c.adversaires[1].pv < c.adversaires[1].pvMax &&
          c.adversaires[0].pv === c.adversaires[0].pvMax && c.adversaires[2].pv === c.adversaires[2].pvMax,
          c.adversaires.map(function (u) { return u.pv + "/" + u.pvMax; }).join(" "));

  var photoOccupe = JSON.stringify(c);
  clic(e.cmd.defendre);
  clic(e.cartes.a0.racine);
  verifie("pendant le recit, les commandes sont eteintes et un appui ne joue rien",
          e.phase === "occupe" && e.cmd.attaquer.disabled && e.cmd.defendre.disabled &&
          JSON.stringify(c) === photoOccupe, e.phase);

  // Jin Chan se defend (deux appuis : le second est un clic fantome).
  e = attendreMain(m);
  verifie("c'est ensuite a Jin Chan", X.acteurCourant(c).id === "j1", X.acteurCourant(c).id);
  clic(e.cmd.defendre);
  clic(e.cmd.defendre);
  m.horloge.avancer(120000);
  var h = e.historique;
  var defenses = h.filter(function (x) { return x.ligne === X.txt("c3.defense", { acteur: X.ESPECES.jinchan.nom }); });
  var iDef = h.indexOf(defenses[0]);
  var apres = h.slice(iDef + 1).filter(function (x) { return x.ligne.indexOf(nomChiguo + " A") === 0; })[0];
  verifie("un double appui sur Defendre ne joue qu'une fois", defenses.length === 1, defenses.length);
  verifie("l'adversaire joue tout seul, apres la pause : DELAI_JOURNAL + COMBAT3_DELAI_ADVERSE",
          !!apres && apres.quand - defenses[0].quand === X.DELAI_JOURNAL + X.COMBAT3_DELAI_ADVERSE,
          apres ? (apres.quand - defenses[0].quand) + " ms" : "aucune action adverse");

  // Assimiler parmi trois : le taux s'affiche sur chaque carte.
  e = attendreMain(m);
  clic(e.cmd.assimiler);
  verifie("Assimiler avec plusieurs cibles : le taux s'affiche sur chaque carte allumee",
          e.phase === "ciblage" && /^\d+ %$/.test(e.cartes.a2.chance.textContent) &&
          e.cartes.j0.chance.textContent === "", e.phase + " / " + e.cartes.a2.chance.textContent);
  clic(e.cartes.a2.racine);
  verifie("l'Echo touche est assimile (alea 0), sa carte le dit",
          c.assimile && c.assimile.id === "a2" &&
          e.cartes.a2.racine.className.indexOf("c3-assimile") !== -1,
          JSON.stringify(c.assimile));

  var issueEssai = finirEnAttaquant(m);
  var fin = etat3(m);
  verifie("le combat d'essai va au bout (victoire), et le bouton de sortie n'arrive qu'apres le recit",
          issueEssai === "victoire" && fin.sortiePrete === true && fin.cmd.sortie.style.display === "",
          issueEssai);
  verifie("combat d'essai : RIEN n'est ecrit sur le disque, meme avec une assimilation et un butin",
          JSON.stringify(m.stockage) === disqueAvant && !X.collection.chiguo,
          Object.keys(m.stockage).join(","));
  var lignesFr = lignes3(m);
  clic(fin.cmd.sortie);
  verifie("Revenir a la carte ferme l'ecran", !S.combat3.classList.contains("actif") && !X.Ecran3.enCours());

  // --- Une arene : un seul adversaire, cible automatique, niveau 1 ---
  var mr = mondeC3();
  var XR = mr.ctx;
  equipeDe(mr, [["hinezumi", 15], ["jinchan", 3]]);
  XR.COMBAT_MULTI_ACTIF = true;
  XR.Ecran3.pourTests.reglerAlea(fixe(0));
  var dR = lieu3("palantir", 3);
  XR.Ecran3.lancer(dR, false);
  var eR = attendreMain(mr);
  var cR = eR.combat;
  verifie("arene : COMBAT_MULTI_ADVERSAIRES_LIEU adversaire(s), soit 1", cR.adversaires.length === 1, cR.adversaires.length);
  var chanceR = XR.chanceAssimilation({ adversaire: cR.adversaires[0], equipe: cR.equipe,
                                        bonusAppel: cR.bonusAppel, bonusDefense: cR.bonusDefense });
  verifie("un seul adversaire : le taux s'affiche sur le bouton Assimiler",
          eR.cmd.assimiler.textContent === XR.txt("c3.cmd.assimilerChance", { chance: chanceR }),
          eR.cmd.assimiler.textContent);
  clic(eR.cmd.attaquer);
  verifie("un seul adversaire debout : Attaquer frappe sans demander de cible",
          eR.phase === "occupe" && cR.adversaires[0].pv < cR.adversaires[0].pvMax, eR.phase);
  eR = attendreMain(mr);
  clic(eR.cmd.assimiler);
  mr.horloge.avancer(120000);
  var savR = JSON.parse(mr.stockage[XR.CLE_JOUEUR]);
  verifie("assimile : il entre au niveau ASSIMILATION_NIVEAU_ENTREE (1), pas au niveau du lieu (3)",
          XR.collection.palantir && XR.collection.palantir.niveau === 1 && savR.collection.palantir.niveau === 1,
          JSON.stringify(XR.collection.palantir));
  verifie("arene reelle : la partie est sauvegardee et le lieu passe a capture",
          dR.capture === true && eR.issue === "victoire", eR.issue);
  var gainR = XR.Ecran3.gainXpParAdversaire(dR, true);
  verifie("XP : une part pour l'adversaire assimile, Fortune comprise (Jin Chan)",
          contient(lignes3(mr), XR.txt("c3.xp.fortune", { gain: gainR })), lignes3(mr).join(" | "));

  // --- Deux KO dans une arene : le butin, une fois par adversaire ---
  var mb = mondeC3();
  var XB = mb.ctx;
  equipeDe(mb, [["hinezumi", 20]]);
  XB.COMBAT_MULTI_ACTIF = true;
  XB.COMBAT_MULTI_ADVERSAIRES_LIEU = 2;
  XB.Ecran3.pourTests.reglerAlea(fixe(0));
  var dB = lieu3("chiguo", 3);
  XB.Ecran3.lancer(dB, false);
  var issueB = finirEnAttaquant(mb);
  var attendu = 2 * XB.butinDeKo(3).nombre;
  var recu = XB.totalFragments(XB.fragmentsEnGourde("chiguo"));
  verifie("victoire par KO a deux : " + attendu + " fragments (un butin par adversaire KO, pas plus)",
          issueB === "victoire" && recu === attendu, issueB + " / " + recu);
  verifie("XP : une part par adversaire KO (deux parts)",
          contient(lignes3(mb), XB.txt("c3.xp", { gain: 2 * XB.Ecran3.gainXpParAdversaire(dB, false) })),
          lignes3(mb).join(" | "));
  verifie("une arene sans assimilation reste ouverte", dB.capture === false);

  // --- Le gate break est lu au demarrage et passe au moteur ---
  var mg = mondeC3();
  var XG = mg.ctx;
  equipeDe(mg, [["hinezumi", 15]]);
  XG.COMBAT_MULTI_ACTIF = true;
  var appel = null;
  XG.malusGateBreak = function (arene, liste, maintenant) { appel = [arene, liste, maintenant]; return 2; };
  var dG = lieu3("palantir", 3);
  XG.Ecran3.lancer(dG, false);
  verifie("gate break : malusGateBreak(lieu, poches, maintenant) au demarrage, et le malus monte le niveau",
          appel && appel[0] === dG && appel[1] === XG.poches && typeof appel[2] === "number" &&
          etat3(mg).combat.adversaires[0].niveau === 5 && etat3(mg).combat.malusGateBreak === 2,
          appel ? etat3(mg).combat.adversaires[0].niveau : "jamais appele");

  // --- Assimiler puis perdre : l'Echo reste, rien d'autre ---
  var md = mondeC3();
  var XD = md.ctx;
  equipeDe(md, [["penghou", 1]]);
  XD.COMBAT_MULTI_ACTIF = true;
  XD.COMBAT_MULTI_ADVERSAIRES_LIEU = 2;
  XD.Ecran3.pourTests.reglerAlea(fixe(0));
  var dD = lieu3("chiguo", 20);
  XD.Ecran3.lancer(dD, true);           // preemptif : on joue en premier
  var eD = attendreMain(md);
  clic(eD.cmd.assimiler);
  clic(eD.cartes.a0.racine);
  var issueD = finirEnAttaquant(md);
  verifie("assimiler puis perdre : defaite, l'Echo est garde au niveau 1, le lieu passe a capture",
          issueD === "defaite" && XD.collection.chiguo && XD.collection.chiguo.niveau === 1 && dD.capture === true,
          issueD + " / " + JSON.stringify(XD.collection.chiguo));
  verifie("defaite : pas de butin de KO",
          XD.totalFragments(XD.fragmentsEnGourde("chiguo")) === 0 && contient(lignes3(md), XD.txt("c3.defaite")),
          XD.totalFragments(XD.fragmentsEnGourde("chiguo")));

  // --- La fuite ---
  var mf = mondeC3();
  var XF = mf.ctx;
  equipeDe(mf, [["hinezumi", 5]]);
  XF.COMBAT_MULTI_ACTIF = true;
  XF.Ecran3.pourTests.reglerAlea(fixe(0));
  var collAvant = JSON.stringify(XF.collection);
  XF.collection.hinezumi.pv = 1;        // il arrive blesse : la fin doit le soigner
  var dF = lieu3("palantir", 3);
  XF.Ecran3.lancer(dF, false);
  var eF = attendreMain(mf);
  clic(eF.cmd.fuir);
  mf.horloge.avancer(120000);
  verifie("fuite reussie : fin du combat, ni butin ni XP, PV rendus, le lieu garde le sien",
          eF.issue === "fuite" && JSON.stringify(XF.collection) === collAvant && dF.capture === false &&
          contient(lignes3(mf), XF.txt("c3.lieuGarde")) && eF.sortiePrete,
          eF.issue);

  // --- Le menu d'aptitudes ---
  var ma3 = mondeC3();
  var XA = ma3.ctx;
  equipeDe(ma3, [["komainu", 10]]);
  XA.ModeTest.reglages.multi = true;
  XA.ModeTest.reglages.adversaires = 2;
  XA.Ecran3.pourTests.reglerAlea(fixe(0.5));
  XA.Ecran3.lancer(lieu3("chiguo", 3, true), false);
  var eA = attendreMain(ma3);
  clic(eA.cmd.aptitude);
  var ouvert = ma3.statiques["c3-aptitudes"].classList.contains("c3-ouvert");
  var cles = Object.keys(eA.boutonsApt).join(",");
  clic(eA.boutonsApt.sceau);
  var apresSceau = eA.phase;
  clic(eA.cmd.annuler);
  clic(eA.cmd.aptitude);
  clic(eA.boutonsApt.rempart);
  verifie("Aptitude : le menu liste celles de l'Echo dont c'est le tour ; Sceau demande une cible, Rempart part tout de suite",
          ouvert && cles === "rempart,sceau" && apresSceau === "ciblage" && eA.phase === "occupe" &&
          eA.combat.equipe[0].recharges.rempart > 0 && !ma3.statiques["c3-aptitudes"].classList.contains("c3-ouvert"),
          ouvert + " / " + cles + " / " + apresSceau + " / " + eA.phase);

  // --- L'XP ne diverge pas de distribuerXp() ---
  var divergences = [];
  [1, 5, 12, 30].forEach(function (niv) {
    [0, 40, 100].forEach(function (fig) {
      [false, true].forEach(function (fortune) {
        var d = { id: "x", espece: "komainu", niveau: niv, figement: fig };
        XR.combat = { donjon: d, equipe: [] };
        var ancien = XR.distribuerXp(fortune).gain;
        var nouveau = XR.Ecran3.gainXpParAdversaire(d, fortune);
        if (ancien !== nouveau) divergences.push(niv + "/" + fig + "/" + fortune + " : " + ancien + " contre " + nouveau);
      });
    });
  });
  XR.combat = null;
  verifie("l'XP d'un adversaire = celle de distribuerXp (niveaux 1 a 30, avec et sans Jin Chan, lieux figes ou non)",
          divergences.length === 0, divergences.join(" | "));

  // --- Les textes ---
  var srcEcran = fs.readFileSync(path.join(RACINE, "js/ecran3.js"), "utf8");
  var clesC3 = [];
  srcEcran.replace(/"(c3\.[a-zA-Z.]+)"/g, function (t, cle) { if (clesC3.indexOf(cle) === -1) clesC3.push(cle); });
  var absentesFr = clesC3.filter(function (k) { return typeof X.TEXTES.fr[k] !== "string"; });
  var absentesEn = clesC3.filter(function (k) { return k.indexOf("c3.cmd.") !== 0 && typeof X.TEXTES.en[k] !== "string"; });
  var cmdEn = clesC3.filter(function (k) { return k.indexOf("c3.cmd.") === 0 && X.TEXTES.en[k] !== undefined; });
  verifie("chaque cle c3.* de l'ecran existe en francais, et en anglais sauf les boutons (c3.cmd.*, francais expres)",
          clesC3.length > 40 && absentesFr.length === 0 && absentesEn.length === 0 && cmdEn.length === 0,
          "fr : " + absentesFr.join(",") + " / en : " + absentesEn.join(",") + " / boutons en : " + cmdEn.join(","));

  function brutes(liste) {
    return liste.filter(function (l) { return /c3\.[a-z]/.test(l) || /[{}]/.test(l) || /undefined|NaN/.test(l); });
  }
  var toutesFr = lignesFr.concat(lignes3(mr), lignes3(mb), lignes3(md), lignes3(mf));
  verifie("journal en francais : aucune cle brute, aucun {jeton}, aucun undefined (" + toutesFr.length + " lignes)",
          toutesFr.length > 30 && brutes(toutesFr).length === 0, brutes(toutesFr).join(" | "));

  var me = mondeC3();
  var XE = me.ctx;
  XE.definirLangue("en");
  equipeDe(me, [["hinezumi", 15], ["jinchan", 3]]);
  XE.ModeTest.reglages.multi = true;
  XE.ModeTest.reglages.adversaires = 2;
  XE.Ecran3.pourTests.reglerAlea(fixe(0));
  XE.Ecran3.lancer(lieu3("chiguo", 3, true), false);
  var eE = attendreMain(me);
  clic(eE.cmd.assimiler);
  clic(eE.cartes.a0.racine);
  finirEnAttaquant(me);
  var lignesEn = lignes3(me);
  verifie("journal en anglais : aucune cle brute, et c'est bien de l'anglais",
          lignesEn.length > 5 && brutes(lignesEn).length === 0 && contient(lignesEn, " hits ") &&
          eE.cmd.attaquer.textContent === "Attaquer",
          brutes(lignesEn).join(" | ") || lignesEn.slice(0, 3).join(" | "));

  verifie("l'ecran ne fait jamais parler Ico (aucune bulle)", srcEcran.indexOf("Ico.") === -1);

  } catch (e3) {
    verifie("ecran du combat a plusieurs : les tests vont au bout sans exception", false,
            String(e3 && e3.stack || e3).split(/\r?\n/).slice(0, 3).join(" "));
  }

  return resultats;
}

module.exports = { lancerParcours: lancerParcours };
