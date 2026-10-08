// Farm viability model. Pure and deterministic: no DOM, no Math.random.
// Loaded by index.html (window.FermeModel) and by Node (require).
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Parameters. Orders of magnitude from the course chapter (Économie rurale:
  // MB ≈ 243 €/1000 L, operational charges ≈ 140 €/1000 L) and from Miserque &
  // Marsin (2019) (family labour imputed at ≈ 10 €/h).
  // ---------------------------------------------------------------------------
  const P = {
    vachesDepart: 60,
    litresParVache: 7500,
    haDepart: 45,
    prixLaitBase: 0.36,            // €/L
    venteAnimauxParVache: 300,     // culled cows and calves sold, €/cow/year
    chargesParVache: 1050,         // feed, care, insemination…, €/cow/year
    seuilVachesParHa: 1.6,         // above this, extra fodder is bought
    fourrageAcheteParVache: 300,   // €/cow above the threshold
    aidesParHa: 650,
    chargesFixesBase: 50000,
    autofinancementCourant: 8000,  // routine equipment renewal paid from own money
    prelevementsFamille: 48000,    // what the family takes to live
    heuresParVache: 45,
    heuresHorsVaches: 2300,
    capaciteFamille: 5800,         // two people
    salaireImpute: 10,             // €/h, 2019 method
    pertePourManque: 0.5,          // share of milk lost per share of work not done
    tauxPret: 0.035,
    tauxDecouvert: 0.07,
    pretExistant: { montant: 120000, duree: 7, debut: 1 },
    actifBase: 700000,
    amortissementsBase: 30000,
    margePareil: 5000,             // "about the same" band for predictions, €
  };

  // Recurring choices (on/off each year) and one-off investments.
  const ACTIONS = {
    agrandir: { type: "investissement", prixPlace: 9000, prixVache: 1800,
                chargesBatimentPct: 0.015, chargesParNouvelleVache: 150, dureeBatiment: 20,
                montee: [0, 0.6, 0.9, 1] },               // share of full yield by years since decision
    robot:    { type: "investissement", prix: 140000, entretien: 6000, heuresEconomisees: 1100,
                gainLait: 0.04, dureeAmortissement: 10 },
    concentres: { type: "recurrent", litresEnPlus: 800, coutParLitre: 0.30 },
    sante:    { type: "recurrent", coutParVache: 70, litresEnPlus: 250, economieParVache: 40 },
    terres:   { type: "recurrent", ha: 15, loyerParHa: 280, heuresParHa: 10 },
    salarie:  { type: "recurrent", heures: 1000, cout: 22000 },
  };
  const RECURRENTS = Object.keys(ACTIONS).filter((k) => ACTIONS[k].type === "recurrent");

  // ---------------------------------------------------------------------------
  // Determinism: a seeded hash of class code and year (method §9).
  // ---------------------------------------------------------------------------
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function anneeCreuse(code) { return 3 + (hash("creux:" + code) % 3); }   // year 3, 4 or 5
  function prixLait(code, annee) {
    const u = hash(code + ":" + annee) / 4294967296;
    let f = 1 + (u - 0.5) * 0.06;
    const creux = anneeCreuse(code);
    if (annee === creux) f *= 0.78;
    if (annee === creux + 1) f *= 0.92;
    return Math.round(P.prixLaitBase * f * 1000) / 1000;
  }

  // ---------------------------------------------------------------------------
  // Loans: constant annuity.
  // ---------------------------------------------------------------------------
  function annuiteConstante(montant, taux, duree) {
    return montant <= 0 ? 0 : (montant * taux) / (1 - Math.pow(1 + taux, -duree));
  }
  function soldeAvant(pret, k) {      // balance at the start of the k-th repayment year (k ≥ 0)
    const r = pret.taux, A = annuiteConstante(pret.montant, r, pret.duree);
    if (k <= 0) return pret.montant;
    if (k >= pret.duree) return 0;
    return pret.montant * Math.pow(1 + r, k) - (A * (Math.pow(1 + r, k) - 1)) / r;
  }
  function echeance(pret, annee) {
    const k = annee - pret.debut;
    if (k < 0) return { annuite: 0, interets: 0, soldeDebut: annee < pret.debut ? 0 : 0, soldeFin: 0, tire: false };
    const A = k < pret.duree ? annuiteConstante(pret.montant, pret.taux, pret.duree) : 0;
    const sd = soldeAvant(pret, k), sf = soldeAvant(pret, k + 1);
    return { annuite: A, interets: k < pret.duree ? sd * pret.taux : 0, soldeDebut: sd, soldeFin: sf, tire: true };
  }

  // A project decided in year d: own share paid in d, loan drawn at the end of d,
  // first repayment in d+1, the asset produces from d+1.
  function coutProjet(p) {
    if (p.action === "agrandir") return p.vaches * (ACTIONS.agrandir.prixPlace + ACTIONS.agrandir.prixVache);
    if (p.action === "robot") return ACTIONS.robot.prix;
    return 0;
  }
  function apportProjet(p) { return Math.round(coutProjet(p) * (p.apportPct || 0) / 100); }
  function pretsDe(projets) {
    const prets = [{ ...P.pretExistant, taux: P.tauxPret, libelle: "pretExistant" }];
    for (const p of projets) {
      const montant = coutProjet(p) - apportProjet(p);
      if (montant > 0) prets.push({ montant, duree: p.duree, debut: p.decide + 1, taux: P.tauxPret, libelle: p.action });
    }
    return prets;
  }

  // ---------------------------------------------------------------------------
  // The 2019 viability method (Miserque & Marsin, SPW/DAEA). Ratios in %, bounded
  // to the ranges observed in the sample; a ratio whose denominator is ≤ 0 takes
  // its unfavourable bound, as the source does for farms B and C of Table 3.
  // ---------------------------------------------------------------------------
  const BORNES = { Rre: [-17, 24], Rrf: [-34, 33], Rrif: [100, 325], Rte: [0, 100],
                   Rpa: [0, 550], Rrd: [0, 2000], Rm: [0, 110], Rcr: [-250, 500] };
  const borner = (k, v) => Math.min(BORNES[k][1], Math.max(BORNES[k][0], v));
  const pct = (num, den, k, pire) => (den <= 0 ? pire : borner(k, (100 * num) / den));
  function ratios(f) {
    const ebeNet = f.ebe - f.remNonSal;
    return {
      Rre:  pct(f.resExpl, f.actif, "Rre", BORNES.Rre[0]),
      Rrf:  pct(f.resCourant, f.capitalPropre, "Rrf", BORNES.Rrf[0]),
      Rrif: f.resCourant <= 0 ? BORNES.Rrif[1] : pct(f.resExpl, f.resCourant, "Rrif", BORNES.Rrif[1]),
      Rte:  pct(f.dettes, f.actif, "Rte", BORNES.Rte[1]),
      Rpa:  pct(f.annuite, ebeNet, "Rpa", BORNES.Rpa[1]),
      Rrd:  pct(f.dettes, ebeNet, "Rrd", BORNES.Rrd[1]),
      Rm:   pct(Math.max(0, ebeNet), f.margeBrute + f.aides, "Rm", BORNES.Rm[0]),
      Rcr:  pct(f.disponible, f.remNonSal, "Rcr", BORNES.Rcr[0]),
    };
  }
  const reclassement = (r) => 5.256 - 0.141 * r.Rte + 0.0093 * r.Rcr - 0.016 * r.Rpa - 0.112 * r.Rrf;
  const prediction = (r) => 2.423 - 0.0715 * r.Rte + 0.0156 * r.Rm - 0.00066 * r.Rrd - 0.0027 * r.Rrif;
  function zoneScore(s) { return s > 0.5 ? "viable" : s < -0.5 ? "risque" : "incertain"; }

  // ---------------------------------------------------------------------------
  // One year. `ferme` = { projets, recurrents, recurrentsPrec, banque }.
  // Returns every line of the cascade, plus hours and the 2019 indicators.
  // ---------------------------------------------------------------------------
  function calculerAnnee(ferme, annee, reglages) {
    const code = (reglages && reglages.codeClasse) || "";
    const projets = ferme.projets || [];
    const rec = ferme.recurrents || {};
    const recPrec = ferme.recurrentsPrec || {};
    const A = ACTIONS;

    // Herd and milk
    let vaches = P.vachesDepart, vachesProductives = P.vachesDepart, vachesNouvelles = 0;
    let robotEnService = false, robotProjet = null;
    for (const p of projets) {
      const age = annee - p.decide;
      if (p.action === "agrandir" && age >= 1) {
        vaches += p.vaches; vachesNouvelles += p.vaches;
        vachesProductives += p.vaches * A.agrandir.montee[Math.min(age, A.agrandir.montee.length - 1)];
      }
      if (p.action === "robot" && age >= 1) { robotEnService = true; robotProjet = p; }
    }
    const santeEffet = !!(rec.sante && recPrec.sante);
    let litresParVache = P.litresParVache + (rec.concentres ? A.concentres.litresEnPlus : 0)
                       + (santeEffet ? A.sante.litresEnPlus : 0);
    if (robotEnService) litresParVache *= 1 + A.robot.gainLait;
    const litresPossibles = vachesProductives * litresParVache;

    // Work: can the family carry it out?
    const ha = P.haDepart + (rec.terres ? A.terres.ha : 0);
    const heuresNecessaires = vaches * P.heuresParVache + P.heuresHorsVaches
      + (rec.terres ? A.terres.ha * A.terres.heuresParHa : 0) - (robotEnService ? A.robot.heuresEconomisees : 0);
    const heuresSalarie = rec.salarie ? A.salarie.heures : 0;
    const heuresFamilleNecessaires = Math.max(0, heuresNecessaires - heuresSalarie);
    const heuresFamille = Math.min(heuresFamilleNecessaires, P.capaciteFamille);
    const heuresManquantes = heuresFamilleNecessaires - heuresFamille;
    const partPerdue = heuresNecessaires > 0 ? P.pertePourManque * heuresManquantes / heuresNecessaires : 0;
    const litres = Math.round(litresPossibles * (1 - partPerdue));
    const litresPerdus = Math.round(litresPossibles) - litres;

    // Money, top to bottom
    const prix = prixLait(code, annee);
    const ventesLait = litres * prix;
    const ventesAnimaux = vaches * P.venteAnimauxParVache;
    const ventes = ventesLait + ventesAnimaux;

    const vachesAuDessus = Math.max(0, vaches - P.seuilVachesParHa * ha);
    const chargesVaches = vaches * P.chargesParVache
      + (rec.concentres ? vachesProductives * A.concentres.litresEnPlus * A.concentres.coutParLitre : 0)
      + (rec.sante ? vaches * A.sante.coutParVache : 0)
      - (santeEffet ? vaches * A.sante.economieParVache : 0)
      + vachesAuDessus * P.fourrageAcheteParVache;
    const margeBrute = ventes - chargesVaches;
    const aides = ha * P.aidesParHa;

    let chargesBatiment = 0, amortissements = P.amortissementsBase, actifProjets = 0, actifProjetsPrec = 0;
    for (const p of projets) {
      const age = annee - p.decide;
      if (p.action === "agrandir" && age >= 0) {
        const batiment = p.vaches * A.agrandir.prixPlace, cheptel = p.vaches * A.agrandir.prixVache;
        const n = A.agrandir.dureeBatiment;
        if (age >= 1) { chargesBatiment += batiment * A.agrandir.chargesBatimentPct + p.vaches * A.agrandir.chargesParNouvelleVache;
                        if (age <= n) amortissements += batiment / n; }
        actifProjets += cheptel + batiment * Math.max(0, 1 - Math.max(0, age) / n);
        actifProjetsPrec += age >= 1 ? cheptel + batiment * Math.max(0, 1 - (age - 1) / n) : 0;
      }
      if (p.action === "robot" && age >= 0) {
        const n = A.robot.dureeAmortissement;
        if (age >= 1 && age <= n) amortissements += A.robot.prix / n;
        actifProjets += A.robot.prix * Math.max(0, 1 - Math.max(0, age) / n);
        actifProjetsPrec += age >= 1 ? A.robot.prix * Math.max(0, 1 - (age - 1) / n) : 0;
      }
    }
    const chargesFixes = P.chargesFixesBase + chargesBatiment
      + (robotEnService ? A.robot.entretien : 0)
      + (rec.terres ? A.terres.ha * A.terres.loyerParHa : 0)
      + (rec.salarie ? A.salarie.cout : 0);
    const ebe = margeBrute + aides - chargesFixes;

    const prets = pretsDe(projets);
    let annuite = 0, interets = 0, dettesDebut = 0, dettesFin = 0;
    for (const pr of prets) {
      const e = echeance(pr, annee);
      annuite += e.annuite; interets += e.interets;
      // A loan drawn at the end of year d is owed from then on.
      if (annee >= pr.debut) dettesDebut += e.soldeDebut;
      if (annee >= pr.debut - 1) dettesFin += annee === pr.debut - 1 ? pr.montant : e.soldeFin;
    }
    let apports = 0;
    for (const p of projets) if (p.decide === annee) apports += apportProjet(p);
    const autofinancement = P.autofinancementCourant + apports;

    const banqueDebut = ferme.banque;
    const interetsDecouvert = banqueDebut < 0 ? -banqueDebut * P.tauxDecouvert : 0;
    const disponible = ebe - annuite - autofinancement - interetsDecouvert;
    const prelevements = P.prelevementsFamille;
    const banqueFin = banqueDebut + disponible - prelevements;

    // Family pay and the 2019 indicators
    const remNonSal = heuresFamille * P.salaireImpute;
    const gainHoraire = heuresFamille > 0 ? disponible / heuresFamille : 0;
    const resExpl = ebe - remNonSal - amortissements;
    const resCourant = resExpl - interets - interetsDecouvert;
    const dettesMoy = (dettesDebut + Math.max(0, -banqueDebut) + dettesFin + Math.max(0, -banqueFin)) / 2;
    const actifMoy = P.actifBase + (actifProjets + actifProjetsPrec) / 2;
    const r = ratios({ margeBrute, ebe, aides, remNonSal, resExpl, resCourant, disponible, annuite,
                       dettes: dettesMoy, capitalPropre: actifMoy - dettesMoy, actif: actifMoy });
    const score = reclassement(r);

    return {
      annee, prix, vaches, vachesNouvelles, vachesProductives, litresParVache, litres, litresPerdus, ha,
      vachesParHa: vaches / ha,
      heuresNecessaires, heuresSalarie, heuresFamilleNecessaires, heuresFamille, heuresManquantes,
      capaciteFamille: P.capaciteFamille,
      ventesLait, ventesAnimaux, ventes, chargesVaches, margeBrute, aides, chargesFixes, ebe,
      annuite, interets, autofinancement, apports, interetsDecouvert, disponible,
      prelevements, banqueDebut, banqueFin,
      remNonSal, gainHoraire, amortissements, resExpl, resCourant,
      dettesFin: dettesFin + Math.max(0, -banqueFin), dettesMoy, actifMoy,
      ratios: r, score, zone: zoneScore(score), scorePrediction: prediction(r),
    };
  }

  // "Continuing as before": the same years, the same prices, no new decisions. `base` is
  // what the farm already had when the situation began (by default: nothing).
  function trajectoireReference(reglages, jusqua, base) {
    const b = base || { projets: [], recurrents: {} };
    const out = [];
    let banque = reglages.banqueDepart;
    for (let a = 1; a <= jusqua; a++) {
      const rep = calculerAnnee({ projets: b.projets, recurrents: b.recurrents, recurrentsPrec: b.recurrents, banque }, a, reglages);
      out.push(rep); banque = rep.banqueFin;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Prediction loop (method §15–16). One question, three answers, in the words
  // the instrument uses to answer.
  // ---------------------------------------------------------------------------
  const CHOIX = ["plus", "pareil", "moins"];
  function verdict(plan, ref) {
    const d = plan.disponible - ref.disponible;
    return d > P.margePareil ? "plus" : d < -P.margePareil ? "moins" : "pareil";
  }
  // Partition of the gap in "reste pour la famille" between the plan and the
  // reference. The parts add up exactly to the gap.
  const PARTS = [
    ["ventes", +1], ["chargesVaches", -1], ["aides", +1], ["chargesFixes", -1],
    ["annuite", -1], ["autofinancement", -1], ["interetsDecouvert", -1],
  ];
  function decomposer(plan, ref) {
    const parts = PARTS.map(([cle, signe]) => ({ cle, effet: signe * (plan[cle] - ref[cle]) }))
      .filter((p) => Math.abs(p.effet) >= 0.5);
    parts.sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet));
    return { ecart: plan.disponible - ref.disponible, parts };
  }
  function adjuger(choix, plan, ref) {
    const v = verdict(plan, ref);
    const d = decomposer(plan, ref);
    // The runner-up answer and how far the outcome was from it: how close the call was.
    const e = d.ecart, m = P.margePareil;
    const plusProche = v === "plus" ? { choix: "pareil", distance: e - m }
      : v === "moins" ? { choix: "pareil", distance: -m - e }
      : e >= 0 ? { choix: "plus", distance: m - e } : { choix: "moins", distance: e + m };
    return { choix, verdict: v, juste: choix === v, ecart: e, parts: d.parts, plusProche,
             litresPlan: plan.litres, litresRef: ref.litres };
  }

  const api = { P, ACTIONS, RECURRENTS, CHOIX, hash, prixLait, anneeCreuse, annuiteConstante, echeance,
                pretsDe, coutProjet, apportProjet, ratios, reclassement, prediction, zoneScore, BORNES,
                calculerAnnee, trajectoireReference, verdict, decomposer, adjuger };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FermeModel = api;
})(typeof window !== "undefined" ? window : globalThis);
