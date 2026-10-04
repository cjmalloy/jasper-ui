// @ts-check
const angular = require('angular-eslint');
const tseslint = require('typescript-eslint');

const legacyDecorators = 'Input|Output|ViewChild|ViewChildren|ContentChild|ContentChildren|HostBinding|HostListener';

module.exports = tseslint.config(
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      '@angular-eslint': angular.tsPlugin,
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-signals': 'error',
      'no-restricted-syntax': ['error', {
        selector: `Decorator[expression.callee.name=/^(${legacyDecorators})$/]`,
        message: 'Use input(), output(), model(), viewChild(), contentChild() or the host metadata instead.',
      }, {
        selector: 'ClassDeclaration > TSClassImplements[expression.name=/^(On|After|Do)[A-Z]/]',
        message: 'Do not implement lifecycle interfaces. Use computed(), afterNextRender() or DestroyRef.',
      }, {
        selector: "ImportDeclaration[source.value='lodash-es'] > ImportSpecifier[imported.name='defer']",
        message: 'Do not defer to wait for rendering. Use afterNextRender() when the DOM is really needed.',
      }],
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'zone.js', message: 'The app is zoneless.' },
          { name: '@angular/core', importNames: ['NgZone'], message: 'The app is zoneless.' },
          { name: '@angular/common/http', importNames: ['HTTP_INTERCEPTORS'], message: 'Use functional interceptors with withInterceptors().' },
        ],
        patterns: [
          { group: ['zone.js/*'], message: 'The app is zoneless.' },
          { group: ['mobx', 'mobx-*', 'mobx/*'], message: 'State is signals.' },
        ],
      }],
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angular.templateParser,
    },
    plugins: {
      '@angular-eslint/template': angular.templatePlugin,
    },
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
);
