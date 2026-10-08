// Game state and transitions. No DOM: the interface (app.js), the course (cours.js)
// and the tests all drive it.
(function (root) {
  "use strict";
  const M = root.FermeModel || require("./model.js");

  const REGLAGES_DEFAUT = { codeClasse: "LIEGE", codeEquipe: "", niveauMots: 0,
                            banqueDepart: 40000, limiteDecouvert: 50000, horizon: 8 };
  // Changing one of these restarts the game; the others apply immediately.
  const REGLAGES_QUI_RECOMMENCENT = ["codeClasse", "banqueDepart", "horizon"];
  const OPTIONS = { vaches: [15, 30], duree: [10, 15, 20], apportPct: [0, 10, 25] };

  // Situations: where the farm starts, what may be decided, for how many years.
  // `base` is what the farm already has; "continuing as before" starts from it.
  const SITUATIONS = {
    D: { horizon: 2, decisions: [], banqueDepart: 40000, base: { projets: [], recurrents: {} } },
    A: { horizon: 3, decisions: ["concentres", "sante"], banqueDepart: 40000, base: { projets: [], recurrents: {} } },
    B: { horizon: 4, decisions: ["agrandir", "salarie", "terres"], banqueDepart: 40000, base: { projets: [], recurrents: {} } },
    C: { horizon: 3, decisions: ["robot", "salarie", "terres"], banqueDepart: 15000,
         base: { projets: [{ id: 0, action: "agrandir", vaches: 30, duree: 15, apportPct: 10, decide: 0 }], recurrents: {} } },
    L: { horizon: 8, decisions: ["agrandir", "concentres", "sante", "terres", "robot", "salarie"], banqueDepart: null,
         base: { projets: [], recurrents: {} } },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function nouvellePartie(reglages, situation) {
    const id = SITUATIONS[situation] ? situation : "L";
    const sit = SITUATIONS[id];
    const r = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
    if (id !== "L") { r.horizon = sit.horizon; r.banqueDepart = sit.banqueDepart; }
    return { version: 2, situation: id, reglages: r, base: clone(sit.base), annee: 1,
             projets: clone(sit.base.projets), recurrents: clone(sit.base.recurrents), recurrentsPrec: clone(sit.base.recurrents),
             banque: r.banqueDepart, annees: [], predictions: [], pile: [], termine: false, prochainId: 1 };
  }

  const permis = (s, cle) => SITUATIONS[s.situation || "L"].decisions.includes(cle);
  const fermeDe = (s) => ({ projets: s.projets, recurrents: s.recurrents, recurrentsPrec: s.recurrentsPrec, banque: s.banque });
  function reference(s, annee) { return M.trajectoireReference(s.reglages, annee, s.base)[annee - 1]; }
  function trajectoire(s, jusqua) { return M.trajectoireReference(s.reglages, jusqua, s.base); }

  // The figures shown while planning. Passing the year delivers exactly these.
  function apercu(s) {
    return { plan: M.calculerAnnee(fermeDe(s), s.annee, s.reglages), ref: reference(s, s.annee) };
  }

  // What the family wants. Not a score: four wishes that cannot all be met at once.
  // Hours are compared with what the family worked in year 1 of continuing as before.
  const OBJECTIFS = ["lait", "banque", "heures", "horaire"];
  function objectifs(s, plan, ref) {
    const h0 = reference(s, 1).heuresFamille;
    return {
      lait: plan.litres > ref.litres,
      banque: plan.banqueFin >= 0,
      heures: plan.heuresManquantes === 0 && plan.heuresFamille <= h0 + 0.5,
      horaire: plan.gainHoraire >= M.P.salaireImpute,
    };
  }

  function ajouterProjet(s, o) {
    if (s.termine) throw new Error("partie terminée");
    if (!["agrandir", "robot"].includes(o.action) || !permis(s, o.action)) throw new Error("action non disponible");
    if (!OPTIONS.duree.includes(o.duree) || !OPTIONS.apportPct.includes(o.apportPct)) throw new Error("option invalide");
    if (o.action === "agrandir" && !OPTIONS.vaches.includes(o.vaches)) throw new Error("option invalide");
    if (o.action === "robot" && s.projets.some((p) => p.action === "robot")) throw new Error("un seul robot");
    const p = { id: s.prochainId++, action: o.action, duree: o.duree, apportPct: o.apportPct, decide: s.annee };
    if (o.action === "agrandir") p.vaches = o.vaches;
    s.projets.push(p);
    return p;
  }
  function retirerProjet(s, id) {
    const i = s.projets.findIndex((p) => p.id === id && p.decide === s.annee);
    if (i >= 0) s.projets.splice(i, 1);
  }
  function basculer(s, cle, valeur) {
    if (!M.RECURRENTS.includes(cle) || !permis(s, cle)) throw new Error("action non disponible");
    s.recurrents = { ...s.recurrents, [cle]: !!valeur };
  }

  function prendPret(p) { return M.coutProjet(p) - M.apportProjet(p) > 0; }

  // Resolve the year. The prediction aimed at this year is adjudicated BEFORE the
  // new one (aimed at next year) is recorded (method §15).
  function passerAnnee(s, entree) {
    if (s.termine) throw new Error("partie terminée");
    const e = entree || {};
    const avant = JSON.stringify({ ...s, pile: [] });
    const Y = s.annee;
    const { plan, ref } = apercu(s);

    const attendue = s.predictions.find((p) => p.cible === Y);
    let adjudication = null;
    if (attendue) {
      adjudication = { ...M.adjuger(attendue.choix, plan, ref), faiteEn: attendue.faiteEn,
                       choix2: attendue.choix2 || null, apresPret: attendue.apresPret };
      adjudication.juste2 = attendue.choix2 ? attendue.choix2 === adjudication.verdict : null;
    }

    const projetsAnnee = s.projets.filter((p) => p.decide === Y).map((p) => ({ ...p }));
    s.annees.push({
      annee: Y, plan, ref, adjudication, objectifs: objectifs(s, plan, ref),
      decisions: { projets: projetsAnnee, recurrents: { ...s.recurrents }, recurrentsPrec: { ...s.recurrentsPrec } },
      notes: { pourquoi: e.pourquoi || "", attendu: e.attendu || "", observe: "" },
      banqueBloquee: plan.banqueFin < -s.reglages.limiteDecouvert,
    });

    if (e.choix && M.CHOIX.includes(e.choix) && Y < s.reglages.horizon) {
      s.predictions.push({ faiteEn: Y, cible: Y + 1, choix: e.choix,
                           choix2: M.CHOIX.includes(e.choix2) && e.choix2 !== e.choix ? e.choix2 : null,
                           apresPret: projetsAnnee.some(prendPret) });
    }
    s.banque = plan.banqueFin;
    s.recurrentsPrec = { ...s.recurrents };
    s.annee = Y + 1;
    s.termine = s.annee > s.reglages.horizon;
    s.pile.push(avant);
    if (s.pile.length > 30) s.pile.shift();
    return s.annees[s.annees.length - 1];
  }

  function revenir(s) {
    if (!s.pile.length) return s;
    const pile = s.pile.slice(0, -1);
    const prec = JSON.parse(s.pile[s.pile.length - 1]);
    prec.pile = pile;
    prec.reglages = { ...prec.reglages, niveauMots: s.reglages.niveauMots, codeEquipe: s.reglages.codeEquipe,
                      limiteDecouvert: s.reglages.limiteDecouvert };
    return prec;
  }

  function changerReglages(s, nouveaux) {
    const r = { ...s.reglages, ...nouveaux };
    const recommence = REGLAGES_QUI_RECOMMENCENT.some((k) => r[k] !== s.reglages[k]);
    if (recommence) return nouvellePartie(r, s.situation);
    s.reglages = r;
    return s;
  }

  function noterObserve(s, annee, texte) {
    const a = s.annees.find((x) => x.annee === annee);
    if (a) a.notes.observe = String(texte || "");
  }

  // First committed prediction about a year that followed a loan: the cohort diagnostic.
  function diagnostic(s) {
    const a = s.annees.find((x) => x.adjudication && x.adjudication.apresPret);
    return a ? { faiteEn: a.adjudication.faiteEn, annee: a.annee, choix: a.adjudication.choix,
                 verdict: a.adjudication.verdict, juste: a.adjudication.juste } : null;
  }

  const CHIFFRES_EXPORT = ["prix", "vaches", "litres", "litresPerdus", "vachesParHa", "ventes", "chargesVaches",
    "margeBrute", "aides", "chargesFixes", "ebe", "annuite", "autofinancement", "interetsDecouvert", "disponible",
    "prelevements", "banqueFin", "heuresFamille", "heuresManquantes", "gainHoraire", "dettesFin", "score"];
  const garder = (r) => Object.fromEntries(CHIFFRES_EXPORT.map((k) => [k, Math.round(r[k] * 1000) / 1000]));
  function exporter(s) {
    return {
      format: "ferme-viabilite/2", situation: s.situation, reglages: s.reglages, diagnostic: diagnostic(s),
      annees: s.annees.map((a) => ({ annee: a.annee, decisions: a.decisions, notes: a.notes, objectifs: a.objectifs,
        adjudication: a.adjudication && { ...a.adjudication, parts: a.adjudication.parts.map((p) => ({ ...p, effet: Math.round(p.effet) })) },
        banqueBloquee: a.banqueBloquee, plan: garder(a.plan), reference: garder(a.ref) })),
      predictionsEnAttente: s.predictions.filter((p) => p.cible >= s.annee),
    };
  }

  const api = { REGLAGES_DEFAUT, OPTIONS, SITUATIONS, OBJECTIFS, nouvellePartie, permis, apercu, reference, trajectoire,
                objectifs, ajouterProjet, retirerProjet, basculer, passerAnnee, revenir, changerReglages, noterObserve,
                diagnostic, exporter, garder };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FermeJeu = api;
})(typeof window !== "undefined" ? window : globalThis);
