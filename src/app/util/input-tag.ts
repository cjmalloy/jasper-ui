export type InputTagSegment =
  { literal: string, label?: undefined, choices?: undefined } |
  { literal?: undefined, label: string, choices?: undefined } |
  { literal?: undefined, label?: undefined, choices: string[] };

const PLACEHOLDER_REGEX = /^<(.*)>$/;
const FIRST_SEGMENT_REGEX = /^[_+]?[a-z0-9]+(\.[a-z0-9]+)*$/;
const SEGMENT_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)*$/;

/**
 * Split an inputTag template such as `car/<Year>/<Make>` into segments.
 * A segment with commas, such as `+plugin,_plugin`, is a fixed choice.
 * A template without placeholders gets one appended, so `+plugin/secret`
 * asks for the suffix of `+plugin/secret/<…>`.
 */
export function parseInputTag(template: string): InputTagSegment[] {
  const segments: InputTagSegment[] = template.split('/').filter(s => s).map(s => {
    const placeholder = s.match(PLACEHOLDER_REGEX);
    if (placeholder) return { label: placeholder[1] };
    if (s.includes(',')) return { choices: s.split(',').filter(c => c) };
    return { literal: s };
  });
  if (!segments.some(s => s.label !== undefined)) segments.push({ label: '' });
  return segments;
}

/**
 * Indices of the placeholder and choice segments, in the order their values are stored.
 */
export function inputTagPlaceholders(segments: InputTagSegment[]) {
  return segments.flatMap((s, i) => s.literal === undefined ? [i] : []);
}

/**
 * Initial values: empty for placeholders and the first option for choices.
 */
export function inputTagDefaults(segments: InputTagSegment[]) {
  return segments.flatMap(s => s.literal !== undefined ? [] : [s.choices?.[0] || '']);
}

export function validInputTagValue(value: string | undefined, segmentIndex: number, choices?: string[]) {
  if (!value) return false;
  if (choices) return choices.includes(value);
  return (segmentIndex ? SEGMENT_REGEX : FIRST_SEGMENT_REGEX).test(value);
}

/**
 * Value for each segment, or undefined for a placeholder that is empty or invalid.
 */
function segmentValues(segments: InputTagSegment[], values: string[]) {
  let p = 0;
  return segments.map((s, i) => {
    if (s.literal !== undefined) return s.literal;
    const value = values[p++];
    return validInputTagValue(value, i, s.choices) ? value : undefined;
  });
}

/**
 * The tag, or an empty string until every placeholder is valid.
 */
export function resolveInputTag(segments: InputTagSegment[], values: string[]) {
  const resolved = segmentValues(segments, values);
  if (resolved.some(v => v === undefined)) return '';
  return resolved.join('/');
}

/**
 * Ext query for autocompleting the placeholder at a segment index.
 * When every earlier segment is known the query is that prefix. Otherwise
 * it is the known prefix before the first empty placeholder, and
 * {@link inputTagSuggestion} matches any value for the empty ones.
 */
export function inputTagQuery(segments: InputTagSegment[], values: string[], segmentIndex: number) {
  const resolved = segmentValues(segments, values).slice(0, segmentIndex);
  const missing = resolved.indexOf(undefined);
  const prefix = (missing < 0 ? resolved : resolved.slice(0, missing)) as string[];
  return prefix.join('/') || undefined;
}

/**
 * The value an Ext tag suggests for the placeholder at a segment index,
 * or undefined if the tag does not fit the template. Deeper tags suggest
 * their segment too, so a parent tag does not need its own Ext.
 */
export function inputTagSuggestion(segments: InputTagSegment[], values: string[], segmentIndex: number, tag: string) {
  const parts = tag.split('/');
  if (parts.length <= segmentIndex) return undefined;
  const resolved = segmentValues(segments, values);
  for (let i = 0; i < segmentIndex; i++) {
    if (resolved[i] !== undefined && resolved[i] !== parts[i]) return undefined;
  }
  return parts[segmentIndex];
}
