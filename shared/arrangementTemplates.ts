/**
 * ArrangementTemplate catalog — just the metadata (id + label + description).
 * The actual audio multipliers live in the client at
 * client/src/organism/state/ProducerArrangement.ts. This shared shape exists
 * so the server-side composer (Ollama) can be told the menu of available
 * structural forms and pick one. Composer writes the chosen id into
 * ArrangementPlan.templateId.
 *
 * Both sides must agree on the id set. When adding a new template:
 *   1. Add it to client/src/organism/state/ProducerArrangement.ts (the slots)
 *   2. Add it here (the metadata)
 *   3. The composer prompt automatically picks it up via ARRANGEMENT_TEMPLATE_CATALOG
 */

export interface ArrangementTemplateMeta {
  id:          string
  label:       string
  /** One-sentence description Ollama uses to pick the right template for the
   *  composed song. Keep it musical, not technical — "starts with the drop
   *  for impact" is more useful than "drop section is index 0." */
  description: string
}

export const ARRANGEMENT_TEMPLATE_CATALOG: ArrangementTemplateMeta[] = [
  {
    id:    'classic',
    label: 'Classic',
    description: 'Verse-build-drop-breakdown-drop form. Universally applicable; safe default for any genre.',
  },
  {
    id:    'dropfirst',
    label: 'Drop First',
    description: 'Opens with the drop/hook for immediate impact. Common in modern trap and club tracks.',
  },
  {
    id:    'lofi-loop',
    label: 'Lo-fi Loop',
    description: 'Gentle ebb-and-flow with no big drops. Best for chill, study, ambient backdrops.',
  },
  {
    id:    'dj-build',
    label: 'DJ Build & Drop',
    description: 'Long build into one massive drop, then breakdown and reprise. EDM/festival energy.',
  },
  {
    id:    'hook-heavy',
    label: 'Hook Heavy',
    description: 'Short verses with the hook/drop hitting frequently. Pop and modern hip-hop forms.',
  },
  {
    id:    'storytelling',
    label: 'Storytelling',
    description: 'Long verses with sparse hooks. Voice-forward, narrative-driven tracks like Nas or J. Cole.',
  },
  {
    id:    'cypher-flow',
    label: 'Cypher Flow',
    description: 'Just drums + bass looping. No drop, no breakdown. Pure freestyle backdrop where the rapper is the arrangement.',
  },
  {
    id:    'slow-burn',
    label: 'Slow Burn',
    description: 'Extra-long intro and gradual build, with the payoff landing hard at the end. Tension-driven.',
  },
  {
    id:    'trap-tag',
    label: 'Trap Tag-Team',
    description: 'Two short verses back-to-back before a big drop — mimics a feature/collab "tag-team" structure.',
  },
  {
    id:    'bridge-heavy',
    label: 'Bridge Heavy',
    description: 'Emphasizes the bridge with extended developmental harmony before the final hook. Pop/rock form.',
  },
  {
    id:    'back-and-forth',
    label: 'Back & Forth',
    description: 'Ping-pongs between verse and drop with no breakdown. Energetic, momentum-driven, no rest.',
  },
  {
    id:    'minimal-jam',
    label: 'Minimal Jam',
    description: 'One section loops indefinitely. Perfect for sustained freestyling or beat-driven practice sessions.',
  },
]
