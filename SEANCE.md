# The 3-hour session — critique and proposal

> **Status (8 Oct 2026):** built as a self-directed page (`index.html`): the course beside the
> farm, with no teacher present. The five decisions in §4 were taken as recommended. Where this
> document mentions the lecturer (naming terms, the final discussion), the course now does it.
> Two-sided argument (Léo / Claire) replaces the group debate.

Written for the owner, before any further build. Students have no economics vocabulary and one
three-hour session, with a teaching HTML (the *carnet*) beside the simulation.

---

## 1. Critique of what exists

### The simulation asks nothing of the student

There is no goal. A student opens the farm and nothing is asked of them: "do nothing" is a
complete, untroubled way to play. The clinic gives scenario goals ("2/6") and, in the carnet, a
situation each day — someone in the clinic asking for something. The farm has neither, so a novice
has no reason to read the screen, and nothing to read it *for*.

### It has six actions but no situations

The six actions are presented as a menu. Novices don't choose well from a menu. They need a
**question**, coming from someone, about a specific choice.

### The interface copies a structure built for something else

The clinic has many separate parts (services, rooms, staff, prices), and its lesson is about one
moment: what limits the clinic this year. Tabs by area fit that. The farm has six decisions, and its
lesson is about **time**. In the current build:

- the answer to "when" is on its own tab, away from where the decision is made;
- the side panel compares only *this* year, which is the year in which an investment always looks worst;
- six tabs are six places to get lost in a three-hour session.

### The timeline mock-up fixes "when" but not "what for"

The timeline puts the years side by side, which is right. It is still a grid of 18 to 24 figures
with no question attached. Without a question, a novice reads a grid of numbers as a spreadsheet,
not as a story.

### There are no tools

The clinic carnet names each tool *inside* the task that needs it (marge par heure, délai de
récupération, point d'indifférence). The farm gives students nothing to calculate with. They can
watch the outcome, but they cannot work it out beforehand, so the prediction is a guess instead of
a reasoned estimate.

### Too much for one session

Eight years and four vocabulary levels, including the 2019 score with four ratios, is a week's
material, not three hours. **Recommendation: leave level 3 (the official score) out of this
session.** Keep it for a later course, or for an optional extension.

---

## 2. What a novice needs, in order

1. **Read the situation.** Who is this family, what do they have, what are they asking?
2. **Know what they want.** Several goals that cannot all be met at once.
3. **Decide something specific.** Choose between two or three options.
4. **Work it out before acting.** A small number of tools that answer "compared with continuing
   as before, what changes, when, and can they afford it?"
5. **Check against the simulation.** Commit, play the years, compare.
6. **Say it in their own words**, and only then receive the course word for it.

---

## 3. Proposal

### 3.1 The family has goals, and they conflict

Shown in the simulation as « Ce que la famille veut », ticked or not each year, like the clinic's
goals. **Not graded**: they are the family's goals, not the student's score.

| Goal | Whose | Measured by |
|---|---|---|
| Vendre plus de lait | the son, who wants to take over | lait vendu above « continuer comme avant » |
| Ne jamais être à découvert | the mother, who keeps the accounts | argent en banque ≥ 0 every year |
| Être payés au moins 10 € de l'heure | the method's own reference | gagné par heure de travail ≥ 10 € |
| Ne pas travailler plus qu'aujourd'hui | the father | heures qui manquent = 0 |

One goal is about production and three are about the family. When the son's goal is met, the
others break. That conflict *is* the distinction the course is after, and it appears through the
family, not through a definition. It also gives groups different, defensible positions to argue
from.

### 3.2 Two situations, plus one for groups who finish early

Each situation starts the simulation from a set state with a short horizon (two to four years).
Each comes with a question from a person.

**A — « Deux propositions pour le troupeau »** (warm-up, no loan, two years)
The feed salesman proposes more concentrates; you, the vet, propose a herd health plan. Measured
with code LIEGE: concentrates give **+48 000 L every year, and the family stays within €3 000 of
continuing as before**. The health plan costs about €4 000 in year 1, then gives **+15 000 L and
about +€4 000 a year** from year 2. Production and livelihood come apart, and so does timing, on
the smallest possible example.

**B — « Le fils veut agrandir »** (the core, four years)
+15 or +30 cows, a loan of 10, 15 or 20 years, 0 %, 10 % or 25 % paid from the family's own money.
The year after, there is +24 % milk and €23 000 less for the family, and the family is short of
hours. Students can try variants (smaller herd, longer loan, an employee) and undo freely.

**C — « Le père n'en peut plus »** (for early finishers)
This starts after the expansion: hours are missing. Robot, employee, or fewer cows? Hours and
money pull in opposite directions.

### 3.3 Four tools, each named in the task that needs it

They live in the carnet, as calculators in the clinic's style. Students type in numbers they find
on screen, and the tool only does the arithmetic. It never runs the farm forward: that would turn
the prediction into reading a figure off a screen.

| Tool (student's name) | What it computes | Needed in |
|---|---|---|
| **Avec ou sans** | per year: + ventes en plus − dépenses en plus − remboursement − part payée de sa poche = changement pour la famille | A, B |
| **Le prêt** | remboursement par an from amount, years, rate | B |
| **Le compte tient-il ?** | argent en banque each year = avant + reste pour la famille − ce que la famille prend pour vivre; lowest point | B, C |
| **Par heure** | reste pour la famille ÷ heures de la famille, compared with 10 € | B, C |

"Avec ou sans" is the course's question turned into a form. Filled in *before* playing the year,
it is the prediction, with the student's own figures behind it.

### 3.4 The simulation, simplified for this session

One home screen, in reading order:

1. **La question** — who is asking what, in one sentence, and « Ce que la famille veut »: four goals,
   each ticked or not.
2. **Les années** — the timeline with three rows (lait vendu, reste pour la famille, argent en
   banque), your farm and continuing as before, the current year live, and loans shown as a band
   across the years they cover.
3. **Les décisions** — only the decisions this situation offers (two in A, about four in B), each
   opening in a drawer as now.

Kept: the drawers, the pass-year check with its prediction, the Bilans (and "Où va l'argent" for
any year, as a drawer). Dropped: the area tabs and the side comparison panel.

### 3.5 The three hours

| Time | Students do | The lecturer names (vocabulary level) |
|---|---|---|
| 0:00 – 0:10 | **Before opening the simulation**, each person answers alone: « La ferme vend 25 % de lait en plus l'an prochain. La famille aura-t-elle plus pour vivre ? » | — |
| 0:10 – 0:35 | Getting started: find six figures on screen, pass one year without deciding anything, and note what moved | — (0) |
| 0:35 – 1:10 | **Situation A.** Fill in "Avec ou sans", predict, play two years, compare | situation de référence, marge brute (1) |
| 1:10 – 1:20 | Break | |
| 1:20 – 2:20 | **Situation B.** "Le prêt", then "Avec ou sans" for years 1–3, then "Le compte tient-il ?"; predict, play, reconcile with the Bilan; try a variant | EBE, annuité, autofinancement, disponible, trésorerie (2) |
| 2:20 – 2:45 | **Avis à la famille.** Each group writes one page from one family member's goal: recommendation, year table, can they afford it, what the simulation does not count | — |
| 2:45 – 3:00 | Two groups with different family members present; others contest | what the model leaves out: the household, the environment |

The 0:00 question is the diagnostic decided earlier (the two-thirds threshold). It is answered
before anything is taught, so it measures what students arrive with.

**Deliverable:** the « Avis à la famille ». **Assessed:** the argument (baseline stated, each
change dated, affordability checked, one limit named), never the farm's results.

---

## 4. Decisions for the owner

1. Situations A and B as the core, with C as an extension?
2. The four family goals, including the son's production goal?
3. Simplify the simulation to one home screen plus drawers plus Bilans for this session?
4. Tools in the carnet, filled in by hand (as in the clinic), rather than inside the simulation?
5. Leave the official 2019 score out of the three-hour session?
