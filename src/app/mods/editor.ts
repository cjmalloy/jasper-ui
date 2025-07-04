import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Mod } from '../model/tag';

export const htmlPlugin: Plugin = {
  tag: 'plugin/html',
  name: $localize`📐️ HTML Editor`,
  config: {
    type: 'editor',
    experimental: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Activates built-in HTML editor support and allows users to format Ref comments as HTML.`,
    editorButtons: [{ label: $localize`📐️️ HTML`, remember: true, ribbon: true, global: true }],
  },
};
export const htmlMod: Mod = {
  plugin: [
    htmlPlugin,
  ]
};

export const latexPlugin: Plugin = {
  tag: 'plugin/latex',
  name: $localize`💲️ LaTeX`,
  config: {
    type: 'editor',
    default: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Adds LaTeX support to the markdown editor. Use $ to mark inline math, $$ to mark block math.`,
    aiInstructions: `# plugin/latex
    The plugin/latex tag indicates the Ref may contain LaTeX markup in it's comment field.
    Be sure to delimit your latex with dollar signs $f(x)$, or double dollar signs $$f(x)$$ for block math.
    Remember to add the plugin/latex tag to your Refs or else it will be rendered as plaintext instead of MathML.
    The plugin/latex tag does not include any plugin data. Simply including it in the Ref tags array will activate LaTeX rendering.
    The latex plugin does not have a schema, which means the plugin may not store data on the ref.
    LaTeX is delimited with $ for inline math and $$ for block math.
    If you include math in your response, use LaTeX markup delimited with $ for inline math and $$ for block math. Do not escape LaTeX backslashes.
    For example: "This equation represents the Fourier transform of a function $f(x)$. The Fourier transform is a mathematical operation that transforms a function from the time or spatial domain to the frequency domain. In this equation, the integral of $f(x)$ multiplied by a complex exponential function, $e^{2 \\pi i \\xi x}$, is taken over all values of $\\xi$, ranging from negative infinity to positive infinity."
    For example: "This equation represents an iterative evaluation of the continued fraction $\\cfrac{2}{1+\\cfrac{2}{1+\\cfrac{2}{1}}}$, which is commonly known as the golden ratio or $\\phi$."`,
    editorButtons: [{ label: $localize`💲️ LaTeX`, remember: true, ribbon: true, global: true }],
  },
};

export const latexMod: Mod = {
  plugin: [
    latexPlugin,
  ]
};
