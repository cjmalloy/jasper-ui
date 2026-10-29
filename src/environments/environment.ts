// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  /** Local development conveniences (auto login, prefetch, ...). */
  dev: true,
  /** Exhaustive checkNoChanges to catch state changes that OnPush templates miss. */
  checkNoChanges: true,
};
