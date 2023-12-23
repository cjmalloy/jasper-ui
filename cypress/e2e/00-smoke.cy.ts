import { clearMods } from './setup';

describe('Smoke Tests', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 * 20 }); // 20 minutes
  });
  it('clear mods', () => {
    clearMods();
  });
  it('creates a ref', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Submit').click();
    cy.get('#url').type('https://www.jasper-kms.info/');
    cy.contains('Next').click();
    cy.wait(1000); // First part of 'Title' getting truncated
    cy.get('#title').type('Title');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('deletes a ref', () => {
    cy.get('.full-page.ref .actions a').contains('delete').click();
    cy.get('.full-page.ref .actions a').contains('yes').click();
    cy.visit(`/ref/e/${encodeURIComponent('https://www.jasper-kms.info/')}?debug=USER`);
    cy.contains('Not Found');
  });
  it('loads the ADMIN user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=ADMIN');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: true,
        mod: true,
        editor: true,
        user: true,
        viewer: true,
      });
    });
  });
  it('loads the MOD user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=MOD');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: false,
        mod: true,
        editor: true,
        user: true,
        viewer: true,
      });
    });
  });
  it('loads the EDITOR user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=EDITOR');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: false,
        mod: false,
        editor: true,
        user: true,
        viewer: true,
      });
    });
  });
  it('loads the USER user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=USER');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: false,
        mod: false,
        editor: false,
        user: true,
        viewer: true,
      });
    });
  });
  it('loads the VIEWER user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=VIEWER');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: false,
        mod: false,
        editor: false,
        user: false,
        viewer: true,
      });
    });
  });
  it('loads the ANON user', () => {
    cy.intercept({method: 'GET', pathname: '/api/v1/user/whoami'}).as('whoami');
    cy.visit('/?debug=ANON');
    cy.wait('@whoami');
    cy.get('@whoami').should(({ request, response }: any) => {
      expect(response.body).deep.equal({
        debug: false,
        tag: '+user/debug',
        sysadmin: false,
        admin: false,
        mod: false,
        editor: false,
        user: false,
        viewer: false,
      });
    });
  });
});
