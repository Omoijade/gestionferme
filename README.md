# La ferme du Thier — farm viability simulation

The design rationale is in `PROPOSITION.md`; the method is `../BUILDING-DECISION-SIMULATIONS.md`.
Student-facing text is French; code and notes are English.

## Run

Open `index.html` through any static server. In the Claude desktop app, the `clinique` server in
`../.claude/launch.json` serves the whole `SIMULATION` folder, at
<http://localhost:8899/ferme/index.html>. No build step and no dependencies. State is kept in
`localStorage` under `ferme-viabilite-v1`, so each student should use the same browser throughout.

## Verify — read the exit code, not the printed count

```bash
node tests.js; echo "TESTS=$?"
```

This runs 56 behavioural checks, including `outils/verifier-equations.js`, which reproduces Table 3
of Miserque & Marsin (2019). Each check was broken once, deliberately, to prove that it fails.

## Files

| File | Role |
|---|---|
| `model.js` | The farm, one year at a time. Pure and deterministic. The 2019 ratios, bounds and both equations. Builds the prediction verdict and its basis. |
| `jeu.js` | Game state: plan, pass the year, undo, settings, export, the cohort diagnostic. No DOM. |
| `vocab.js` | **Every word a student reads.** Plain names, course terms by level, action cards (facts only), interface strings. |
| `app.js` | The farm pane, and `window.Ferme`, through which the course drives it. |
| `cours.js` | The self-directed course: steps, tools, checks, the final advice. Every figure in it is computed from the model. |
| `index.html` | The two panes. On a narrow screen, one pane at a time, switched from the top bar. |
| `outils/verifier-equations.js` | Table 3 check against the shipped `model.js`. |

## What students open

**One page, `index.html`: the course (carnet) on the left, the farm on the right.** Three hours,
self-directed, with no teacher in the room, for one student or a small group. The course drives
the farm:

- each step opens its situation in the farm: D (getting to know the farm), A (Claire's two
  proposals), B (Léo wants to expand), C (Marc is exhausted, optional);
- the course words switch on at the naming steps (level 1 after A, level 2 after B), so they
  always arrive after the thing they name;
- figures read off the screen are checked against the farm;
- worked answers appear only after the student has committed their own;
- four tools (Avec ou sans, Le prêt, Le compte tient-il ?, Par heure) do the arithmetic on the
  student's own figures, and never run the farm forward;
- tries are recorded from the farm ("Noter cet essai"), and the final advice is printed or
  downloaded.

The farm is one screen in reading order: the question, what the family wants (four goals), the
years side by side, then the decisions. Loans appear as bands across the years they are repaid.
Detail opens in drawers. It shares the clinic's visual language (tokens, drawers, the pass-year
check), not its layout. Layout follows this simulation's lesson, which is about time.

The session design and its rationale are in `SEANCE.md`.

## Standing constraints

1. **Plain words first, course terms by level.** Levels (Réglages → Mots du cours):
   - 0 — plain words only;
   - 1 — produits, charges opérationnelles, marge brute, aides, situation de référence;
   - 2 — charges fixes, EBE, annuité, autofinancement, disponible, prélèvements privés, trésorerie;
   - 3 — main d'œuvre non salariée, Rcr, dettes, Rte, Rpa, Rrf, and the 2019 score (with its own block on « Où va l'argent »).

   In the self-directed page, the level is set by the course, not by a settings panel. A course term never replaces a plain name; it is attached beside it. The guard in
   `tests.js §13` fails if a course term enters any plain string or any displayable text in
   `app.js` outside the level-3 block. To add a term, add it to `TERMES` with its level.
2. **Action cards state facts (what, cost, when), never consequences.** The consequence is what
   students discover.
3. **The 2019 equation is used verbatim**, including the coefficient on Rrf that the report itself
   calls "inverse à la logique". This is the designed defensible-but-wrong rule; a test keeps it.
4. **No input for household income.** This is the designed silence. It matches the 2019 method's own
   boundary (p.2).
5. **Cows per hectare is shown and is measured against nothing.** This is the unrepresented party
   (the environment).
6. **Model figures are never typed into teaching material.** Generate them from `model.js`.

## Calibrated facts (measured, class code LIEGE)

The reference farm leaves about €65,000 a year for the family (13 €/h of family work); the price
dip falls in year 3. Adding 30 cows in year 1 (15-year loan, 10 % own money) gives a year 2 with
+24 % milk and the family €23,166 below continuing as before. From year 5 the family gets more
each year, but in year 8 the bank balance is still about €40,000 below the reference. Without the
loan repayment, the year-2 gap would be **positive** (+€2–4k): the repayment schedule is what
produces the trough. This holds for codes LIEGE, NAMUR, ARLON and MONS (tests §8).

## Not done yet

- **Facilitator guide (method step 9).** It should say when to switch each vocabulary level, and
  what students will already have seen by then. It must be generated from the model, with its own
  checker.
- **English interface.** Strings are centralised in `vocab.js`, but no English table exists yet.
- Heifers raised on the farm (a second delay) were left out to keep the decision set small.
