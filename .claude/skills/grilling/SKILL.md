---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (code, docs, card data, the running site), look it up yourself; dispatch an Explore sub-agent only for a broad search whose file dumps you don't need. Don't ask the user for anything you could look up yourself. Don't block on a long lookup: only the questions downstream of it wait; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait. In porytools, how a card or game rule works counts as a decision too: the owner is the domain expert, so state what you believe and ask them to confirm.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding. Then write the outcome down where it belongs before building: a spec in `docs/`, rules in `docs/ux-guidelines.md`, milestones in `ROADMAP.md`, terms in `GLOSSARY.md`.

<!-- Adapted from mattpocock/skills (MIT, see ../LICENSE-mattpocock-skills): lookups done directly instead of always via sub-agent; porytools domain-expert and write-up notes added. -->

