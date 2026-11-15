# Writing a lesson

Every lesson is one ES module in this folder. It default-exports an object. It is registered in `index.js` (already done for all nine lessons). `src/pages/lesson.js` plays it inside the same shell every time:

1. **Intro:** objectives plus key words. This is the pre-training step.
2. **Steps:** one per step, one idea per step.
3. **Quiz:** no timer, unlimited retries.

`localisation.js` is the reference example. Copy its shape.

```js
export default {
  id: 'synapse',                       // must match index.js
  title: 'Synaptic transmission',
  objectives: ['…', '…', '…'],         // 3 short "you will" lines
  keywords: [{ term, simple, exam? }],   // 4–6 terms; `exam` is shown when the learner picks "Exam words"
  steps: [
    {
      title: 'Short literal title',
      simple: '<p>…</p>',                // the main text. Max ~60–80 words, 2–4 short <p>. Use <span class="keyterm"> for a new key word, <strong> for emphasis. NEVER <em>/<i>.
      exam: '<p>…</p>',                  // optional extra A-level detail (shown collapsed in Simple mode, open in Exam mode)
      callout: { type: 'exam' | 'mistake' | '', title: 'Exam tip', html: '<p>…</p>' }, // optional
    },
  ],
  quiz: [{ q, options: [..4], answer: 0, explain: 'why it is right', hint: 'gentle nudge if wrong' }],   // 3–5 questions
  summary: ['…', '…', '…'],            // "Remember" bullets shown with the quiz
  visual: {
    dark: false,                         // true = navy "stage" background (good for 3D/glowing animations)
    async create(container, { lesson }) {
      // Build the diagram/animation inside `container` (position:relative; it already has a size).
      // Must return { show(stepIndex, { level }), dispose() }.
      // stepIndex: -1 = intro, 0..steps.length-1 = that step, steps.length = quiz.
    },
  },
};
```

## Rules

- **Accuracy is everything.** Use the AQA terminology in `docs/curriculum-notes.md`. Don't invent studies, dates or numbers. If unsure, leave it out.
- **British English:** "behaviour", "colour", "oestrogen", "haemoglobin".
- **Inline SVG** (in `container`) is preferred for diagrams. Canvas or Three.js is fine for animation. Text in an SVG must use `fill="currentColor"` or theme-safe colours so it works in dark mode. The `.diagram` class gives the site font.
- **Signalling:** in each step, highlight only the part being talked about and dim everything else (CSS classes `.dim` / `.lit` are available). Use a label with a leader line next to the thing, not a separate legend.
- **Motion:** always check `reducedMotion()` from `../settings.js`. If it's true, show a still end-state (or step frames) instead of looping animation. Any animation must be calm, with no flashing faster than 3 times per second. Provide a "Play again" button (`.vis-controls` container) rather than infinite loops where possible.
- **Accessibility:**
  - Every visual needs `role="img"` plus an `aria-label`, or a visible caption (`<p class="vis-caption">`) describing what it shows at this step.
  - Buttons inside the visual must be real `<button>`s, at least 44px.
- **Dependencies:** no new npm dependencies. `three` is available.
- **Self-contained:** don't edit shared files (`styles.css`, `lesson.js`, `index.js`, `structures.js`) — put any extra CSS in a `<style>` block inside your visual, scoped under a unique class.
- **Check it compiles:** `npm run build`, run from `web/`.
