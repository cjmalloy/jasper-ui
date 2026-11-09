/**
 * A part of an inputTag template: either a run of fixed segments, which
 * may have several options, or a placeholder the user fills out.
 * The depth is the index of the first tag segment in the part.
 * A placeholder at the end of the template is the rest of the tag, so it may have more than one segment.
 */
export type InputTagPart =
  { options: string[], depth: number, label?: undefined, rest?: undefined } |
  { label: string, depth: number, rest?: boolean, options?: undefined };

const PLACEHOLDER_REGEX = /^<(.*)>$/;
const FIRST_SEGMENT_REGEX = /^[_+]?[a-z0-9]+(\.[a-z0-9]+)*$/;
const SEGMENT_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
const REST_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)*(\/[a-z0-9]+(\.[a-z0-9]+)*)*$/;
const FIRST_REST_REGEX = /^[_+]?[a-z0-9]+(\.[a-z0-9]+)*(\/[a-z0-9]+(\.[a-z0-9]+)*)*$/;

/**
 * Split an inputTag template such as `car/<Year>/<Make>` into parts.
 * Fixed segments between placeholders are grouped into one part. A segment
 * with commas, such as `+plugin,_plugin`, gives that part one option for
 * every permutation. A template without placeholders gets one appended,
 * so `+plugin/secret` asks for the suffix of `+plugin/secret/<…>`.
 */
export function parseInputTag(template: string): InputTagPart[] {
  const parts: InputTagPart[] = [];
  let fixed: string[][] = [];
  let depth = 0;
  const flush = () => {
    if (!fixed.length) return;
    const options = fixed.reduce((ps, choices) => ps.flatMap(p => choices.map(c => p ? p + '/' + c : c)), ['']);
    parts.push({ options, depth: depth - fixed.length });
    fixed = [];
  };
  for (const s of template.split('/').filter(s => s)) {
    const placeholder = s.match(PLACEHOLDER_REGEX);
    if (placeholder) {
      flush();
      parts.push({ label: placeholder[1], depth });
    } else {
      fixed.push(s.split(',').filter(c => c));
    }
    depth++;
  }
  flush();
  const last = parts[parts.length - 1];
  if (!parts.some(p => p.label !== undefined)) {
    parts.push({ label: '', depth, rest: true });
  } else if (last.label !== undefined) {
    last.rest = true;
  }
  return parts;
}

/**
 * Initial values: empty for placeholders and the first option for fixed parts.
 */
export function inputTagDefaults(parts: InputTagPart[]) {
  return parts.map(p => p.options?.[0] || '');
}

/**
 * The pattern a placeholder value must match.
 */
export function inputTagPattern(part: InputTagPart) {
  if (part.rest) return part.depth ? REST_REGEX : FIRST_REST_REGEX;
  return part.depth ? SEGMENT_REGEX : FIRST_SEGMENT_REGEX;
}

export function validInputTagValue(value: string | undefined, part: InputTagPart) {
  if (!value) return false;
  if (part.options) return part.options.includes(value);
  return inputTagPattern(part).test(value);
}

/**
 * Value for each part, or undefined for a part that is empty or invalid.
 */
function partValues(parts: InputTagPart[], values: string[]) {
  return parts.map((p, i) => validInputTagValue(values[i], p) ? values[i] : undefined);
}

/**
 * The tag, or an empty string until every part is valid.
 */
export function resolveInputTag(parts: InputTagPart[], values: string[]) {
  const resolved = partValues(parts, values);
  if (resolved.some(v => v === undefined)) return '';
  return resolved.join('/');
}

/**
 * Spread a value typed into the part at an index over that part and the
 * ones after it, so `2020/toyota` typed into `<Year>` also fills `<Make>`.
 * A placeholder takes one segment, a fixed part as many segments as its
 * options have, and the rest placeholder whatever is left. Parts after
 * the value are left as they are. Returns the new values, the index of
 * the last part filled and the segments left over, if any, or undefined
 * if the value does not fit.
 */
export function spreadInputTag(parts: InputTagPart[], values: string[], index: number, value: string) {
  const part = parts[index];
  if (part.rest || part.options || !value.includes('/')) return undefined;
  const segments = value.split('/');
  const result = [...values];
  let last = index;
  for (let i = index; i < parts.length && segments.length; i++) {
    const p = parts[i];
    const length = p.rest ? segments.length : p.options ? p.options[0].split('/').length : 1;
    const v = segments.splice(0, length).join('/');
    if (p.options && !p.options.includes(v)) return undefined;
    result[i] = v;
    last = i;
  }
  return { values: result, last, overflow: segments.length ? segments.join('/') : undefined };
}

/**
 * Ext query for autocompleting the placeholder at a part index.
 * When every earlier part is known the query is that prefix. Otherwise
 * it is the known prefix before the first empty placeholder, and
 * {@link inputTagSuggestion} matches any value for the empty ones.
 */
export function inputTagQuery(parts: InputTagPart[], values: string[], index: number) {
  const resolved = partValues(parts, values).slice(0, index);
  const missing = resolved.indexOf(undefined);
  const prefix = (missing < 0 ? resolved : resolved.slice(0, missing)) as string[];
  return prefix.join('/') || undefined;
}

/**
 * The value an Ext tag suggests for the placeholder at a part index,
 * or undefined if the tag does not fit the template. Deeper tags suggest
 * their segment too, so a parent tag does not need its own Ext.
 * The last placeholder suggests the rest of the tag.
 */
export function inputTagSuggestion(parts: InputTagPart[], values: string[], index: number, tag: string) {
  const segments = tag.split('/');
  const depth = parts[index].depth;
  if (segments.length <= depth) return undefined;
  const resolved = partValues(parts, values);
  for (let i = 0; i < index; i++) {
    const value = resolved[i];
    if (value === undefined) continue;
    const length = value.split('/').length;
    if (segments.slice(parts[i].depth, parts[i].depth + length).join('/') !== value) return undefined;
  }
  return parts[index].rest ? segments.slice(depth).join('/') : segments[depth];
}

/**
 * Limit the options of a leading fixed part to tags that can be added.
 * If there are none, the first option is kept so the template is still clear.
 */
export function filterInputTag(parts: InputTagPart[], canAddTag: (tag: string) => boolean): InputTagPart[] {
  return parts.map((p, i) => {
    if (i || !p.options) return p;
    const allowed = p.options.filter(canAddTag);
    return { ...p, options: allowed.length ? allowed : p.options.slice(0, 1) };
  });
}

/**
 * The value of each part read from a tag, which may be partly filled out.
 * Parts the tag does not fill get their default.
 */
export function inputTagValues(parts: InputTagPart[], tag?: string | null) {
  const segments = tag ? tag.split('/') : [];
  return parts.map((p, i) => {
    const next = parts[i + 1]?.depth ?? segments.length;
    const value = segments.slice(p.depth, Math.max(p.depth, next)).join('/');
    if (p.options) return p.options.includes(value) ? value : p.options[0];
    return value;
  });
}

/**
 * The tag once it is filled out, otherwise the known prefix,
 * so the tag being filled out is available as early as possible.
 */
export function partialInputTag(parts: InputTagPart[], values: string[]) {
  return resolveInputTag(parts, values) || inputTagQuery(parts, values, parts.length) || '';
}

/**
 * True if the tag fills out every part of the template.
 */
export function matchesInputTag(parts: InputTagPart[], tag?: string | null) {
  return !!tag && resolveInputTag(parts, inputTagValues(parts, tag)) === tag;
}

function segments(template: string) {
  return template.split('/').filter(s => s);
}

/**
 * The segments with every placeholder replaced by `<>`, so placeholders
 * match whatever their label is.
 */
function hierarchicalKey(template: string) {
  return segments(template).map(s => PLACEHOLDER_REGEX.test(s) ? '<>' : s);
}

/**
 * Adds a line for every level of the hierarchicalTag templates, so each line
 * has a single input. `car/<Make>/<Model>` adds `car/<Make>` before it,
 * which is shown but does not add a tag unless it is also a template.
 * Templates matching an earlier one, ignoring placeholder labels, are dropped.
 */
export function expandHierarchicalTags(templates: string[]) {
  const result: string[] = [];
  const keys = new Set<string>();
  const add = (t: string) => {
    const key = hierarchicalKey(t).join('/');
    if (!key || keys.has(key)) return;
    keys.add(key);
    result.push(t);
  };
  for (const t of templates) {
    const s = segments(t);
    s.forEach((x, i) => PLACEHOLDER_REGEX.test(x) && add(s.slice(0, i + 1).join('/')));
    add(s.join('/'));
  }
  return result;
}

/**
 * Whether each line from {@link expandHierarchicalTags} adds its tag.
 * Only lines matching one of the templates do, ignoring placeholder labels.
 */
export function hierarchicalTagAdds(lines: string[], templates: string[]) {
  const keys = new Set(templates.map(t => hierarchicalKey(t).join('/')));
  return lines.map(l => keys.has(hierarchicalKey(l).join('/')));
}

/**
 * The index of the parent of each hierarchicalTag template, or -1 for none.
 * The parent is the longest other template the template starts with,
 * so `car/<Make>` is the parent of `car/<Brand>/<Model>`. Placeholders match
 * whatever their label is.
 */
export function hierarchicalTagParents(templates: string[]) {
  const keys = templates.map(hierarchicalKey);
  return keys.map(s => {
    let parent = -1;
    keys.forEach((ps, i) => {
      if (ps.length >= s.length || !ps.every((x, j) => x === s[j])) return;
      if (parent < 0 || ps.length > keys[parent].length) parent = i;
    });
    return parent;
  });
}

/**
 * The template with the part covered by the parent replaced with the parent tag,
 * or an empty string until the parent tag is filled out.
 */
export function hierarchicalTagTemplate(template: string, parentTemplate?: string, parentTag?: string | null) {
  if (!parentTemplate) return template;
  if (!matchesInputTag(parseInputTag(parentTemplate), parentTag)) return '';
  return [parentTag, ...segments(template).slice(segments(parentTemplate).length)].join('/');
}
