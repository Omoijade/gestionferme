// The self-directed course (carnet), beside the farm. Three hours, no teacher in the room.
// It opens each situation in the farm, switches the course words on after the student has
// met what they name, checks figures read off the screen, and reveals worked answers only
// once the student has committed their own.
// Every figure in this file is computed from the model — never typed (method §28).
(function (root) {
  "use strict";
  const enNavigateur = typeof window !== "undefined" && window.Ferme;
  const Fm = enNavigateur ? window.Ferme : null;
  const M = root.FermeModel || require("./model.js");
  const J = root.FermeJeu || require("./jeu.js");
  const V = root.FermeVocab || require("./vocab.js");
  const P = M.P, A = M.ACTIONS;

  // ---------------------------------------------------------------- formatting
  const nf = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf3 = new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const large = (s) => s.replace(/ /g, " ");
  const n0 = (x) => (x < -0.5 ? "−" : "") + large(nf.format(Math.abs(Math.round(x))));
  const eur = (x) => n0(x) + " €";
  const eurS = (x) => (Math.round(x) > 0 ? "+" : "") + eur(x);
  const pct = (x) => Math.round(x * 100) + " %";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Reads "65 025", "65.025", "65025 €", "13,4" as numbers.
  function lireNombre(t) {
    if (t == null) return NaN;
    let x = String(t).replace(/[€\s  Lh/]/g, "").replace(/−/g, "-");
    if (/^-?\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");
    x = x.replace(",", ".");
    return x === "" ? NaN : Number(x);
  }

  // ---------------------------------------------------------------- the model, run for the course
  const code = () => (Fm && Fm.etat().cours.codeClasse) || J.REGLAGES_DEFAUT.codeClasse;
  const LEO = { action: "agrandir", vaches: 30, duree: 15, apportPct: 10 };
  function simuler(sit, plan, jusqua) {
    const s = J.nouvellePartie({ codeClasse: code() }, sit);
    for (let a = 1; a <= jusqua; a++) {
      const d = plan[a] || {};
      (d.projets || []).forEach((p) => J.ajouterProjet(s, p));
      Object.entries(d.recurrents || {}).forEach(([k, v]) => J.basculer(s, k, v));
      J.passerAnnee(s, {});
    }
    return s;
  }
  // The gap between a plan and continuing as before, line by line, for one played year.
  function ecarts(y) {
    const p = y.plan, r = y.ref;
    return { lait: p.litres - r.litres, ventes: p.ventes - r.ventes, vaches: p.chargesVaches - r.chargesVaches,
             ferme: p.chargesFixes - r.chargesFixes, remb: p.annuite - r.annuite, poche: p.autofinancement - r.autofinancement,
             total: p.disponible - r.disponible };
  }
  const memo = {};
  function calc(cle) {
    const k = cle + ":" + code();
    if (memo[k]) return memo[k];
    const D = simuler("D", {}, 1).annees[0];
    const out = {
      depart: () => ({ plan: D.plan, ref: D.ref, banqueDepart: J.SITUATIONS.D.banqueDepart }),
      concentres: () => ecarts(simuler("A", { 1: { recurrents: { concentres: true } } }, 1).annees[0]),
      sante1: () => ecarts(simuler("A", { 1: { recurrents: { sante: true } } }, 1).annees[0]),
      sante2: () => ecarts(simuler("A", { 1: { recurrents: { sante: true } } }, 2).annees[1]),
      leo: () => {
        const s = simuler("B", { 1: { projets: [LEO] } }, 3);
        const emprunt = M.coutProjet(LEO) - M.apportProjet(LEO);
        // What a careful student computes by hand for year 2, before learning about missing hours.
        const prix1 = s.annees[0].plan.prix;
        const naif2 = LEO.vaches * P.litresParVache * A.agrandir.montee[1] * prix1 + LEO.vaches * P.venteAnimauxParVache;
        return { annees: s.annees.map(ecarts), plans: s.annees.map((y) => y.plan), refs: s.annees.map((y) => y.ref),
                 cout: M.coutProjet(LEO), apport: M.apportProjet(LEO), emprunt, annuite: M.annuiteConstante(emprunt, P.tauxPret, LEO.duree),
                 naif2, prix1, heuresEnPlus: LEO.vaches * P.heuresParVache };
      },
    }[cle]();
    memo[k] = out;
    return out;
  }

  // ---------------------------------------------------------------- the steps
  // Block types: texte · question · libre · releve · condition · outil · nommer · essais · avis.
  // A step may set `situation` (opened in the farm on arrival; null closes it) and `niveau`
  // (course words switched on, on arrival — only in steps that come after the experience).
  const prixLu = "le prix du lait de l'année 1 (touchez « Année 1 » dans la ferme)";
  const ETAPES = [
    { id: "bienvenue", titre: "Bienvenue", minutes: 5, situation: null, blocs: [
      { t: "texte", html: () => `<p>Pendant trois heures, vous êtes <b>le vétérinaire d'une famille d'éleveurs laitiers</b> : Marc, Claire et leur fils Léo. Ils vous font confiance pour leurs vaches, et ils vous demandent aussi votre avis sur des décisions qui coûtent de l'argent.</p>
        <p><b>À gauche</b>, ce carnet vous guide pas à pas. <b>À droite</b>, la ferme : elle calcule tout, année après année. Vous ne pouvez rien casser : une année se reprend (« Revenir d'une année »), une situation se recommence.</p>
        <p>Vous n'avez besoin d'<b>aucune connaissance en économie</b>. Les mots techniques arrivent après que vous avez vu, dans la ferme, ce qu'ils désignent.</p>
        <p>À la fin, vous remettrez <b>un avis à la famille</b>, d'une page. C'est votre raisonnement qui compte, pas les résultats de la ferme. Il n'y a pas de bonne réponse unique.</p>` },
      { t: "texte", html: () => `<h3>Si vous travaillez à plusieurs</h3><p>Quand vous n'êtes pas d'accord, ne votez pas : essayez dans la ferme, regardez, puis revenez en arrière. Et quand la ferme vous demande une prévision, notez aussi l'avis de celui ou celle qui pense autrement.</p>` },
      { t: "champ", id: "codeEquipe", texte: "Votre code (vos initiales ou le code donné par votre enseignant — pas votre nom)" },
    ] },

    { id: "idee", titre: "Votre première idée", minutes: 5, situation: null, blocs: [
      { t: "texte", html: () => `<p>Avant d'ouvrir la ferme, une seule question. Répondez avec ce que vous pensez maintenant : il n'y a rien à calculer.</p>` },
      { t: "question", id: "diag", texte: "Une ferme laitière vend 25 % de lait en plus l'année prochaine. La famille qui y vit aura-t-elle plus d'argent pour vivre cette année-là ?",
        choix: { plus: "Oui, plus", pareil: "À peu près pareil", moins: "Non, moins", sais: "Je ne sais pas" }, pourquoi: true,
        retour: () => `<p>Réponse enregistrée. Vous la retrouverez à la fin du carnet.</p>` },
    ] },

    { id: "decouvrir", titre: "Faire connaissance avec la ferme", minutes: 15, situation: "D", blocs: [
      { t: "texte", html: () => `<p>La ferme est ouverte à droite. Elle se lit de haut en bas :</p>
        <ol><li><b>La question</b> : ce qu'un membre de la famille vous demande.</li>
        <li><b>Ce que la famille veut</b> : quatre souhaits. ✓ quand le plan les respecte, ✗ sinon.</li>
        <li><b>Les années</b> : une colonne par année. En gros, votre ferme ; en dessous, en petit, ce qui se passerait en <b>continuant comme avant</b>. Touchez une année pour voir le détail : « où va l'argent ».</li>
        <li><b>Les décisions</b>, puis le bouton bleu qui passe l'année.</li></ol>` },
      { t: "releve", id: "r_lait", texte: "Combien de litres de lait la ferme vend-elle en année 1 ?", ou: "Les années › Lait vendu › Année 1",
        attendu: () => calc("depart").plan.litres, unite: "L" },
      { t: "releve", id: "r_reste", texte: "Combien reste-t-il à la famille en année 1 ?", ou: "Les années › Reste pour la famille › Année 1",
        attendu: () => calc("depart").plan.disponible, unite: "€" },
      { t: "releve", id: "r_preleve", texte: "Touchez « Année 1 ». Combien la famille prend-elle pour vivre dans l'année ?", ou: "Année 1 › tableau › Ce que la famille prend pour vivre",
        attendu: () => calc("depart").plan.prelevements, unite: "€" },
      { t: "question", id: "q_souhait", texte: "Si rien ne change, quel souhait de la famille n'est pas atteint ?",
        choix: { lait: "Celui de Léo", banque: "Celui de Claire", heures: "Celui de Marc", horaire: "Celui de toute la famille" },
        bonne: "lait",
        retour: () => `<p>C'est le souhait de <b>Léo</b> : si rien ne change, la ferme vend autant de lait que l'an dernier, et il voudrait plus. Les trois autres souhaits sont respectés. Retenez ceci : <b>un souhait parle de lait, les trois autres parlent de la famille</b>.</p>` },
      { t: "condition", id: "c_d1", texte: "Passez l'année 1 sans rien décider (bouton bleu en bas de la ferme). Aucune prévision n'est nécessaire.",
        ok: (e) => !!(e.jeux.D && e.jeux.D.annees.length >= 1) },
      { t: "libre", id: "l_banque", texte: "Regardez « Argent en banque à la fin de l'année ». De combien a-t-il bougé pendant l'année 1, et pourquoi, d'après vous ?",
        retour: () => { const d = calc("depart"); return `<p>Il est passé de ${eur(d.banqueDepart)} à ${eur(d.plan.banqueFin)}, soit ${eurS(d.plan.banqueFin - d.banqueDepart)}. C'est exactement <b>le reste pour la famille</b> (${eur(d.plan.disponible)}) <b>moins ce qu'elle prend pour vivre</b> (${eur(d.plan.prelevements)}).</p>
          <p>L'argent en banque est un <b>niveau</b> : chaque année, il monte ou descend de cette différence. Une seule mauvaise année le fait baisser ; il faut ensuite plusieurs bonnes années pour le remonter.</p>`; } },
    ] },

    { id: "situationA", titre: "Situation A — Deux propositions", minutes: 30, situation: "A", blocs: [
      { t: "texte", html: () => `<p>Claire vous pose une question (en haut de la ferme). Ouvrez les deux décisions, <b>« Donner plus de concentrés »</b> et <b>« Plan de santé du troupeau »</b>, et lisez-les en entier, « Bon à savoir » compris. <b>N'ajoutez rien au plan pour l'instant.</b></p>
        <p>Avant d'essayer, calculez. L'outil ci-dessous fait les opérations ; vous donnez les chiffres. La question est toujours la même : <b>comparé à continuer comme avant, qu'est-ce qui change ?</b></p>` },
      { t: "outil", outil: "avecOuSans", id: "o_A", lait: true, colonnes: [
          { cle: "conc", titre: "Concentrés, année 1", aide: () => `Lait en plus : ${P.vachesDepart} vaches × ${n0(A.concentres.litresEnPlus)} L. Ventes en plus : ce lait × ${prixLu}. Dépenses pour les vaches en plus : ce lait × 0,30 €. Le reste ne change pas : mettez 0.`,
            ferme: () => calc("concentres") },
          { cle: "sante", titre: "Plan de santé, année 2", aide: () => `Lait en plus : ${P.vachesDepart} vaches × ${n0(A.sante.litresEnPlus)} L ; prenez le même prix qu'en année 1. Dépenses pour les vaches : le plan coûte ${A.sante.coutParVache} € par vache, et les soins baissent de ${A.sante.economieParVache} € par vache. Le reste : 0.`,
            ferme: () => calc("sante2") },
        ], comparer: (e) => !!(e.cours.vu && e.cours.vu.Aconc && e.cours.vu.Asante) },
      { t: "question", id: "qA1", texte: "D'après votre calcul, quelle proposition fait vendre le plus de lait ?",
        choix: { conc: "Les concentrés", sante: "Le plan de santé" }, bonne: "conc" },
      { t: "question", id: "qA2", texte: "Et pour chaque litre en plus (dernière ligne de l'outil), laquelle laisse le plus à la famille ?",
        choix: { conc: "Les concentrés", sante: "Le plan de santé" }, bonne: "sante",
        retour: () => { const c = calc("concentres"), s = calc("sante2"); return `<p>Concentrés : ${eurS(c.total)} pour ${n0(c.lait)} litres, soit ${nf3.format(c.total / c.lait).replace(/ /g, "")} € par litre. Plan de santé (année 2) : ${eurS(s.total)} pour ${n0(s.lait)} litres, soit ${nf3.format(s.total / s.lait)} € par litre.</p>
          <p><b>Plus de lait n'est pas la même chose que plus d'argent pour la famille.</b> Chaque litre de concentrés coûte presque ce qu'il rapporte.</p>`; } },
      { t: "question", id: "qA3", texte: "Laquelle coûte quelque chose avant de rapporter ?",
        choix: { conc: "Les concentrés", sante: "Le plan de santé" }, bonne: "sante",
        retour: () => `<p>Le plan de santé : en année 1, il coûte ${eur(-calc("sante1").total)} à la famille et ne rapporte encore rien. Il faut <b>attendre un an</b> pour en voir l'effet. Juger une décision sur sa première année, c'est souvent la juger sur sa plus mauvaise.</p>` },
      { t: "condition", id: "c_Aconc", texte: "Essayez dans la ferme : mettez les concentrés en place, passez l'année 1 (la ferme vous demande une prévision : répondez avec votre calcul), puis l'année 2.",
        ok: (e) => !!(e.cours.vu && e.cours.vu.Aconc) },
      { t: "condition", id: "c_Asante", texte: "Puis « Recommencer la situation », et faites la même chose avec le plan de santé.",
        ok: (e) => !!(e.cours.vu && e.cours.vu.Asante) },
      { t: "texte", html: () => `<p>Les deux essais faits, revenez à l'outil et appuyez sur <b>« Comparer avec la ferme »</b>. Si un de vos chiffres diffère, cherchez pourquoi dans le détail de l'année (touchez l'année dans la ferme).</p>` },
    ] },

    { id: "mots1", titre: "Les mots de ce que vous avez vu", minutes: 5, situation: "A", niveau: 1, blocs: [
      { t: "texte", html: () => `<p>Ce que vous venez de faire a des noms. Touchez une année dans la ferme : dans son détail, ces noms sont maintenant écrits en bleu, à côté des mots simples.</p>` },
      { t: "nommer", paires: [
        ["reference", "Toute décision se juge contre elle, jamais contre zéro. « Est-ce que ça rapporte ? » est la mauvaise question ; la bonne est « par rapport à continuer comme avant ? »"],
        ["ventes", "Tout ce qui entre en vendant."],
        ["chargesVaches", "Ce qui augmente quand il y a plus de vaches ou plus de lait."],
        ["margeBrute", "Les ventes moins ces dépenses-là. Elle grandit souvent quand on produit plus — mais ce n'est pas encore ce qui reste à la famille."],
      ] },
      { t: "libre", id: "l_A", texte: "En une phrase, avec vos mots : produire plus de lait, est-ce la même chose que laisser plus d'argent à la famille ?",
        retour: () => `<p>Une réponse possible : « Non. Les concentrés font vendre beaucoup plus de lait mais coûtent presque autant qu'ils rapportent ; le plan de santé fait vendre moins de lait en plus, mais laisse davantage à la famille, à partir de la deuxième année. »</p>` },
    ] },

    { id: "pause", titre: "Pause", minutes: 10, situation: null, blocs: [
      { t: "texte", html: () => `<p>Dix minutes. Levez-vous. La suite est la plus longue : Léo veut agrandir la ferme.</p>` },
    ] },

    { id: "B1", titre: "Situation B — Calculer avant d'agir", minutes: 25, situation: "B", blocs: [
      { t: "texte", html: () => `<p>Léo vous pose une question (en haut de la ferme). Marc a peur du travail, Claire a peur de la banque. Ouvrez <b>« Agrandir le troupeau »</b> et lisez tout, « Bon à savoir » compris. <b>N'ajoutez rien au plan.</b></p>
        <p>Le plan de Léo : <b>${LEO.vaches} vaches de plus, un prêt sur ${LEO.duree} ans, ${LEO.apportPct} % payés de leur poche.</b></p>` },
      { t: "releve", id: "rB_poche", texte: `Combien la famille paie-t-elle de sa poche en année 1 (${LEO.apportPct} % du total) ?`, ou: "Agrandir le troupeau › Coût : prix par vache × nombre de vaches, puis le pourcentage",
        attendu: () => calc("leo").apport, unite: "€" },
      { t: "outil", outil: "pret", id: "o_pret", aide: () => `Montant emprunté : le total moins ce qui est payé de sa poche. Durée : ${LEO.duree} ans.` },
      { t: "releve", id: "rB_annuite", texte: "Combien la famille rembourse-t-elle par an ?", ou: "L'outil « Le prêt », ou la carte « Remboursement par an » dans la décision",
        attendu: () => calc("leo").annuite, unite: "€" },
      { t: "outil", outil: "avecOuSans", id: "o_B", lait: false, colonnes: [
          { cle: "1", titre: "Année 1", aide: () => `Le chantier : les vaches ne sont pas encore là. Seule la part payée de sa poche change.`, ferme: () => calc("leo").annees[0] },
          { cle: "2", titre: "Année 2", aide: () => `Les vaches arrivent et donnent ${pct(A.agrandir.montee[1])} de leur lait : ${LEO.vaches} × ${n0(P.litresParVache)} L × ${pct(A.agrandir.montee[1])}, au prix de l'année 1, plus les animaux vendus. Dépenses pour les vaches : ce que coûtent ${LEO.vaches} vaches, plus le fourrage acheté pour les vaches au-delà de ${n0(P.seuilVachesParHa * P.haDepart)}. Dépenses de la ferme : l'étable. Plus le remboursement.`, ferme: () => calc("leo").annees[1] },
          { cle: "3", titre: "Année 3", aide: () => `Pareil, mais les vaches donnent ${pct(A.agrandir.montee[2])} de leur lait.`, ferme: () => calc("leo").annees[2] },
        ], comparer: (e) => !!(e.cours.vu && e.cours.vu.Bleo) },
      { t: "outil", outil: "compte", id: "o_compte", lie: "o_B",
        aide: () => `Départ : l'argent en banque au début (en haut de la ferme). Reste si on continue comme avant : prenez celui de l'année 1 pour les trois années. La famille prend ${eur(P.prelevementsFamille)} par an pour vivre.` },
      { t: "releve", id: "rB_heures", texte: `${LEO.vaches} vaches de plus demandent combien d'heures de travail en plus par an ?`, ou: "Agrandir le troupeau › Bon à savoir",
        attendu: () => calc("leo").heuresEnPlus, unite: "h" },
      { t: "texte", html: () => `<p>La famille peut faire ${n0(P.capaciteFamille)} heures par an et en fait aujourd'hui ${n0(calc("depart").plan.heuresFamille)}. Gardez cela en tête.</p>` },
    ] },

    { id: "B2", titre: "Situation B — Jouer, puis comparer", minutes: 20, situation: "B", blocs: [
      { t: "condition", id: "c_Bleo", texte: `Dans la ferme : ajoutez « Agrandir le troupeau » avec le plan de Léo (${LEO.vaches} vaches, ${LEO.duree} ans, ${LEO.apportPct} %). Passez l'année 1 en donnant votre prévision pour l'année 2 (avec votre calcul), puis passez l'année 2.`,
        ok: (e) => !!(e.cours.vu && e.cours.vu.Bleo) },
      { t: "texte", html: () => `<p>Revenez à l'outil « Avec ou sans » de l'étape précédente (bouton « Étape précédente ») et appuyez sur « Comparer avec la ferme ». Ou regardez directement le bilan de l'année 2 dans la ferme.</p>` },
      { t: "question", id: "qB1", texte: "En année 2, la ferme vend beaucoup plus de lait. Pourquoi le reste pour la famille est-il plus bas qu'en continuant comme avant ?",
        choix: { prix: "Parce que le prix du lait a baissé", tot: "Parce que le remboursement et les nouvelles dépenses arrivent tout de suite, alors que les nouvelles vaches ne donnent pas encore tout leur lait", aides: "Parce que les aides ont baissé" },
        bonne: "tot",
        retour: () => { const b = calc("leo"), y = b.annees[1]; return `<p>En année 2 : ventes ${eurS(y.ventes)} ; mais dépenses pour les vaches ${eurS(-y.vaches)}, dépenses de la ferme ${eurS(-y.ferme)}, remboursement ${eurS(-y.remb)}. Total : <b>${eurS(y.total)}</b> pour la famille, avec ${n0(y.lait)} litres de plus.</p>
          <p>Le remboursement est fixé le jour de la signature et commence tout de suite. Le lait, lui, arrive peu à peu. <b>Les coûts et les gains ne tombent pas la même année.</b></p>`; } },
      { t: "libre", id: "l_ecart", texte: "Votre « argent des ventes en plus » pour l'année 2 était-il plus haut que celui de la ferme ? Regardez « Heures qui manquent » dans l'année 2. Qu'est-ce qui s'est passé ?",
        retour: () => { const b = calc("leo"); return `<p>Avec ce que vous saviez, le calcul donnait environ ${eur(b.naif2)} de ventes en plus. La ferme n'en a fait que ${eur(b.annees[1].ventes)}. La différence vient du <b>lait perdu</b> : il manque ${n0(b.plans[1].heuresManquantes)} heures à la famille, et ${n0(b.plans[1].litresPerdus)} litres ne sont pas produits faute de temps.</p>
          <p>Un plan peut être bon sur le papier et impossible à tenir pour ceux qui doivent le faire.</p>`; } },
    ] },

    { id: "mots2", titre: "Les mots de ce que vous avez vu (2)", minutes: 10, situation: "B", niveau: 2, blocs: [
      { t: "texte", html: () => `<p>Ces noms sont maintenant écrits en bleu dans la ferme : dans « Les années », et dans le détail de chaque année.</p>` },
      { t: "nommer", paires: [
        ["chargesFixes", "Ce que la ferme paie même sans traire un litre de plus."],
        ["ebe", "Ce que la ferme dégage avant de rembourser. On le présente souvent comme « le bénéfice » de la ferme ; ce n'est pas encore ce qui reste à la famille."],
        ["annuite", "Fixée à la signature du prêt, payée chaque année jusqu'au bout."],
        ["autofinancement", "La part payée sans emprunter."],
        ["disponible", "Ce qui reste vraiment : c'est avec cela que la famille vit."],
        ["prelevements", "Ce que la famille retire pour vivre."],
        ["banque", "Un niveau, qui bouge chaque année du disponible moins les prélèvements."],
      ] },
      { t: "texte", html: (e) => {
          const s = e.jeux.B, y = s && s.annees[1];
          if (!y) return `<p>Quand vous aurez passé l'année 2 avec le plan de Léo, cette ligne affichera vos propres chiffres.</p>`;
          return `<p><b>Dans votre ferme, année 2</b>, comparé à continuer comme avant : <b>EBE ${eurS(y.plan.ebe - y.ref.ebe)}</b> ; <b>disponible ${eurS(y.plan.disponible - y.ref.disponible)}</b>.</p>
            <p>Entre les deux, il y a l'annuité et l'autofinancement. <b>L'EBE peut monter pendant que le disponible baisse.</b></p>`; } },
    ] },

    { id: "B3", titre: "Situation B — Chercher un meilleur plan", minutes: 25, situation: "B", blocs: [
      { t: "texte", html: () => `<p>Léo n'a pas forcément tort. Votre travail : trouver <b>ce que la famille peut faire, et à quelles conditions</b>.</p>
        <p>Essayez plusieurs plans. Pour chacun : « Recommencer la situation », faites vos décisions, <b>passez les ${J.SITUATIONS.B.horizon} années</b>, puis appuyez sur « Noter cet essai ». Idées : 15 vaches au lieu de 30 ; un prêt sur 20 ans ; 0 % ou 25 % de sa poche ; un salarié ; louer des terres ; et <b>ne rien faire</b>, qui est aussi un plan.</p>` },
      { t: "essais", id: "essaisB", situation: "B", min: 3 },
      { t: "outil", outil: "parHeure", id: "o_heure", aide: () => `Reste pour la famille ÷ heures de travail de la famille (dans le détail d'une année). La méthode wallonne compare ce chiffre à ${P.salaireImpute} € de l'heure.` },
      { t: "libre", id: "l_B3", texte: "Parmi vos essais, lequel respecte le plus de souhaits de la famille ? Lequel fait vendre le plus de lait ? Est-ce le même ?" },
    ] },

    { id: "C", titre: "Pour aller plus loin — Situation C", minutes: 15, facultatif: true, situation: "C", blocs: [
      { t: "texte", html: () => `<p>Cette étape est facultative : faites-la s'il vous reste au moins trente minutes. Sinon, passez directement à l'avis.</p>
        <p>La ferme a déjà agrandi. Marc vous pose une question. Robot, salarié, terres en plus : chacun change les heures et l'argent dans des sens opposés. Essayez, passez les années, notez vos essais.</p>` },
      { t: "essais", id: "essaisC", situation: "C", min: 0 },
    ] },

    { id: "avis", titre: "Votre avis à la famille", minutes: 25, situation: "B", blocs: [
      { t: "texte", html: () => `<p>Écrivez votre avis sur la question de Léo. Une page. Un bon avis :</p>
        <ul><li>compare toujours à <b>continuer comme avant</b> ;</li><li>dit <b>quand</b> les choses changent, année par année ;</li>
        <li>dit si la famille <b>peut payer et tenir</b> (la banque, les heures) ;</li><li>nomme <b>une chose que la ferme ne compte pas</b>.</li></ul>
        <p>Une recommandation différente de celle de Léo, bien argumentée, est un très bon avis.</p>` },
      { t: "avis", id: "avis" },
    ] },
  ];

  // ---------------------------------------------------------------- tools
  const LIGNES = [["ventes", "Argent des ventes en plus", +1], ["vaches", "Dépenses pour les vaches en plus", -1],
                  ["ferme", "Dépenses de la ferme en plus", -1], ["remb", "Remboursement en plus", -1], ["poche", "Payé de sa poche en plus", -1]];

  function rep() { return Fm.etat().cours.rep; }
  function val(id, k) { const o = rep()[id]; return o ? o[k] : ""; }

  function outilAvecOuSans(b, e) {
    const cols = b.colonnes;
    const peutComparer = b.comparer(e);
    const montre = !!(rep()[b.id] && rep()[b.id].__compare);
    const td = (c, k) => `<td><input inputmode="decimal" data-o="${b.id}" data-k="${c.cle}.${k}" value="${esc(val(b.id, c.cle + "." + k))}" aria-label="${esc(c.titre)} — ${esc(k)}">
      ${montre ? `<small class="ferme-val">ferme : ${n0(c.ferme()[k === "lait" ? "lait" : k])}</small>` : ""}</td>`;
    const lignes = (b.lait ? [["lait", "Lait en plus (litres)", 0]] : []).concat(LIGNES);
    return `<div class="outil" data-outil="avecOuSans" data-id="${b.id}">
      <div class="outil-tete"><span>Outil</span><h3>Avec ou sans</h3><p>Comparé à continuer comme avant, qu'est-ce qui change cette année ? Entrez des montants positifs : l'outil met les signes.</p></div>
      ${cols.map((c) => `<p class="aide"><b>${esc(c.titre)} :</b> ${c.aide()}</p>`).join("")}
      <div class="defile"><table class="outil-table"><thead><tr><th></th>${cols.map((c) => `<th>${esc(c.titre)}</th>`).join("")}</tr></thead><tbody>
        ${lignes.map(([k, l, sg]) => `<tr><th>${sg < 0 ? "− " : sg > 0 ? "+ " : ""}${esc(l)}</th>${cols.map((c) => td(c, k)).join("")}</tr>`).join("")}
        <tr class="total"><th>= Changement du reste pour la famille</th>${cols.map((c) => `<td data-total="${c.cle}">—${montre ? `<small class="ferme-val">ferme : ${eurS(c.ferme().total)}</small>` : ""}</td>`).join("")}</tr>
        ${b.lait ? `<tr><th>Par litre en plus</th>${cols.map((c) => `<td data-parlitre="${c.cle}">—</td>`).join("")}</tr>` : ""}
      </tbody></table></div>
      <div class="button-row"><button class="button secondary" data-comparer="${b.id}"${peutComparer ? "" : " disabled"}>${montre ? "Masquer la ferme" : "Comparer avec la ferme"}</button>
        ${peutComparer ? "" : `<small>Ce bouton s'active après l'essai dans la ferme.</small>`}</div>
    </div>`;
  }
  function majAvecOuSans(el, b) {
    for (const c of b.colonnes) {
      const v = (k) => lireNombre(val(b.id, c.cle + "." + k)) || 0;
      const t = LIGNES.reduce((s, [k, , sg]) => s + sg * v(k), 0);
      const rempli = LIGNES.some(([k]) => val(b.id, c.cle + "." + k) !== "" && val(b.id, c.cle + "." + k) != null);
      const cell = el.querySelector(`[data-total="${c.cle}"]`);
      if (cell) cell.firstChild.nodeValue = rempli ? eurS(t) : "—";
      rep()[b.id] = rep()[b.id] || {};
      rep()[b.id]["__total." + c.cle] = rempli ? t : null;
      const pl = el.querySelector(`[data-parlitre="${c.cle}"]`);
      if (pl) pl.textContent = rempli && v("lait") ? nf3.format(t / v("lait")) + " € par litre" : "—";
    }
  }

  function outilPret(b) {
    return `<div class="outil" data-outil="pret" data-id="${b.id}">
      <div class="outil-tete"><span>Outil</span><h3>Le prêt</h3><p>Un prêt se rembourse par la même somme chaque année. Taux de la banque : ${nf1.format(P.tauxPret * 100)} %.</p></div>
      <p class="aide">${b.aide()}</p>
      <div class="champs-ligne"><label>Montant emprunté (€)<input inputmode="decimal" data-o="${b.id}" data-k="montant" value="${esc(val(b.id, "montant"))}"></label>
        <label>Durée (années)<input inputmode="numeric" data-o="${b.id}" data-k="duree" value="${esc(val(b.id, "duree"))}"></label></div>
      <dl class="resultats"><div><dt>Remboursement par an</dt><dd data-r="annuite">—</dd></div><div><dt>Total remboursé</dt><dd data-r="total">—</dd></div><div><dt>Dont intérêts</dt><dd data-r="interets">—</dd></div></dl>
    </div>`;
  }
  function majPret(el, b) {
    const m = lireNombre(val(b.id, "montant")), n = lireNombre(val(b.id, "duree"));
    const ok = m > 0 && n > 0;
    const a = ok ? M.annuiteConstante(m, P.tauxPret, n) : 0;
    el.querySelector('[data-r="annuite"]').textContent = ok ? eur(a) : "—";
    el.querySelector('[data-r="total"]').textContent = ok ? eur(a * n) : "—";
    el.querySelector('[data-r="interets"]').textContent = ok ? eur(a * n - m) : "—";
  }

  function outilCompte(b) {
    return `<div class="outil" data-outil="compte" data-id="${b.id}">
      <div class="outil-tete"><span>Outil</span><h3>Le compte tient-il ?</h3><p>Chaque année : argent au début + reste pour la famille − ce qu'elle prend pour vivre = argent à la fin.</p></div>
      <p class="aide">${b.aide()}</p>
      <div class="champs-ligne"><label>Argent au départ (€)<input inputmode="decimal" data-o="${b.id}" data-k="depart" value="${esc(val(b.id, "depart"))}"></label>
        <label>Reste si on continue comme avant (€/an)<input inputmode="decimal" data-o="${b.id}" data-k="ref" value="${esc(val(b.id, "ref"))}"></label></div>
      <table class="outil-table"><thead><tr><th>Année</th><th>Changement (votre outil « Avec ou sans »)</th><th>Reste pour la famille</th><th>Argent à la fin</th></tr></thead>
        <tbody>${[1, 2, 3].map((a) => `<tr><th>${a}</th><td data-c="ch${a}">—</td><td data-c="re${a}">—</td><td data-c="fi${a}">—</td></tr>`).join("")}</tbody></table>
      <p class="resultat-ligne" data-c="bas"></p>
    </div>`;
  }
  function majCompte(el, b) {
    const dep = lireNombre(val(b.id, "depart")), ref = lireNombre(val(b.id, "ref"));
    const lie = rep()[b.lie] || {};
    let banque = dep, bas = null;
    for (let a = 1; a <= 3; a++) {
      const ch = lie["__total." + a];
      const ok = !isNaN(dep) && !isNaN(ref) && ch != null;
      el.querySelector(`[data-c="ch${a}"]`).textContent = ch != null ? eurS(ch) : "—";
      if (!ok) { el.querySelector(`[data-c="re${a}"]`).textContent = "—"; el.querySelector(`[data-c="fi${a}"]`).textContent = "—"; continue; }
      const reste = ref + ch;
      banque = banque + reste - P.prelevementsFamille;
      el.querySelector(`[data-c="re${a}"]`).textContent = eur(reste);
      const fi = el.querySelector(`[data-c="fi${a}"]`);
      fi.textContent = eur(banque); fi.className = banque < 0 ? "bad-text" : "";
      if (bas == null || banque < bas.v) bas = { v: banque, a };
    }
    el.querySelector('[data-c="bas"]').innerHTML = bas ? `Point le plus bas : <b>${eur(bas.v)}</b>, en année ${bas.a}.${bas.v < 0 ? " Le compte serait à découvert." : ""}` : "";
  }

  function outilParHeure(b) {
    return `<div class="outil" data-outil="parHeure" data-id="${b.id}">
      <div class="outil-tete"><span>Outil</span><h3>Par heure</h3></div>
      <p class="aide">${b.aide()}</p>
      <div class="champs-ligne"><label>Reste pour la famille (€)<input inputmode="decimal" data-o="${b.id}" data-k="reste" value="${esc(val(b.id, "reste"))}"></label>
        <label>Heures de la famille<input inputmode="numeric" data-o="${b.id}" data-k="heures" value="${esc(val(b.id, "heures"))}"></label></div>
      <p class="resultat-ligne" data-r="h"></p>
    </div>`;
  }
  function majParHeure(el, b) {
    const r = lireNombre(val(b.id, "reste")), h = lireNombre(val(b.id, "heures"));
    const x = r / h;
    el.querySelector('[data-r="h"]').innerHTML = h > 0 && !isNaN(r) ? `<b>${nf1.format(x)} € par heure</b> — ${x >= P.salaireImpute ? "au moins" : "moins que"} ${P.salaireImpute} € de l'heure.` : "";
  }

  // Tries: captured from the farm, so comparing plans needs no copying of figures.
  function capturerEssai(sit) {
    const s = Fm.etat().jeux[sit];
    if (!s || !s.annees.length) return null;
    const decs = s.projets.filter((p) => p.decide >= 1).map((p) => V.ACTIONS[p.action].titre + (p.vaches ? ` +${p.vaches}` : "") + ` (${p.duree} ans, ${p.apportPct} %)`)
      .concat(M.RECURRENTS.filter((k) => s.annees.some((a) => a.decisions.recurrents[k]) && !(s.base.recurrents || {})[k]).map((k) => V.ACTIONS[k].titre));
    const derniere = s.annees[s.annees.length - 1];
    return { situation: sit, decisions: decs.length ? decs : ["Aucune décision"], annees: s.annees.map((a) => ({ annee: a.annee,
      lait: a.plan.litres, laitRef: a.ref.litres, reste: a.plan.disponible, resteRef: a.ref.disponible, banque: a.plan.banqueFin, banqueRef: a.ref.banqueFin,
      heure: a.plan.gainHoraire })), plusBas: Math.min(...s.annees.map((a) => a.plan.banqueFin)),
      objectifs: derniere.objectifs, anneesJouees: s.annees.length, horizon: s.reglages.horizon };
  }
  function tableEssai(x) {
    return `<table class="outil-table"><thead><tr><th>Année</th><th>Lait (comme avant)</th><th>Reste famille (comme avant)</th><th>Banque fin (comme avant)</th></tr></thead><tbody>
      ${x.annees.map((a) => `<tr><th>${a.annee}</th><td>${n0(a.lait)} <small>(${n0(a.laitRef)})</small></td><td>${eur(a.reste)} <small>(${eur(a.resteRef)})</small></td><td class="${a.banque < 0 ? "bad-text" : ""}">${eur(a.banque)} <small>(${eur(a.banqueRef)})</small></td></tr>`).join("")}
    </tbody></table>`;
  }
  function blocEssais(b) {
    const liste = Fm.etat().cours.essais.map((x, i) => ({ x, i })).filter(({ x }) => x.situation === b.situation);
    return `<div class="outil" data-id="${b.id}">
      <div class="outil-tete"><span>Outil</span><h3>Mes essais</h3><p>Après avoir passé les années d'un plan, notez-le ici. Vous pourrez les comparer et en choisir un pour votre avis.</p></div>
      <div class="button-row"><button class="button primary" data-noter="${b.situation}">Noter cet essai</button><small data-msg="${b.id}"></small></div>
      ${liste.length ? `<div class="defile"><table class="outil-table essais"><thead><tr><th>#</th><th>Décisions</th><th>Reste famille, dernière année (comme avant)</th><th>Banque au plus bas</th><th>Souhaits</th><th></th></tr></thead><tbody>
        ${liste.map(({ x, i }) => { const d = x.annees[x.annees.length - 1]; const ok = J.OBJECTIFS.filter((k) => x.objectifs[k]);
          return `<tr><th>${i + 1}</th><td>${x.decisions.map(esc).join("<br>")}<br><small>${x.anneesJouees} / ${x.horizon} années</small></td><td>${eur(d.reste)} <small>(${eur(d.resteRef)})</small></td>
            <td class="${x.plusBas < 0 ? "bad-text" : ""}">${eur(x.plusBas)}</td><td>${ok.length} / 4<br><small>${ok.map((k) => esc(V.OBJECTIFS[k].qui)).join(", ")}</small></td>
            <td><button class="lien" data-suppr="${i}" aria-label="Supprimer l'essai">×</button></td></tr>`; }).join("")}
      </tbody></table></div>` : ""}
      ${b.min ? `<p class="condition ${liste.length >= b.min ? "ok" : ""}" data-cond-essais="${b.id}">${liste.length >= b.min ? "✓" : "○"} Au moins ${b.min} essais notés (${liste.length}).</p>` : ""}
    </div>`;
  }

  // ---------------------------------------------------------------- the final advice
  const AVIS = [
    ["reco", "1. Ma recommandation à la famille", "Que conseillez-vous ? Dans quelles conditions ?", 4],
    ["quand", "2. Quand les choses changent", "En quelle année la famille a-t-elle moins qu'en continuant comme avant ? À partir de quand plus ? Pourquoi ?", 3],
    ["tenir", "3. La famille peut-elle payer et tenir ?", "L'argent en banque au plus bas ; les heures de travail.", 3],
    ["leo", "4. Ce que dirait Léo", "Défendez son point de vue, même si ce n'est pas le vôtre.", 2],
    ["claire", "5. Ce que dirait Claire", "Défendez son point de vue, même si ce n'est pas le vôtre.", 2],
    ["limite", "6. Ce que la ferme ne compte pas", "Une chose qui compte pour cette famille et qui n'apparaît dans aucun chiffre : par exemple les autres revenus du ménage, la fatigue, la santé des animaux, ce que les vaches font à la terre et à l'eau.", 2],
  ];
  function blocAvis(b) {
    const r = rep()[b.id] || {};
    const essais = Fm.etat().cours.essais;
    const choisi = essais[Number(r.essai)];
    const diag = rep().diag || {};
    const choixDiag = { plus: "Oui, plus", pareil: "À peu près pareil", moins: "Non, moins", sais: "Je ne sais pas" };
    return `<div class="avis" data-id="${b.id}">
      ${AVIS.slice(0, 1).map(champAvis).join("")}
      <label class="champ"><span>L'essai qui soutient votre recommandation</span>
        <select data-o="${b.id}" data-k="essai" data-rendre="1"><option value="">—</option>${essais.map((x, i) => `<option value="${i}"${String(i) === String(r.essai) ? " selected" : ""}>Essai ${i + 1} — ${esc(x.decisions.join(", "))}</option>`).join("")}</select></label>
      ${choisi ? tableEssai(choisi) : `<p class="aide">Notez vos essais à l'étape précédente pour pouvoir en choisir un ici.</p>`}
      ${AVIS.slice(1).map(champAvis).join("")}
      <div class="retour-idee"><h3>7. Votre première idée</h3>
        <p>Au début, à la question « une ferme vend 25 % de lait en plus : la famille aura-t-elle plus pour vivre ? », vous avez répondu : <b>${esc(choixDiag[diag.choix] || "—")}</b>${diag.pourquoi ? ` — « ${esc(diag.pourquoi)} »` : ""}.</p>
        ${champAvis(["idee", "Que répondriez-vous maintenant ? Pourquoi ?", "", 2])}</div>
      <div class="button-row"><button class="button primary" data-act="imprimer">Imprimer ou enregistrer en PDF</button>
        <button class="button secondary" data-act="telecharger">Télécharger le fichier de remise</button></div>
    </div>`;
    function champAvis([k, titre, aide, lignes]) {
      return `<label class="champ"><span>${esc(titre)}</span>${aide ? `<small>${esc(aide)}</small>` : ""}<textarea rows="${lignes}" data-o="${b.id}" data-k="${k}">${esc(r[k] || "")}</textarea></label>`;
    }
  }
  function pageImprimable() {
    const e = Fm.etat(), r = e.cours.rep.avis || {}, x = e.cours.essais[Number(r.essai)];
    const bloc = (t, v) => `<h2>${esc(t)}</h2><p>${esc(v || "—").replace(/\n/g, "<br>")}</p>`;
    return `<h1>Avis à la famille — Léo veut agrandir</h1><p>Code : ${esc((e.cours.rep.codeEquipe && e.cours.rep.codeEquipe.v) || "—")}</p>
      ${bloc(AVIS[0][1], r.reco)}${x ? `<h2>L'essai retenu : ${esc(x.decisions.join(", "))}</h2>${tableEssai(x)}` : ""}
      ${AVIS.slice(1).map(([k, t]) => bloc(t, r[k])).join("")}${bloc("Ma première idée, et ce que j'en pense maintenant", r.idee)}`;
  }

  // ---------------------------------------------------------------- rendering
  const e = () => Fm.etat();
  function etape() { return ETAPES[Math.min(e().cours.etape || 0, ETAPES.length - 1)]; }

  function blocHtml(b) {
    const r = rep();
    switch (b.t) {
      case "texte": return `<div class="texte">${b.html(e())}</div>`;
      case "champ": return `<label class="champ"><span>${esc(b.texte)}</span><input data-o="${b.id}" data-k="v" value="${esc(val(b.id, "v"))}" autocomplete="off"></label>`;
      case "question": {
        const x = r[b.id] || {};
        const fait = !!x.valide;
        return `<div class="question" data-q="${b.id}"><p class="q">${esc(b.texte)}</p>
          ${Object.entries(b.choix).map(([k, l]) => `<label class="choix ${fait && b.bonne ? (k === b.bonne ? "bonne" : k === x.choix ? "fausse" : "") : ""}">
            <input type="radio" name="${b.id}" value="${k}" data-o="${b.id}" data-k="choix"${x.choix === k ? " checked" : ""}${fait ? " disabled" : ""}><span>${esc(l)}</span></label>`).join("")}
          ${b.pourquoi ? `<label class="champ"><span>Pourquoi ? (une phrase)</span><textarea rows="2" data-o="${b.id}" data-k="pourquoi"${fait ? " disabled" : ""}>${esc(x.pourquoi || "")}</textarea></label>` : ""}
          ${fait ? `<div class="retour">${b.bonne ? `<p class="${x.choix === b.bonne ? "good-text" : "warn-text"}"><b>${x.choix === b.bonne ? "Oui." : "Pas tout à fait."}</b></p>` : ""}${b.retour ? b.retour(e()) : ""}</div>`
            : `<div class="button-row"><button class="button secondary" data-valider="${b.id}">Valider ma réponse</button></div>`}</div>`;
      }
      case "libre": {
        const x = r[b.id] || {};
        return `<div class="question" data-q="${b.id}"><p class="q">${esc(b.texte)}</p>
          <textarea rows="3" data-o="${b.id}" data-k="texte">${esc(x.texte || "")}</textarea>
          ${x.valide ? (b.retour ? `<div class="retour">${b.retour(e())}</div>` : `<p class="good-text">Enregistré.</p>`)
            : `<div class="button-row"><button class="button secondary" data-valider="${b.id}">Enregistrer${b.retour ? " et voir une réponse possible" : ""}</button></div>`}</div>`;
      }
      case "releve": {
        const x = r[b.id] || {};
        const att = b.attendu(), lu = lireNombre(x.texte);
        const juste = !isNaN(lu) && Math.abs(lu - att) <= Math.max(1, Math.abs(att) * 0.005);
        return `<div class="question releve" data-q="${b.id}"><p class="q">${esc(b.texte)}</p>
          <div class="champs-ligne"><input inputmode="decimal" data-o="${b.id}" data-k="texte" value="${esc(x.texte || "")}"><span class="unite">${esc(b.unite)}</span>
          <button class="button secondary" data-valider="${b.id}">Vérifier</button></div>
          ${x.valide ? (juste ? `<p class="good-text">✓ C'est bien le chiffre de la ferme.</p>`
            : `<p class="warn-text">Ce n'est pas le chiffre de la ferme. Où le lire : ${esc(b.ou)}.${x.essais >= 2 ? ` Le chiffre est ${b.unite === "€" ? eur(att) : n0(att) + " " + esc(b.unite)}.` : ""}</p>`) : ""}</div>`;
      }
      case "condition": return `<p class="condition" data-cond="${b.id}">○ ${esc(b.texte)}</p>`;
      case "outil": return b.outil === "avecOuSans" ? outilAvecOuSans(b, e()) : b.outil === "pret" ? outilPret(b) : b.outil === "compte" ? outilCompte(b) : outilParHeure(b);
      case "nommer": return `<dl class="nommer">${b.paires.map(([k, phrase]) => { const t = V.TERMES[k]; return `<div><dt>${esc(t.simple)} <span aria-hidden="true">→</span> <span class="terme">${esc(t.cours)}</span></dt><dd>${esc(phrase)}</dd></div>`; }).join("")}</dl>`;
      case "essais": return blocEssais(b);
      case "avis": return blocAvis(b);
      default: return "";
    }
  }

  // What the student still has to do before continuing (answers, not correctness).
  function manque(et) {
    const out = [], r = rep();
    for (const b of et.blocs) {
      if (["question", "libre", "releve"].includes(b.t) && !(r[b.id] && r[b.id].valide)) out.push(b.t === "releve" ? "un chiffre à vérifier" : "une réponse à valider");
      if (b.t === "condition" && !b.ok(e())) out.push("une action dans la ferme");
      if (b.t === "essais" && b.min && e().cours.essais.filter((x) => x.situation === b.situation).length < b.min) out.push(`${b.min} essais à noter`);
    }
    return out;
  }

  function rendre() {
    const el = document.getElementById("carnet");
    if (!el) return;
    const c = e().cours, i = Math.min(c.etape || 0, ETAPES.length - 1), et = ETAPES[i];
    c.max = Math.max(c.max || 0, i);
    const total = ETAPES.filter((x) => !x.facultatif).reduce((s, x) => s + x.minutes, 0);
    const fait = ETAPES.slice(0, i).filter((x) => !x.facultatif).reduce((s, x) => s + x.minutes, 0);
    el.innerHTML = `<header class="carnet-tete">
        <span class="sur-titre">Carnet · étape ${i + 1} sur ${ETAPES.length}${et.facultatif ? " · facultative" : ""} · environ ${et.minutes} min</span>
        <div class="progression" aria-hidden="true"><i style="width:${Math.round((fait / total) * 100)}%"></i></div>
        <h1>${esc(et.titre)}</h1>
        <label class="aller"><span class="sr-only">Aller à l'étape</span><select data-aller>${ETAPES.map((x, k) => k <= c.max ? `<option value="${k}"${k === i ? " selected" : ""}>${k + 1}. ${esc(x.titre)}</option>` : "").join("")}</select></label>
      </header>
      <div class="carnet-corps">${et.blocs.map(blocHtml).join("")}</div>
      <footer class="carnet-pied">
        <button class="button secondary" data-nav="-1"${i === 0 ? " disabled" : ""}>Étape précédente</button>
        ${et.situation ? `<button class="button secondary voir-ferme" data-voir="ferme">Voir la ferme →</button>` : ""}
        ${i < ETAPES.length - 1 ? `<button class="button primary" data-nav="1">Continuer</button>` : ""}
      </footer><p class="manque" data-manque></p>`;
    brancher(el);
    el.querySelectorAll(".outil[data-outil]").forEach((o) => majOutil(o));
    majConditions();
  }

  function trouverBloc(id) { for (const et of ETAPES) for (const b of et.blocs) if (b.id === id) return b; return null; }
  function majOutil(o) {
    const b = trouverBloc(o.dataset.id);
    if (!b) return;
    ({ avecOuSans: majAvecOuSans, pret: majPret, compte: majCompte, parHeure: majParHeure })[b.outil](o, b);
    // A linked tool (the bank account reads the "Avec ou sans" totals) follows its source.
    document.querySelectorAll(".outil[data-outil='compte']").forEach((x) => { const bb = trouverBloc(x.dataset.id); if (bb && bb.lie === b.id) majCompte(x, bb); });
  }

  // Called by the farm after every change: record what has been tried, refresh ticks.
  function majConditions() {
    if (!Fm) return;
    const et = e(), c = et.cours;
    c.vu = c.vu || {};
    const A_ = et.jeux.A, B_ = et.jeux.B;
    if (A_ && A_.annees.length >= 2) {
      if (A_.annees[0].decisions.recurrents.concentres) c.vu.Aconc = true;
      if (A_.annees[0].decisions.recurrents.sante) c.vu.Asante = true;
    }
    if (B_ && B_.annees.length >= 2 && B_.annees[0].decisions.projets.some((p) => p.action === "agrandir" && p.vaches === LEO.vaches && p.duree === LEO.duree && p.apportPct === LEO.apportPct)) c.vu.Bleo = true;
    const el = document.getElementById("carnet");
    if (!el) return;
    const etp = etape();
    for (const b of etp.blocs) {
      if (b.t !== "condition") continue;
      const x = el.querySelector(`[data-cond="${b.id}"]`);
      if (x) { const ok = b.ok(et); x.className = "condition" + (ok ? " ok" : ""); x.textContent = (ok ? "✓ " : "○ ") + b.texte; }
    }
    etp.blocs.filter((b) => b.t === "outil" && b.comparer).forEach((b) => {
      const btn = el.querySelector(`[data-comparer="${b.id}"]`);
      if (btn && btn.disabled && b.comparer(et)) { btn.disabled = false; const s = btn.nextElementSibling; if (s && s.tagName === "SMALL") s.remove(); }
    });
    const m = manque(etp), p = el.querySelector("[data-manque]");
    if (p) p.textContent = m.length ? `Il reste : ${[...new Set(m)].join(", ")}. Vous pouvez continuer quand même.` : "";
  }

  function brancher(el) {
    const r = rep();
    el.querySelectorAll("[data-o]").forEach((inp) => {
      const ev = inp.tagName === "SELECT" || inp.type === "radio" ? "change" : "input";
      inp.addEventListener(ev, () => {
        const id = inp.dataset.o, k = inp.dataset.k;
        r[id] = r[id] || {};
        r[id][k] = inp.value;
        if (id === "codeEquipe") Fm.etat().jeux && Object.values(Fm.etat().jeux).forEach((s) => { s.reglages.codeEquipe = inp.value; });
        Fm.sauver();
        const o = inp.closest(".outil[data-outil]");
        if (o) majOutil(o);
        if (inp.dataset.rendre) rendre();
      });
    });
    el.querySelectorAll("[data-valider]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.valider, b = trouverBloc(id);
      r[id] = r[id] || {};
      if (b.t === "question" && !r[id].choix) return;
      if (b.t === "libre" && !(r[id].texte || "").trim()) return;
      if (b.t === "releve") { if (!(r[id].texte || "").trim()) return; r[id].essais = (r[id].essais || 0) + 1; }
      r[id].valide = true;
      Fm.sauver(); rendre();
    }));
    el.querySelectorAll("[data-comparer]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.comparer; r[id] = r[id] || {}; r[id].__compare = !r[id].__compare; Fm.sauver(); rendre();
    }));
    el.querySelectorAll("[data-noter]").forEach((btn) => btn.addEventListener("click", () => {
      const x = capturerEssai(btn.dataset.noter);
      const msg = el.querySelector(`[data-msg]`);
      if (!x) { if (msg) msg.textContent = "Passez au moins une année dans la ferme avant de noter l'essai."; return; }
      e().cours.essais.push(x); Fm.sauver(); rendre();
    }));
    el.querySelectorAll("[data-suppr]").forEach((btn) => btn.addEventListener("click", () => { e().cours.essais.splice(Number(btn.dataset.suppr), 1); Fm.sauver(); rendre(); }));
    el.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => aller((e().cours.etape || 0) + Number(btn.dataset.nav))));
    const sel = el.querySelector("[data-aller]");
    if (sel) sel.addEventListener("change", () => aller(Number(sel.value)));
    el.querySelectorAll("[data-voir]").forEach((btn) => btn.addEventListener("click", () => Fm.montrer(btn.dataset.voir)));
    const imp = el.querySelector('[data-act="imprimer"]');
    if (imp) imp.addEventListener("click", () => {
      document.getElementById("impression").innerHTML = pageImprimable();
      document.body.classList.add("imprime"); window.print(); document.body.classList.remove("imprime");
    });
    const tel = el.querySelector('[data-act="telecharger"]');
    if (tel) tel.addEventListener("click", () => {
      const et = e();
      const donnees = { format: "ferme-carnet/1", exporteLe: new Date().toISOString(), code: et.cours.rep.codeEquipe || "",
        reponses: et.cours.rep, essais: et.cours.essais, situations: Object.fromEntries(Object.entries(et.jeux).map(([k, s]) => [k, J.exporter(s)])) };
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `avis-ferme-${String(et.cours.rep.codeEquipe && et.cours.rep.codeEquipe.v || "code").replace(/[^\w-]/g, "")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  // Arriving on a step opens its situation and switches on its words.
  function entrer(et) {
    if (et.situation === null) Fm.fermer(); else if (et.situation) Fm.ouvrir(et.situation);
    if (et.niveau) Fm.niveau(et.niveau);
  }
  function aller(i) {
    const c = e().cours;
    c.etape = Math.max(0, Math.min(ETAPES.length - 1, i));
    entrer(etape());
    Fm.sauver(); rendre();
    const corps = document.getElementById("carnet"); if (corps) corps.scrollTop = 0;
    Fm.montrer("carnet");
  }

  const api = { ETAPES, LEO, calc, simuler, ecarts, lireNombre, rendre, majConditions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.FermeCours = api;
    entrer(etape());
    rendre();
    Fm.rendre();
  }
})(typeof window !== "undefined" ? window : globalThis);
