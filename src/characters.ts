// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER DESIGNS — edit colours here and every scene picks them up.
// Colours were sampled from the reference sheets in /reference and brightened
// slightly for cel shading (base = lit tone, shadow = cel shadow tone).
// ─────────────────────────────────────────────────────────────────────────────

export interface Palette {
  /** Display name (also used as subtitle speaker label). */
  name: string;
  skin: { base: string; shadow: string; deep: string; blush: string };
  hair: { base: string; shadow: string; highlight: string; tip?: string; streak?: string };
  eyes: { iris: string; dark: string; light: string; lash: string };
  /** Outline ink colour (anime line art is rarely pure black). */
  line: string;
  outfit: Record<string, string>;
}

export const characters = {
  nolan: {
    name: 'Nolan',
    skin: { base: '#efcfb9', shadow: '#cfa28c', deep: '#a8786a', blush: '#e79a8c' },
    hair: { base: '#3e2c25', shadow: '#231714', highlight: '#7c5c4b' },
    eyes: { iris: '#7d5032', dark: '#2a160d', light: '#c48a5a', lash: '#1f1412' },
    line: '#2b1c19',
    outfit: {
      suit: '#202740', suitShadow: '#131829', suitLight: '#3a4466',
      shirt: '#eef0f5', shirtShadow: '#b9bfd0',
      tie: '#1b2033', tieLight: '#353d5c',
      phone: '#16181d',
    },
  },
  selene: {
    name: 'Selene',
    skin: { base: '#f3cfb4', shadow: '#d6a286', deep: '#b07a63', blush: '#f09c8e' },
    hair: { base: '#4d3428', shadow: '#2c1c15', highlight: '#8a6650' },
    eyes: { iris: '#8c5530', dark: '#2e170c', light: '#d39a62', lash: '#25150f' },
    line: '#33201a',
    outfit: {
      blouse: '#efe4cf', blouseShadow: '#cbb898',
      bodice: '#5a3b2a', bodiceShadow: '#3c271c',
      apron: '#e3d7bd', apronShadow: '#bfae8c',
      skirt: '#6b4632', lace: '#2a1a12', ribbon: '#efe6d3',
    },
  },
  aldric: {
    name: 'Aldric',
    skin: { base: '#e2b598', shadow: '#bf8d72', deep: '#956552', blush: '#dc927e' },
    hair: { base: '#2a2322', shadow: '#151110', highlight: '#5a5250', streak: '#7d7774' },
    eyes: { iris: '#5a3d2c', dark: '#1d120c', light: '#8f6a50', lash: '#1a1210' },
    line: '#2a1b16',
    outfit: {
      shirt: '#e6dccb', shirtShadow: '#b9aa92',
      vest: '#4f3424', vestShadow: '#332117', vestLight: '#6e4b35',
      stubble: '#5b4436',
    },
  },
  // Joseph: black eyes, black messy hair, skin between tan and light-brown
  // (leaning light-brown) — taken from the 5-year-old reference sheet.
  joseph: {
    name: 'Joseph',
    skin: { base: '#ebb48d', shadow: '#c98d68', deep: '#a46b4f', blush: '#ee9580' },
    hair: { base: '#1d1717', shadow: '#0c0909', highlight: '#4a3f3e' },
    eyes: { iris: '#2a2120', dark: '#0b0808', light: '#5d4d49', lash: '#120c0b' },
    line: '#2a1a14',
    outfit: {
      tunic: '#d9c09c', tunicShadow: '#b09370', patch: '#8f6f55', patch2: '#7d7f86',
      blanket: '#efe3cc', blanketShadow: '#cdb998', lace: '#5a3b2a',
    },
  },
  // Mira: pink-lavender pastel hair, violet eyes.
  mira: {
    name: 'Mira',
    skin: { base: '#f6c6ad', shadow: '#dd9c86', deep: '#bf7d6d', blush: '#f58f95' },
    hair: { base: '#f0a5c3', shadow: '#c27fa8', highlight: '#ffd6e6', tip: '#b49ddc' },
    eyes: { iris: '#9160cf', dark: '#3f2163', light: '#d2b2f2', lash: '#3a2230' },
    line: '#5a3340',
    outfit: { blanket: '#f2e6d0', blanketShadow: '#d2bf9e', trim: '#e7b9c9' },
  },
} satisfies Record<string, Palette>;

export type CharacterKey = keyof typeof characters;
