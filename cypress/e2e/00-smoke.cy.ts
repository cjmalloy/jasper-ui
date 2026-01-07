import { clearMods, openSidebar } from './setup';

describe('Smoke Tests', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 * 20 }); // 20 minutes
  });
  it('@main: clear mods', () => {
    clearMods();
  });
  it('@repl: clear mods', () => {
    clearMods(Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082');
  });
  it('creates a ref', () => {
    cy.visit('/?debug=ADMIN');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://jasperkm.info/');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(1000); // First part of 'Title' getting truncated
    cy.get('[name=title]').type('Title');
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('deletes a ref', () => {
    cy.get('.full-page.ref .actions *').contains('delete').click();
    cy.get('.full-page.ref .actions *').contains('yes').click();
    cy.visit(`/ref/e/${encodeURIComponent('https://jasperkm.info/')}?debug=USER`);
    cy.contains('Not Found');
  });
  it('loads the ADMIN user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=ADMIN');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: true,
        mod: true,
        editor: true,
        user: true,
        viewer: true,
        banned: false,
      });
    });
  });
  it('loads the MOD user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=MOD');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: false,
        mod: true,
        editor: true,
        user: true,
        viewer: true,
        banned: false,
      });
    });
  });
  it('loads the EDITOR user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=EDITOR');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: false,
        mod: false,
        editor: true,
        user: true,
        viewer: true,
        banned: false,
      });
    });
  });
  it('loads the USER user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=USER');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: false,
        mod: false,
        editor: false,
        user: true,
        viewer: true,
        banned: false,
      });
    });
  });
  it('loads the VIEWER user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=VIEWER');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: false,
        mod: false,
        editor: false,
        user: false,
        viewer: true,
        banned: false,
      });
    });
  });
  it('loads the ANON user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=ANON');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).includes({
        tag: '+user/debug',
        admin: false,
        mod: false,
        editor: false,
        user: false,
        viewer: false,
        banned: false,
      });
    });
  });
});
