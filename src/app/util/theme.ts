export type ColorScheme = 'light' | 'dark';

/**
 * Standard CSS variables set on <body> by src/theme/common.scss, light.scss and dark.scss.
 * Keep in sync with docs/STRUCTURE.md.
 */
export const THEME_VARS: { name: string, description: string }[] = [
  { name: '--bg', description: $localize`Page background` },
  { name: '--bg-accent', description: $localize`Subtle background for panels and tabs` },
  { name: '--bg-hover', description: $localize`Background on hover and drop targets` },
  { name: '--bg-active', description: $localize`Background while pressed or selected` },
  { name: '--text', description: $localize`Main text colour` },
  { name: '--link', description: $localize`Link colour` },
  { name: '--visited', description: $localize`Visited link colour` },
  { name: '--active', description: $localize`Highlights such as the current page and new response counts` },
  { name: '--info', description: $localize`Secondary text such as row info, quotes and timestamps` },
  { name: '--tag', description: $localize`Inline tag links and accents` },
  { name: '--tag-accent', description: $localize`Inline tag link background (light theme)` },
  { name: '--blue', description: $localize`Tab bar background (light theme)` },
  { name: '--toggle', description: $localize`Toggle button background` },
  { name: '--toggle-accent', description: $localize`Toggle button background on hover` },
  { name: '--toggle-active', description: $localize`Toggle button background while pressed` },
  { name: '--toggle-border', description: $localize`Toggle button border` },
  { name: '--form-bg', description: $localize`Form input background` },
  { name: '--border', description: $localize`Main border colour` },
  { name: '--border-accent', description: $localize`Softer border for editors and cards` },
  { name: '--border-light', description: $localize`Faint border for cards` },
  { name: '--unselected-tab', description: $localize`Background of inactive tabs` },
  { name: '--error', description: $localize`Error text` },
  { name: '--error-bg', description: $localize`Error and login prompt background` },
  { name: '--warning', description: $localize`Warning text and borders` },
  { name: '--mod', description: $localize`Title colour of pinned refs` },
  { name: '--card', description: $localize`Card background (kanban, todo, chat, notes, ...)` },
  { name: '--card-dragging', description: $localize`Card background while dragging` },
  { name: '--placeholder', description: $localize`Drop placeholder background` },
  { name: '--deleting', description: $localize`Background of items about to be deleted` },
  { name: '--quote', description: $localize`Blockquote border in markdown` },
];

function matches(selectorText: string, selector: string) {
  return selectorText.split(',').some(s => s.trim() === selector);
}

function readRules(doc: Document, selector: string, result: Record<string, string>) {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const style = (rule as CSSStyleRule).style;
      if (!style || !matches((rule as CSSStyleRule).selectorText || '', selector)) continue;
      for (const v of THEME_VARS) {
        const value = style.getPropertyValue(v.name).trim();
        if (value) result[v.name] = value;
      }
    }
  }
}

/**
 * Current values of the standard CSS variables for a colour scheme.
 * Reads the loaded stylesheets, and for the active scheme also the computed
 * style of <body> so custom themes in use are included.
 */
export function themeVars(scheme: ColorScheme, doc: Document = document): Record<string, string> {
  const result: Record<string, string> = {};
  readRules(doc, 'body', result);
  readRules(doc, `body.${scheme}-theme`, result);
  if (doc.body?.classList.contains(`${scheme}-theme`)) {
    const computed = doc.defaultView?.getComputedStyle(doc.body);
    for (const v of THEME_VARS) {
      const value = computed?.getPropertyValue(v.name).trim();
      if (value) result[v.name] = value;
    }
  }
  return result;
}

function themeBlock(scheme: ColorScheme, doc: Document) {
  const values = themeVars(scheme, doc);
  const lines = THEME_VARS.map(v => values[v.name]
    ? `  ${v.name}: ${values[v.name]}; /* ${v.description} */`
    : `  /* ${v.name}: ; ${v.description} ${$localize`(not set)`} */`);
  return `body.${scheme}-theme {\n${lines.join('\n')}\n}`;
}

/**
 * Starting point for a new custom theme: every standard CSS variable for
 * light and dark mode, pre-filled with the current values.
 */
export function newTheme(doc: Document = document) {
  return `/*
 * ${$localize`Custom theme`}
 *
 * ${$localize`Jasper adds .light-theme or .dark-theme to <body> depending on the colour scheme,`}
 * ${$localize`so set colours for both. Every standard CSS variable is listed below with the`}
 * ${$localize`value currently in use. Change what you want and delete the rest.`}
 *
 * ${$localize`Row structure and reusable classes for theming:`}
 * https://github.com/cjmalloy/jasper-ui/blob/master/docs/STRUCTURE.md
 */

/* ${$localize`Light theme`} */
${themeBlock('light', doc)}

/* ${$localize`Dark theme`} */
${themeBlock('dark', doc)}

/*
 * ${$localize`Add your own rules below. Use the row slots (.ref, .ext, .link, .info, .actions, ...)`}
 * ${$localize`so your theme keeps working as Jasper changes. For example:`}
 *
 * .ref.list-item > .thumbnail { display: none; }
 * .list-item > .info { font-size: 12px; }
 * body.dark-theme .ext.list-item > .link { color: var(--tag); }
 */
`;
}
