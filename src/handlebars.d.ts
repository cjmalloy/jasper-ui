declare module 'handlebars/dist/cjs/handlebars' {
  import * as Handlebars from 'handlebars';
  export const precompile: typeof Handlebars.precompile;
  export const compile: typeof Handlebars.compile;
}
