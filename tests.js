// Behavioural guards. Run: node tests.js ; read the exit code, not the output.
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const M = require("./model.js");
const J = require("./jeu.js");
const V = require("./vocab.js");

let echecs = 0, total = 0;
function verifier(nom, cond, detail) {
  total++;
  if (!cond) { echecs++; console.log(`ÉCHEC  ${nom}${detail ? " — " + detail : ""}`); }
}
const proche = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// Scenario helper: a fresh game, decisions per year, prediction per year.
function jouer(code, plan, annees) {
  let s = J.nouvellePartie({ codeClasse: code });
  for (let a = 1; a <= annees; a++) {
    const d = plan[a] || {};
    for (const p of d.projets || []) J.ajouterProjet(s, p);
    for (const [k, v] of Object.entries(d.recurrents || {})) J.basculer(s, k, v);
    J.passerAnnee(s, { choix: d.choix, choix2: d.choix2 });
  }
  return s;
}
const AGRANDIR = { action: "agrandir", vaches: 30, duree: 15, apportPct: 10 };

// 1. The 2019 equations reproduce the source's worked example (separate script, its own exit code).
{
  const r = spawnSync(process.execPath, ["outils/verifier-equations.js"], { cwd: __dirname, encoding: "utf8" });
  verifier("Tableau 3 du rapport 2019 reproduit", r.status === 0, (r.stdout || "").trim());
}

// 2. Determinism: same inputs, same year; class code changes the price path.
{
  const f = { projets: [{ ...AGRANDIR, id: 1, decide: 1 }], recurrents: { sante: true }, recurrentsPrec: { sante: true }, banque: 1000 };
  const a = M.calculerAnnee(f, 3, { codeClasse: "X" }), b = M.calculerAnnee(f, 3, { codeClasse: "X" });
  verifier("même entrée, même résultat", JSON.stringify(a) === JSON.stringify(b));
  const prixA = [1, 2, 3, 4, 5, 6, 7, 8].map((y) => M.prixLait("LIEGE", y)).join();
  const prixB = [1, 2, 3, 4, 5, 6, 7, 8].map((y) => M.prixLait("NAMUR", y)).join();
  verifier("le code de classe change les prix", prixA !== prixB);
  const s1 = jouer("EQUIPE", { 1: { projets: [AGRANDIR] } }, 4), s2 = jouer("EQUIPE", { 1: { projets: [AGRANDIR] } }, 4);
  verifier("deux équipes, même code, mêmes décisions : mêmes chiffres",
    JSON.stringify(s1.annees.map((x) => x.plan)) === JSON.stringify(s2.annees.map((x) => x.plan)));
}

// 3. With no decision, the farm IS the reference, every year.
{
  const s = jouer("LIEGE", {}, 8);
  verifier("sans décision, la ferme suit « continuer comme avant »",
    s.annees.every((a) => proche(a.plan.disponible, a.ref.disponible) && proche(a.plan.banqueFin, a.ref.banqueFin)));
}

// 4. The cascade reconciles exactly, each year, on a busy plan.
{
  const s = jouer("LIEGE", { 1: { projets: [AGRANDIR], recurrents: { sante: true, concentres: true } },
                             2: { projets: [{ action: "robot", duree: 10, apportPct: 0 }], recurrents: { terres: true } },
                             3: { recurrents: { salarie: true } } }, 8);
  let ok = true, ecart = "";
  for (const { plan: r } of s.annees) {
    const tests = [[r.ventes - r.chargesVaches, r.margeBrute], [r.margeBrute + r.aides - r.chargesFixes, r.ebe],
      [r.ebe - r.annuite - r.autofinancement - r.interetsDecouvert, r.disponible],
      [r.banqueDebut + r.disponible - r.prelevements, r.banqueFin], [r.ventesLait + r.ventesAnimaux, r.ventes]];
    tests.forEach(([x, y], i) => { if (!proche(x, y)) { ok = false; ecart = `année ${r.annee}, égalité ${i}`; } });
  }
  verifier("la cascade se reconstitue au centime", ok, ecart);
  verifier("le plan chargé a bien un découvert à un moment (sinon la ligne n'est pas testée)",
    s.annees.some((a) => a.plan.interetsDecouvert > 0));
}

// 5. Exact means exact: the figures shown while planning are the figures delivered.
{
  const s = J.nouvellePartie({ codeClasse: "LIEGE" });
  J.passerAnnee(s, {});
  J.ajouterProjet(s, AGRANDIR); J.basculer(s, "sante", true);
  const montre = JSON.stringify(J.apercu(s).plan);
  const livre = JSON.stringify(J.passerAnnee(s, {}).plan);
  verifier("aperçu = résultat livré", montre === livre);
}

// 6. Undo, then the same decisions, reproduces the year exactly.
{
  const s0 = jouer("LIEGE", { 1: { projets: [AGRANDIR] } }, 2);
  const avant = JSON.stringify(s0.annees[1]);
  let s = J.revenir(s0);
  verifier("revenir retire la dernière année", s.annee === 2 && s.annees.length === 1);
  J.passerAnnee(s, {});
  verifier("revenir puis rejouer redonne la même année", JSON.stringify(s.annees[1]) === avant);
}

// 7. Prediction loop: adjudicated before replaced; the model's answer is always one of the choices.
{
  const s = jouer("LIEGE", { 1: { projets: [AGRANDIR], choix: "plus", choix2: "moins" }, 2: { choix: "pareil" } }, 2);
  const a2 = s.annees[1];
  verifier("la prévision de l'année 1 est jugée en année 2", a2.adjudication && a2.adjudication.faiteEn === 1 && a2.adjudication.choix === "plus");
  verifier("l'avis différent est jugé aussi", a2.adjudication.choix2 === "moins" && a2.adjudication.juste2 === (a2.adjudication.verdict === "moins"));
  verifier("la nouvelle prévision vise l'année 3", s.predictions.some((p) => p.faiteEn === 2 && p.cible === 3 && p.choix === "pareil"));
  verifier("la réponse du modèle est parmi les choix", M.CHOIX.includes(a2.adjudication.verdict));
  const somme = a2.adjudication.parts.reduce((t, p) => t + p.effet, 0);
  verifier("les parts expliquent tout l'écart", proche(somme, a2.adjudication.ecart, 1),
    `${Math.round(somme)} vs ${Math.round(a2.adjudication.ecart)}`);
  const pp = a2.adjudication.plusProche;
  verifier("la réponse la plus proche est une autre réponse, à distance positive", pp.choix !== a2.adjudication.verdict && pp.distance >= 0);
  const s3 = jouer("LIEGE", { 1: { choix: "plus" } }, 8);
  verifier("pas de prévision demandée au-delà de la dernière année", !s3.predictions.some((p) => p.cible > 8));
}

// 8. The contradiction surfaces, and it is a DELAY, not just a loss — for several class codes.
for (const code of ["LIEGE", "NAMUR", "ARLON", "MONS"]) {
  const s = jouer(code, { 1: { projets: [AGRANDIR] } }, 8);
  const y2 = s.annees[1];
  verifier(`${code} : l'année après l'investissement, plus de lait (> +15 %)`, y2.plan.litres > 1.15 * y2.ref.litres);
  verifier(`${code} : et un reste pour la famille plus bas`, M.verdict(y2.plan, y2.ref) === "moins",
    `écart ${Math.round(y2.plan.disponible - y2.ref.disponible)}`);
  verifier(`${code} : plus tard, le signe s'inverse`, s.annees.slice(3).some((a) => M.verdict(a.plan, a.ref) === "plus"));
}

// 9. Loans: principal repaid over the term equals the amount borrowed.
{
  const pret = { montant: 291600, duree: 15, debut: 2, taux: M.P.tauxPret };
  let capital = 0;
  for (let y = 2; y < 2 + 15; y++) { const e = M.echeance(pret, y); capital += e.annuite - e.interets; }
  verifier("le capital remboursé égale le montant emprunté", proche(capital, pret.montant, 0.01));
  verifier("rien à rembourser après la durée", M.echeance(pret, 17).annuite === 0);
}

// 10. The defensible-but-wrong rule is kept verbatim: higher financial return LOWERS the official score.
{
  const r = { Rte: 30, Rcr: 100, Rpa: 80, Rrf: 5 };
  verifier("règle officielle conservée : Rrf plus haut, note plus basse", M.reclassement({ ...r, Rrf: 15 }) < M.reclassement(r));
}

// 11. Settings survive a restart; a restart is triggered only by the settings that change the world.
{
  let s = jouer("LIEGE", {}, 2);
  s = J.changerReglages(s, { niveauMots: 2, codeEquipe: "T7" });
  verifier("changer les mots du cours ne recommence pas", s.annee === 3 && s.reglages.niveauMots === 2);
  s = J.changerReglages(s, { codeClasse: "NAMUR" });
  verifier("changer le code de classe recommence en gardant les réglages",
    s.annee === 1 && s.reglages.niveauMots === 2 && s.reglages.codeEquipe === "T7" && s.reglages.codeClasse === "NAMUR");
  const r = J.revenir(jouer("LIEGE", {}, 2));
  verifier("revenir garde le niveau de mots actuel", r.reglages.niveauMots === 0);
}

// 12. Diagnostic: first prediction about a year that followed a loan.
{
  const s = jouer("LIEGE", { 1: { choix: "pareil" }, 2: { projets: [AGRANDIR], choix: "plus" } }, 3);
  const d = J.diagnostic(s);
  verifier("le diagnostic retient la prévision faite l'année du prêt", d && d.faiteEn === 2 && d.annee === 3 && d.choix === "plus");
}

// 13. Vocabulary contract: no course term in anything a student reads at level 0.
{
  const TECH = ["EBE", "excédent", "marge brute", "annuité", "autofinancement", "disponible", "charges opérationnelles",
                "charges fixes", "trésorerie", "prélèvement", "produits", "Rcr", "Rte", "Rpa", "Rrf", "reclassement",
                "main d'œuvre", "PAC"];
  const textes = [];
  const parcourir = (o) => { if (typeof o === "string") textes.push(o); else if (typeof o === "function") textes.push(o(1, 8)); else if (o && typeof o === "object") Object.values(o).forEach(parcourir); };
  parcourir(V.UI); parcourir(V.ACTIONS);
  for (const t of Object.values(V.TERMES)) textes.push(t.simple, t.phrase, t.ou);
  const motEntier = (w) => new RegExp(`(^|[^\\p{L}])${w}(?![\\p{L}])`, "iu");
  const fautes = textes.filter((t) => TECH.some((w) => motEntier(w).test(t)));
  verifier("aucun mot du cours dans les textes simples", fautes.length === 0, fautes.slice(0, 3).join(" | "));
  // app.js may name ratios only inside the level-3 block.
  const src = fs.readFileSync(__dirname + "/app.js", "utf8").split("\n");
  const hors = [];
  src.forEach((l, i) => {
    // Keys are not displayed: nom("ebe"), plan.disponible, data-x="…", and any single lowercase identifier in quotes.
    const affiche = l.replace(/\/\/.*$/, "").replace(/\b(nom|g|simple)\("\w+"/g, "").replace(/\.\w+/g, "")
      .replace(/data-[\w-]+="[^"]*"/g, "").replace(/"[a-z][A-Za-z]*"/g, "").replace(/\["Rte", "Rpa", "Rcr", "Rrf"\]/g, "");
    if (TECH.some((w) => new RegExp(`\\b${w}\\b`, "i").test(affiche))) {
      const bloc = src.slice(Math.max(0, i - 6), i + 1).join("\n");
      if (!/niveauMots >= 3/.test(bloc)) hors.push(`app.js:${i + 1}`);
    }
  });
  verifier("app.js ne nomme aucun mot du cours hors du bloc de niveau 3", hors.length === 0, hors.join(", "));
}

// 14. Situations: each starts from its own farm, offers only its decisions, and "continuing
// as before" starts from what the farm already has.
{
  const C = J.nouvellePartie({ codeClasse: "LIEGE" }, "C");
  verifier("situation C : continuer comme avant inclut l'agrandissement déjà fait", J.reference(C, 1).vaches === 90);
  const A0 = J.nouvellePartie({ codeClasse: "LIEGE" }, "A");
  let refuse = false; try { J.ajouterProjet(A0, AGRANDIR); } catch (e) { refuse = true; }
  verifier("situation A : agrandir n'est pas proposé", refuse);
  const B0 = J.nouvellePartie({ codeClasse: "LIEGE" }, "B");
  const o = J.objectifs(B0, J.apercu(B0).plan, J.apercu(B0).ref);
  verifier("au départ : seul le souhait de Léo n'est pas atteint", !o.lait && o.banque && o.heures && o.horaire);
  J.ajouterProjet(B0, AGRANDIR); J.passerAnnee(B0, {});
  const o2 = J.objectifs(B0, J.apercu(B0).plan, J.apercu(B0).ref);
  verifier("année 2 du plan de Léo : son souhait est atteint", o2.lait);
  verifier("année 2 du plan de Léo : le souhait de Marc tombe (heures)", !o2.heures);
  verifier("année 2 du plan de Léo : les 10 € de l'heure tombent", !o2.horaire);
}

// 15. The course's answer keys are true in the model (if the model changes, the course must too).
{
  const Co = require("./cours.js");
  const conc = Co.calc("concentres"), s2 = Co.calc("sante2"), s1 = Co.calc("sante1"), leo = Co.calc("leo");
  verifier("cours qA1 : les concentrés font vendre plus de lait", conc.lait > s2.lait);
  verifier("cours qA2 : le plan de santé laisse plus par litre", s2.total / s2.lait > conc.total / conc.lait);
  verifier("cours qA3 : le plan de santé coûte avant de rapporter", s1.total < 0 && s2.total > 0);
  const y2 = leo.annees[1], p1 = leo.plans[0], p2 = leo.plans[1], r2 = leo.refs[1];
  verifier("cours qB1 : année 2, plus de lait et moins pour la famille", y2.lait > 0 && y2.total < -M.P.margePareil);
  verifier("cours qB1 : ni le prix ni les aides n'expliquent la baisse", p2.prix === p1.prix && p2.aides === r2.aides);
  verifier("cours : le calcul à la main de l'année 2 surestime les ventes (heures manquantes)",
    leo.naif2 > y2.ventes + 1000 && p2.heuresManquantes > 0 && p2.litresPerdus > 0);
  const d = Co.calc("depart");
  const oD = J.objectifs(J.nouvellePartie({ codeClasse: "LIEGE" }, "D"), d.plan, d.ref);
  verifier("cours q_souhait : au départ, seul le souhait « lait » manque", !oD.lait && oD.banque && oD.heures && oD.horaire);
  verifier("cours : lecture des nombres tapés", Co.lireNombre("65 025 €") === 65025 && Co.lireNombre("13,4") === 13.4 && Co.lireNombre("65.025") === 65025);
}

// 16. No figure is typed into the course: every number of 1 000 or more is computed (method §28).
{
  const src = fs.readFileSync(__dirname + "/cours.js", "utf8").replace(/\/\/.*$/gm, "");
  const tapes = src.match(/\b[1-9]\d{0,2}(?:[ \u00a0.]\d{3})+\b|\b\d{4,}\b/g) || [];
  verifier("aucun chiffre tapé à la main dans le carnet", tapes.length === 0, tapes.slice(0, 5).join(", "));
}

// 17. Every figure written on a decision card exists in the model.
{
  const vals = new Set();
  const plat = (o) => Object.values(o).forEach((v) => (typeof v === "number" ? vals.add(Math.round(v * 1000) / 1000) : v && typeof v === "object" && plat(v)));
  plat(M.P); plat(M.ACTIONS);
  const Ag = M.ACTIONS.agrandir;
  [Ag.prixPlace + Ag.prixVache, Ag.prixPlace * Ag.chargesBatimentPct + Ag.chargesParNouvelleVache,
   M.P.seuilVachesParHa * M.P.haDepart].forEach((x) => vals.add(Math.round(x * 1000) / 1000));
  const inconnus = [];
  for (const a of Object.values(V.ACTIONS)) for (const t of [a.texte, a.cout, a.quand, a.bon || ""]) {
    for (const m of t.match(/\d{1,3}(?:[ \u00a0]\d{3})+|\d+(?:,\d+)?/g) || []) {
      const x = Number(m.replace(/[ \u00a0]/g, "").replace(",", "."));
      if (!vals.has(x) && !vals.has(Math.round(x / 100 * 1000) / 1000)) inconnus.push(m);
    }
  }
  verifier("les chiffres des cartes de décision viennent du modèle", inconnus.length === 0, inconnus.join(", "));
}

// 18. The course uses a course word only once a step has switched that word on.
{
  const Co = require("./cours.js");
  const TECH = { 1: ["produits", "charges opérationnelles", "marge brute", "situation de référence"],
                 2: ["EBE", "excédent", "annuité", "autofinancement", "disponible", "prélèvement", "trésorerie", "charges fixes"],
                 3: ["Rcr", "Rte", "Rpa", "Rrf", "reclassement", "main d'œuvre non salariée"] };
  let atteint = 0;
  const fautes = [];
  const texte = (b) => Object.values(b).map((v) => typeof v === "function" ? v.toString() : typeof v === "object" ? JSON.stringify(v) : String(v)).join(" ")
    .replace(/\.\w+/g, "").replace(/"[a-z][A-Za-z0-9]*"/g, "").replace(/\b[a-z]+[A-Z]\w*/g, "");
  for (const et of Co.ETAPES) {
    atteint = Math.max(atteint, et.niveau || 0);
    const t = et.blocs.map(texte).join(" ") + " " + et.titre;
    for (const [niv, mots] of Object.entries(TECH)) if (Number(niv) > atteint)
      for (const w of mots) if (new RegExp(`(^|[^\\p{L}])${w}(?![\\p{L}])`, "iu").test(t)) fautes.push(`${et.id}: ${w}`);
  }
  verifier("le carnet ne nomme un mot du cours qu'après l'avoir fait voir", fautes.length === 0, fautes.join(", "));
}

// 19. The course's tools and fixed texts can show at any step, so they use no course word at all.
{
  const src = fs.readFileSync(__dirname + "/cours.js", "utf8");
  const hors = src.slice(0, src.indexOf("const ETAPES = [")) + src.slice(src.indexOf("\n  ];", src.indexOf("const ETAPES = [")));
  const affiche = hors.replace(/\/\/.*$/gm, "").replace(/\.\w+/g, "").replace(/"[a-z][A-Za-z0-9]*"/g, "").replace(/\b[a-z]+[A-Z]\w*/g, "");
  const TECH = ["EBE", "excédent", "marge brute", "annuité", "autofinancement", "disponible", "charges opérationnelles",
                "charges fixes", "trésorerie", "prélèvement", "produits", "Rcr", "Rte", "Rpa", "Rrf", "reclassement", "situation de référence"];
  const fautes = TECH.filter((w) => new RegExp(`(^|[^\\p{L}])${w}(?![\\p{L}])`, "iu").test(affiche));
  verifier("les outils du carnet n'emploient aucun mot du cours", fautes.length === 0, fautes.join(", "));
}

console.log(`${total - echecs}/${total} vérifications passées`);
process.exit(echecs ? 1 : 0);
