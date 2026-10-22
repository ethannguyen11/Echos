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
                "js/joueur.js", "js/fragments.js", "js/poche.js", "js/combat.js", "js/grimoire.js", "js/intro.js",
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

  return resultats;
}

module.exports = { lancerParcours: lancerParcours };
