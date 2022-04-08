
export const userExt = {
  tag: 'user',
  defaults: {
    inbox: {},
    subscriptions: ['science@*', 'politics@*', '@infoman'],
  },
  schema: {
    properties: {
      inbox: {
        optionalProperties: {
          lastNotified: { type: 'string' },
        },
      },
      subscriptions: { elements: { type: 'string' } },
    },
  },
};
