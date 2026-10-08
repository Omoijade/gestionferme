// The farm pane. One screen in reading order — the family's question, what the family wants,
// the years, the decisions — with detail in drawers. The course (cours.js) drives it through
// window.Ferme: it opens situations and switches the course words on.
(function () {
  "use strict";
  const M = window.FermeModel, J = window.FermeJeu, V = window.FermeVocab, U = V.UI;
  const CLE = "ferme-carnet-v1";

  // ---------------------------------------------------------------- state
  // One saved object: the course's progress and one game per situation.
  let etat = charger() || { version: 1, active: null, jeux: {}, cours: { etape: 0, rep: {}, essais: [], niveau: 0, vu: {} } };
  const ui = { tiroir: null, modale: null, brouillon: {}, toast: "", vueMobile: "carnet" };
  function charger() {
    try { const t = localStorage.getItem(CLE); if (!t) return null; const o = JSON.parse(t); return o && o.version === 1 ? o : null; }
    catch (e) { return null; }
  }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* storage unavailable */ } }
  const jeu = () => (etat.active ? etat.jeux[etat.active] : null);
  function remplacer(s) { etat.jeux[etat.active] = s; }
  // The course decides which words are on; every game reads the same level.
  const niveau = () => etat.cours.niveau || 0;

  // ---------------------------------------------------------------- formatting
  const nf = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf3 = new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  // fr-BE groups digits with a narrow space that vanishes at large sizes; use a full non-breaking space.
  const large = (f) => (v) => f(v).replace(/ /g, " ");
  const signe = (x, f) => (x < -0.5 ? "−" + large(f)(-x) : large(f)(Math.abs(x) < 0.5 ? 0 : x));
  const eur = (x) => signe(Math.round(x), nf.format) + " €";
  const eurSigne = (x) => (Math.round(x) > 0 ? "+" : "") + eur(x);
  const num = (x) => signe(Math.round(x), nf.format);
  const parHeure = (x) => signe(x * 10, (v) => nf1.format(v / 10)) + " €/h";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const F = { eur, eurSigne, num, parHeure, nf3, esc };

  // A quantity's on-screen name: the plain word, plus the course word once the course has given it.
  function nom(cle, sansTerme) {
    const t = V.TERMES[cle];
    if (!t) return esc(cle);
    const terme = !sansTerme && t.cours && niveau() >= t.niveau
      ? ` <span class="terme" title="${esc(t.phrase)}">${esc(t.cours)}</span>` : "";
    return `${esc(t.simple)}${terme}`;
  }
  const simple = (cle) => esc(V.TERMES[cle].simple);
  const titreAction = (p) => V.ACTIONS[p.action].titre + (p.action === "agrandir" ? ` (+${p.vaches})` : "");

  const changementsRecurrents = (s) => M.RECURRENTS.filter((k) => !!s.recurrents[k] !== !!s.recurrentsPrec[k]);
  function apercuAvec(modif) { const c = JSON.parse(JSON.stringify(jeu())); modif(c); return J.apercu(c); }

  // ---------------------------------------------------------------- render
  function rendre() {
    sauver();
    const el = document.getElementById("ferme");
    if (!el) return;
    const corps = document.querySelector("#couches .drawer-body");
    const defilement = corps && corps.dataset.corpsTiroir === ui.tiroir ? corps.scrollTop : 0;
    const s = jeu();
    el.innerHTML = s ? vueFerme(s) : `<div class="ferme-fermee"><p>${esc(U.fermeFermee)}</p></div>`;
    document.getElementById("couches").innerHTML = s ? `${ui.tiroir ? tiroir(s) : ""}${ui.modale === "passer" && !s.termine ? modalePasser(s) : ""}`
      + (ui.toast ? `<div class="toast good" role="status">${esc(ui.toast)}</div>` : "") : "";
    brancher();
    const nouveau = document.querySelector("#couches .drawer-body");
    if (nouveau && defilement) nouveau.scrollTop = defilement;
    document.body.dataset.vue = ui.vueMobile;
    if (window.FermeCours) window.FermeCours.majConditions();
    if (ui.toast) {
      const t = ui.toast;
      setTimeout(() => { if (ui.toast === t) { ui.toast = ""; const x = document.querySelector(".toast"); if (x) x.remove(); } }, 2200);
    }
  }

  function vueFerme(s) {
    const ap = s.termine ? null : J.apercu(s);
    const sit = V.SITUATIONS[s.situation];
    const qui = sit.qui ? V.FAMILLE[sit.qui] : null;
    const derniere = s.annees[s.annees.length - 1];
    const obj = ap ? J.objectifs(s, ap.plan, ap.ref) : derniere ? derniere.objectifs : null;
    const anneeObj = ap ? s.annee : derniere ? derniere.annee : 1;
    return `
      <header class="ferme-tete">
        <div><span class="sur-titre">${esc(U.titre)}${["A", "B", "C"].includes(s.situation) ? ` · ${esc(U.situation)} ${esc(s.situation)}` : ""}</span><h2>${esc(sit.titre)}</h2></div>
        <div class="ferme-chiffres">
          <div><span>${esc(U.annee(Math.min(s.annee, s.reglages.horizon), s.reglages.horizon))}</span><strong>${s.termine ? esc(U.finTitre) : ""}</strong></div>
          <div><span>${simple("banque")}</span><strong class="${s.banque < 0 ? "bad-text" : ""}">${eur(s.banque)}</strong></div>
        </div>
        <div class="ferme-actions">
          <button class="button secondary" data-act="revenir"${s.pile.length ? "" : " disabled"}>↶ ${esc(U.revenirCourt)}</button>
          <button class="button secondary" data-act="recommencer">${esc(U.recommencerSituation)}</button>
          <button class="button secondary" data-ouvrir="lexique">${esc(U.lexique)}</button>
        </div>
      </header>
      <section class="bloc-question">
        ${qui ? `<div class="avatar" aria-hidden="true">${esc(qui.nom[0])}</div>` : ""}
        <div><span class="sur-titre">${esc(U.laQuestion)}${qui ? ` — ${esc(qui.nom)}, ${esc(qui.role)}` : ""}</span><p>« ${esc(sit.question)} »</p></div>
      </section>
      ${obj ? blocObjectifs(obj, anneeObj) : ""}
      ${frise(s, ap)}
      ${ap ? signaux(s, ap) : ""}
      ${s.termine ? `<p class="panel-note fort">${esc(U.situationTerminee)}</p>` : decisions(s)}`;
  }

  function blocObjectifs(obj, annee) {
    return `<section class="carte"><div class="carte-tete"><h3>${esc(U.ceQueVeut)}</h3><span>${esc(U.ceQueVeutNote(annee))}</span></div>
      <ul class="objectifs">${J.OBJECTIFS.map((k) => `<li class="${obj[k] ? "ok" : "pas"}"><span class="pastille-obj" aria-hidden="true">${obj[k] ? "✓" : "✗"}</span>
        <span><b>${esc(V.OBJECTIFS[k].qui)}</b> — ${esc(V.OBJECTIFS[k].texte)}</span><span class="sr-only">${esc(obj[k] ? U.oui : U.non)}</span></li>`).join("")}</ul></section>`;
  }

  // The years side by side: the decision and its delayed effect on one screen.
  function frise(s, ap) {
    const H = s.reglages.horizon;
    const refs = J.trajectoire(s, H);
    const joue = (a) => s.annees.find((x) => x.annee === a);
    const prev = (a) => s.predictions.find((p) => p.cible === a);
    const cols = `grid-template-columns: minmax(112px, .9fr) repeat(${H}, minmax(92px, 1fr))`;
    const entete = Array.from({ length: H }, (_, i) => {
      const a = i + 1, courant = ap && a === s.annee, fait = !!joue(a);
      return `<button class="frise-an ${courant ? "courant" : ""} ${fait ? "fait" : ""}" ${fait || courant ? `data-tiroir="annee-${a}"` : "disabled"}>
        ${esc(U.detailAnnee(a))}${courant ? `<small>${esc(U.enPreparation)}</small>` : ""}</button>`;
    }).join("");
    const rang = (cle, label, fmt, cls) => {
      const cellules = Array.from({ length: H }, (_, i) => {
        const a = i + 1, r = joue(a), courant = ap && a === s.annee;
        if (r || courant) {
          const p = r ? r.plan : ap.plan, rf = r ? r.ref : refs[i];
          return `<div class="cellule ${courant ? "courant" : ""} ${p[cle] < 0 ? "neg" : ""}"><strong>${fmt(p[cle])}</strong><small>${fmt(rf[cle])}</small></div>`;
        }
        const pr = cle === "disponible" && prev(a);
        return `<div class="cellule vide">${pr ? `<span class="prevision">${esc(U.votrePrevision)} : ${esc(U.choix[pr.choix])}</span>` : ""}</div>`;
      }).join("");
      return `<div class="frise-label ${cls || ""}">${label}</div>${cellules}`;
    };
    // Loans: drawn across the years they are repaid (facts known when signing).
    const prets = M.pretsDe(s.projets).map((pr) => {
      const debut = Math.max(1, pr.debut), fin = pr.debut + pr.duree - 1;
      const libelle = pr.libelle === "pretExistant" ? U.pretAncien : V.ACTIONS[pr.libelle].titre;
      const texte = `${eur(M.annuiteConstante(pr.montant, pr.taux, pr.duree))} ${esc(U.parAn)} · ${esc(U.jusquA(fin))}`;
      if (debut > H) return `<div class="frise-label petit">${esc(libelle)}</div><div class="bande" style="grid-column: ${H + 1} / span 1">${texte}</div>`;
      const span = Math.min(H, fin) - debut + 1;
      return `<div class="frise-label petit">${esc(libelle)}</div>${debut > 1 ? `<div style="grid-column: 2 / span ${debut - 1}"></div>` : ""}<div class="bande" style="grid-column: ${debut + 1} / span ${span}">${texte}</div>`;
    }).join("");
    return `<section class="carte"><div class="carte-tete"><h3>${esc(U.lesAnnees)}</h3><span>${esc(U.lesAnneesNote)}</span></div>
      <div class="frise-defile"><div class="frise" style="${cols}">
        <div></div>${entete}
        ${rang("litres", nom("lait"), num)}
        ${rang("disponible", `<b>${nom("disponible")}</b>`, eur, "fort")}
        ${rang("banqueFin", esc(U.banqueFin), eur)}
        ${rang("gainHoraire", nom("gainHoraire"), parHeure)}
        <div class="frise-sep" style="grid-column: 1 / -1">${esc(U.ceQuiEstSigne)} — ${simple("annuite")}</div>
        ${prets}
      </div></div></section>`;
  }

  function signaux(s, ap) {
    const { plan } = ap, out = [];
    if (plan.heuresManquantes > 0) out.push(["bad", U.signalHeures(num(plan.heuresManquantes), num(plan.litresPerdus))]);
    if (plan.banqueFin < -s.reglages.limiteDecouvert) out.push(["bad", U.alerteBanque]);
    else if (plan.banqueFin < 0) out.push(["warn", U.signalBanque(eur(plan.banqueFin))]);
    const auDessus = Math.round(Math.max(0, plan.vaches - M.P.seuilVachesParHa * plan.ha));
    if (auDessus > 0) out.push(["warn", U.signalFourrage(auDessus)]);
    return out.length ? `<ul class="signaux">${out.map(([t, x]) => `<li class="signal-${t}">${esc(x)}</li>`).join("")}</ul>` : "";
  }

  function etatDecision(s, cle) {
    if (cle === "agrandir" || cle === "robot") {
      const ps = s.projets.filter((p) => p.action === cle);
      if (!ps.length) return esc(U.etatAucunProjet);
      return ps.map((p) => esc(p.decide === s.annee ? `${titreAction(p)} — ${U.etatPlan}` : p.decide < 1 ? titreAction(p) : U.etatProjet(titreAction(p), p.decide))).join("<br>");
    }
    const on = !!s.recurrents[cle], change = on !== !!s.recurrentsPrec[cle];
    return esc(on ? U.enPlace : U.pasEnPlace) + (change ? ` <small>— ${esc(U.etatPlan)}</small>` : "");
  }

  function decisions(s) {
    const permises = J.SITUATIONS[s.situation].decisions;
    const choisies = s.projets.filter((p) => p.decide === s.annee).map((p) => `<li><span>${esc(titreAction(p))}</span>
        <button data-retirer-projet="${p.id}" aria-label="${esc(U.retirerDuPlan)}" title="${esc(U.retirerDuPlan)}">×</button></li>`)
      .concat(changementsRecurrents(s).map((k) => `<li><span>${esc(V.ACTIONS[k].titre)} : ${esc(s.recurrents[k] ? U.enPlace : U.pasEnPlace)}</span>
        <button data-retirer-rec="${k}" aria-label="${esc(U.retirerDuPlan)}" title="${esc(U.retirerDuPlan)}">×</button></li>`));
    return `<section class="carte"><div class="carte-tete"><h3>${esc(U.decisionsDeLAnnee(s.annee))}</h3><span>${esc(U.decisionsNote)}</span></div>
      <div class="action-menu">${permises.map((k) =>
        `<button data-tiroir="${k}"><span>${esc(V.ACTIONS[k].titre)}</span><strong>${etatDecision(s, k)}</strong><em>›</em></button>`).join("")}</div>
      <div class="plan-bas">
        ${choisies.length ? `<ul class="choisies">${choisies.join("")}</ul>` : `<p class="empty">${esc(U.aucuneCetteAnnee)}</p>`}
        <button class="button primary pass-button" data-act="ouvrir-passer">${esc(U.passer(s.annee))}</button>
      </div></section>`;
  }

  // ---------------------------------------------------------------- drawers
  function tiroir(s) {
    const t = ui.tiroir;
    let titre = "", corps = "";
    const an = /^annee-(\d+)$/.exec(t || "");
    if (an) { const a = Number(an[1]); titre = s.annee === a && !s.termine ? U.detailAnneeApercu(a) : U.detailAnnee(a); corps = tiroirAnnee(s, a); }
    else if (V.ACTIONS[t] && !s.termine && J.permis(s, t)) { titre = V.ACTIONS[t].titre; corps = M.RECURRENTS.includes(t) ? tiroirRecurrent(s, t) : tiroirInvestissement(s, t); }
    else if (t === "lexique") { titre = U.lexique; corps = tiroirLexique(); }
    else return "";
    return `<div class="drawer-backdrop" data-act="fermer-tiroir"><section class="drawer" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
      <div class="drawer-head"><div><span>‹ ${esc(V.SITUATIONS[s.situation].titre)}</span><h2>${esc(titre)}</h2></div><button data-act="fermer-tiroir-bouton" aria-label="${esc(U.fermer)}">×</button></div>
      <div class="drawer-body" data-corps-tiroir="${esc(t)}">${corps}</div></section></div>`;
  }

  function faits(cle) {
    const a = V.ACTIONS[cle];
    return `<p>${esc(a.texte)}</p><dl class="faits"><div><dt>Coût</dt><dd>${esc(a.cout)}</dd></div><div><dt>Quand</dt><dd>${esc(a.quand)}</dd></div>
      ${a.bon ? `<div><dt>Bon à savoir</dt><dd>${esc(a.bon)}</dd></div>` : ""}</dl>`;
  }
  function effetCetteAnnee(apres) {
    const { plan, ref } = apres;
    const rang = (label, r, p, fmt) => `<div class="forecast-row trois"><strong>${label}</strong><span>${fmt(r)}</span><span>${fmt(p)}</span></div>`;
    return `<section class="effet"><h3>${esc(U.effetCetteAnnee)}</h3>
      <div class="forecast-table"><div class="forecast-head trois"><span></span><span>${simple("reference")}</span><span>${esc(U.votrePlan)}</span></div>
        ${rang(simple("lait"), ref.litres, plan.litres, num)}
        ${rang(simple("disponible"), ref.disponible, plan.disponible, eur)}
        ${rang(esc(U.banqueFin), ref.banqueFin, plan.banqueFin, eur)}
      </div><p class="panel-note">${esc(U.effetNote)}</p></section>`;
  }
  function tiroirInvestissement(s, cle) {
    if (cle === "robot" && s.projets.some((p) => p.action === "robot")) return faits(cle) + `<p class="panel-note">${etatDecision(s, cle)}</p>`;
    const b = ui.brouillon[cle] || (ui.brouillon[cle] = { action: cle, vaches: 30, duree: 15, apportPct: 10 });
    const choix = (champ, valeurs, suffixe) => `<fieldset class="chips"><legend>${esc(champ === "vaches" ? U.nbVaches : champ === "duree" ? U.dureePret : U.apport)}</legend>
      ${valeurs.map((v) => `<label><input type="radio" name="${champ}" value="${v}" data-brouillon="${cle}" data-champ="${champ}"${b[champ] === v ? " checked" : ""}><span>${v}${suffixe}</span></label>`).join("")}</fieldset>`;
    const p = { ...b, decide: s.annee };
    const emprunt = M.coutProjet(p) - M.apportProjet(p);
    const apres = apercuAvec((c) => J.ajouterProjet(c, b));
    return `${faits(cle)}
      ${s.projets.some((x) => x.action === cle) ? `<p class="panel-note">${etatDecision(s, cle)}</p>` : ""}
      <div class="form-stack">
        ${cle === "agrandir" ? choix("vaches", J.OPTIONS.vaches, "") : ""}
        ${choix("duree", J.OPTIONS.duree, " " + U.ans)}
        ${choix("apportPct", J.OPTIONS.apportPct, " %")}
      </div>
      <section class="effet"><h3>${esc(U.ceQueVousSignez)}</h3><div class="mini-metrics trois">
        <article class="metric-card"><span>${esc(U.apport)}</span><strong>${eur(M.apportProjet(p))}</strong></article>
        <article class="metric-card"><span>${esc(U.pretMontant)}</span><strong>${eur(emprunt)}</strong></article>
        <article class="metric-card"><span>${esc(U.remboursementAnnuel)}</span><strong>${eur(M.annuiteConstante(emprunt, M.P.tauxPret, b.duree))}</strong><em>${esc(U.pendant(b.duree))}</em></article>
      </div></section>
      ${effetCetteAnnee(apres)}
      <div class="button-row"><button class="button primary" data-act="ajouter" data-action="${cle}">${esc(U.ajouter)}</button></div>`;
  }
  function tiroirRecurrent(s, cle) {
    const on = !!s.recurrents[cle], change = on !== !!s.recurrentsPrec[cle];
    const apres = apercuAvec((c) => J.basculer(c, cle, !on));
    return `${faits(cle)}
      <p class="panel-note"><b>${esc(U.actuellement)} :</b> ${etatDecision(s, cle)}</p>
      ${effetCetteAnnee(apres)}
      <div class="button-row"><button class="button primary" data-act="basculer" data-cle="${cle}" data-valeur="${on ? "0" : "1"}">${esc(change ? U.retirerDuPlan : on ? U.arreter : U.mettreEnPlace)}</button></div>`;
  }

  // One year in detail: its review if it has been played, and where the money went.
  function tiroirAnnee(s, a) {
    const r = s.annees.find((x) => x.annee === a);
    const { plan, ref } = r ? { plan: r.plan, ref: r.ref } : J.apercu(s);
    return `${r ? contenuBilan(r) : ""}<h3 class="titre-bloc">${esc(U.onglets.argent)}</h3>${cascade(plan, ref)}`;
  }
  function cascade(plan, ref) {
    const L = [];
    const ligne = (label, rv, pv, cls = "", fmt = eur) => L.push(`<tr class="${cls}"><th scope="row">${label}</th><td>${fmt(rv)}</td><td>${fmt(pv)}</td></tr>`);
    ligne(nom("lait") + " (L)", ref.litres, plan.litres, "", num);
    ligne(nom("prix") + " (€/L)", ref.prix, plan.prix, "", (x) => nf3.format(x));
    ligne(nom("ventes"), ref.ventes, plan.ventes);
    ligne("− " + nom("chargesVaches"), ref.chargesVaches, plan.chargesVaches, "moins");
    ligne("= " + nom("margeBrute"), ref.margeBrute, plan.margeBrute, "sous-total");
    ligne("+ " + nom("aides"), ref.aides, plan.aides, "plus");
    ligne("− " + nom("chargesFixes"), ref.chargesFixes, plan.chargesFixes, "moins");
    ligne("= " + nom("ebe"), ref.ebe, plan.ebe, "sous-total");
    ligne("− " + nom("annuite"), ref.annuite, plan.annuite, "moins");
    ligne("− " + nom("autofinancement"), ref.autofinancement, plan.autofinancement, "moins");
    if (ref.interetsDecouvert || plan.interetsDecouvert) ligne("− " + nom("interetsDecouvert"), ref.interetsDecouvert, plan.interetsDecouvert, "moins");
    ligne("= " + nom("disponible"), ref.disponible, plan.disponible, "total");
    ligne("− " + nom("prelevements"), ref.prelevements, plan.prelevements, "moins");
    ligne(esc(U.banqueDebut), ref.banqueDebut, plan.banqueDebut, "banque");
    ligne(esc(U.banqueFin), ref.banqueFin, plan.banqueFin, "banque fort");
    ligne(esc(U.heuresNecessaires), ref.heuresFamilleNecessaires, plan.heuresFamilleNecessaires, "", num);
    ligne(esc(U.heuresManquantes), ref.heuresManquantes, plan.heuresManquantes, "", num);
    ligne(esc(U.laitPerdu) + " (L)", ref.litresPerdus, plan.litresPerdus, "", num);
    ligne(nom("gainHoraire"), ref.gainHoraire, plan.gainHoraire, "fort", parHeure);
    return `<table class="cascade"><thead><tr><th></th><th>${nom("reference")}</th><th>${esc(U.votrePlan)}</th></tr></thead><tbody>${L.join("")}</tbody></table>`;
  }

  function contenuBilan(a) {
    const d = a.decisions;
    const decs = d.projets.map((p) => `${titreAction(p)} — ${p.duree} ${U.ans}, ${p.apportPct} %`)
      .concat(M.RECURRENTS.filter((k) => !!d.recurrents[k] !== !!d.recurrentsPrec[k]).map((k) => `${V.ACTIONS[k].titre} : ${d.recurrents[k] ? U.enPlace : U.pasEnPlace}`));
    return `<p class="decisions-annee"><b>${esc(U.decisionsTitre)} :</b> ${decs.length ? decs.map(esc).join(" · ") : esc(U.aucuneDecision)}</p>
      ${a.adjudication ? blocAdjudication(a.adjudication) : ""}
      ${a.banqueBloquee ? `<p class="form-error">${esc(U.banqueBloquee)}</p>` : ""}
      <label class="note">${esc(U.noteObserve)}<textarea data-act="observe" data-annee="${a.annee}" rows="3">${esc(a.notes.observe)}</textarea></label>`;
  }
  function blocAdjudication(ad) {
    const C = U.choix;
    const liste = (sel) => sel.map((p) => `<li><span>${nom(p.cle)}</span><em class="${p.effet < 0 ? "bad-text" : "good-text"}">${eurSigne(p.effet)}</em></li>`).join("");
    const plus = ad.parts.filter((p) => p.effet > 0), moins = ad.parts.filter((p) => p.effet < 0);
    const somme = (sel) => sel.reduce((t, p) => t + p.effet, 0);
    return `<div class="prediction-verdict ${ad.juste ? "matched" : "missed"}">
      <p><span class="etiquette">${esc(U.vousAviezPrevu)}</span> ${esc(C[ad.choix])} <small>(${esc(U.predictionEn(ad.faiteEn))})</small></p>
      ${ad.choix2 ? `<p><span class="etiquette">${esc(U.avisDuGroupe)}</span> ${esc(C[ad.choix2])}</p>` : ""}
      <p><span class="etiquette">${esc(U.resultat)}</span> <b>${esc(C[ad.verdict])}</b> : ${eurSigne(ad.ecart)} · ${simple("lait")} ${num(ad.litresRef)} → ${num(ad.litresPlan)}</p>
      <h3>${esc(U.ceQuiAFait)}</h3>
      <div class="why-grid">
        <article><h3>${esc(U.enPlusPourFamille)}</h3><ul>${liste(plus) || `<li>${esc(U.vide)}</li>`}</ul><strong class="good-text">${eurSigne(somme(plus))}</strong></article>
        <article><h3>${esc(U.enMoinsPourFamille)}</h3><ul>${liste(moins) || `<li>${esc(U.vide)}</li>`}</ul><strong class="bad-text">${eurSigne(somme(moins))}</strong></article>
      </div>
      <p class="total-ecart">= ${eurSigne(ad.ecart)} ${esc(U.pourLaFamille)}</p>
      <p>${esc(U.reponseProche(C[ad.plusProche.choix], eur(ad.plusProche.distance)))}</p>
      <p class="arguable">${esc(U.nonCompte)}</p>
    </div>`;
  }

  function tiroirLexique() {
    const niv = niveau();
    const lignes = Object.values(V.TERMES).filter((t) => niv >= (t.ecran || 0)).map((t) => `<article>
      <h3>${esc(t.simple)}${t.cours && niv >= t.niveau ? ` <span class="terme">${esc(t.cours)}</span>` : ""}</h3>
      <p>${esc(t.phrase)}</p></article>`).join("");
    return `<div class="etapes">${lignes}</div>`;
  }

  // ---------------------------------------------------------------- pass-year check
  function modalePasser(s) {
    const ap = J.apercu(s);
    const Y = s.annee, peutPrevoir = Y < s.reglages.horizon;
    const decs = s.projets.filter((p) => p.decide === Y).map(titreAction)
      .concat(changementsRecurrents(s).map((k) => `${V.ACTIONS[k].titre} : ${s.recurrents[k] ? U.enPlace : U.pasEnPlace}`));
    const alertes = [];
    if (ap.plan.heuresManquantes > 0) alertes.push(U.signalHeures(num(ap.plan.heuresManquantes), num(ap.plan.litresPerdus)));
    if (ap.plan.banqueFin < 0) alertes.push(U.signalBanque(eur(ap.plan.banqueFin)));
    const options = (vide) => `<option value="">${esc(vide)}</option>${M.CHOIX.map((c) => `<option value="${c}">${esc(U.choix[c])}</option>`).join("")}`;
    return `<div class="modal-backdrop"><form class="modal" data-form="passer" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(U.pretAPasser(Y))}</h2><button type="button" data-act="fermer-modale" aria-label="${esc(U.fermer)}">×</button></div>
      <h3>${esc(U.decisionsPrevues)}</h3>
      ${decs.length ? `<ul>${decs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : `<p>${esc(U.aucuneDecision)}</p>`}
      ${alertes.length ? `<h3>${esc(U.avertissements)}</h3><ul class="alertes">${alertes.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      ${peutPrevoir ? `<div class="prediction-ask"><label><strong>${esc(U.question(Y + 1))}</strong><select name="choix">${options(U.passerSansPrevoir)}</select></label>
        <label class="petit">${esc(U.avisDifferent)} <select name="choix2">${options(U.vide)}</select></label>
        <small>${esc(U.rienNestScore)}</small></div>` : ""}
      <label class="note">${esc(U.notePourquoi)}<textarea name="pourquoi" rows="2"></textarea></label>
      <div class="button-row"><button type="button" class="button secondary" data-act="fermer-modale">${esc(U.annuler)}</button>
        <button type="submit" class="button primary">${esc(U.confirmer)} ${Y}</button></div>
    </form></div>`;
  }

  // ---------------------------------------------------------------- events
  function brancher() {
    const on = (sel, ev, f) => document.querySelectorAll(`#ferme ${sel}, #couches ${sel}`).forEach((el) => el.addEventListener(ev, f));
    const s = jeu();
    on("[data-tiroir]", "click", (e) => { ui.tiroir = e.currentTarget.dataset.tiroir; rendre(); });
    on("[data-ouvrir]", "click", (e) => { ui.tiroir = e.currentTarget.dataset.ouvrir; rendre(); });
    on('[data-act="fermer-tiroir"]', "click", (e) => { if (e.target === e.currentTarget) { ui.tiroir = null; rendre(); } });
    on('[data-act="fermer-tiroir-bouton"]', "click", () => { ui.tiroir = null; rendre(); });
    on("[data-retirer-projet]", "click", (e) => { J.retirerProjet(s, Number(e.currentTarget.dataset.retirerProjet)); rendre(); });
    on("[data-retirer-rec]", "click", (e) => { const k = e.currentTarget.dataset.retirerRec; J.basculer(s, k, !!s.recurrentsPrec[k]); rendre(); });
    on("[data-brouillon]", "change", (e) => { const el = e.currentTarget; ui.brouillon[el.dataset.brouillon][el.dataset.champ] = Number(el.value); rendre(); });
    on('[data-act="ajouter"]', "click", (e) => {
      try { J.ajouterProjet(s, ui.brouillon[e.currentTarget.dataset.action]); ui.toast = U.ajoute; } catch (err) { /* option refused */ }
      ui.tiroir = null; rendre();
    });
    on('[data-act="basculer"]', "click", (e) => {
      const el = e.currentTarget;
      J.basculer(s, el.dataset.cle, el.dataset.valeur === "1");
      ui.toast = U.ajoute; ui.tiroir = null; rendre();
    });
    on('[data-act="observe"]', "input", (e) => { J.noterObserve(s, Number(e.currentTarget.dataset.annee), e.currentTarget.value); sauver(); });
    on('[data-act="ouvrir-passer"]', "click", () => { ui.tiroir = null; ui.modale = "passer"; rendre(); });
    on('[data-act="fermer-modale"]', "click", () => { ui.modale = null; rendre(); });
    on('[data-act="revenir"]', "click", () => { remplacer(J.revenir(s)); ui.modale = null; ui.tiroir = null; rendre(); });
    on('[data-act="recommencer"]', "click", () => {
      if (confirm(U.confirmerRecommencer)) { remplacer(J.nouvellePartie(s.reglages, s.situation)); ui.tiroir = null; ui.brouillon = {}; rendre(); }
    });
    const fp = document.querySelector('#couches [data-form="passer"]');
    if (fp) fp.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const d = new FormData(fp);
      const r = J.passerAnnee(s, { choix: d.get("choix") || null, choix2: d.get("choix2") || null, pourquoi: d.get("pourquoi") || "" });
      ui.modale = null; ui.brouillon = {};
      ui.tiroir = `annee-${r.annee}`;   // show what the year gave, straight away
      rendre();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (ui.modale) { ui.modale = null; rendre(); } else if (ui.tiroir) { ui.tiroir = null; rendre(); }
  });

  // ---------------------------------------------------------------- API for the course
  window.Ferme = {
    M, J, V, F, nom,
    etat: () => etat,
    jeu, sauver, rendre,
    // Open a situation; keeps its game if it was already started, unless `neuf`.
    ouvrir(id, neuf) {
      if (neuf || !etat.jeux[id]) etat.jeux[id] = J.nouvellePartie({ codeClasse: etat.cours.codeClasse || J.REGLAGES_DEFAUT.codeClasse }, id);
      etat.active = id; ui.tiroir = null; ui.modale = null; ui.brouillon = {};
      rendre();
    },
    fermer() { etat.active = null; ui.tiroir = null; ui.modale = null; rendre(); },
    niveau(n) { if (n > niveau()) { etat.cours.niveau = n; rendre(); } },
    montrer(vue) { ui.vueMobile = vue; document.body.dataset.vue = vue; },
    effacerTout() { try { localStorage.removeItem(CLE); } catch (e) { /* ignore */ } location.reload(); },
  };
})();
