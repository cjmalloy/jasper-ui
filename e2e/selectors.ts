/**
 * Shared CSS selectors for the ref / tag row structure.
 * See docs/STRUCTURE.md for the annotated skeletons and class glossary.
 */

/** Every entity row (ref or tag) has the base `.list-item` class. */
export const LIST_ITEM = '.list-item';

/** Root of a Ref row. */
export const REF = '.ref';
/** Root of a tag-like row (Ext, Plugin, Template, User). Paired with `.list-item` to exclude `a.tag` chips. */
export const TAG = '.tag.list-item';
/** Inline tag chip inside `.info`, e.g. `a.tag`, `a.user.tag`, `a.origin.tag`. */
export const TAG_CHIP = 'a.tag';
/** Either kind of entity row. */
export const ENTITY = `${REF}${LIST_ITEM}, ${TAG}`;

/** Kind modifiers for `.tag` rows. */
export const EXT = '.tag.ext';
export const PLUGIN = '.tag.plugin';
export const TEMPLATE = '.tag.template';
export const USER = '.tag.profile';

/** Variant modifiers. */
export const FULL_PAGE_REF = '.full-page.ref';
export const REF_LIST_ITEM = '.ref-list-item.ref';

/** Slots, in document order. */
export const THUMBNAIL = '.thumbnail';
export const ROW = '.row';
export const LINK = '.link';
export const INFO = '.info';
export const ACTIONS = '.actions';

/** Allowed direct children of `.actions`. */
export const FAKE_LINK = '.fake-link';
export const ACTION = '.action';
export const ACTION_LIST = '.action-list';
export const ACTION_ITEM = `a, ${FAKE_LINK}, ${ACTION}, ${ACTION_LIST}`;
