
export const defaultExt = {
  tag: '',
  defaults: {
    pinned: [],
  },
  schema: {
    properties: {
      pinned: { elements: { type: 'string' } },
    },
    optionalProperties: {
      sidebar: { type: 'string' },
    },
  },
};
