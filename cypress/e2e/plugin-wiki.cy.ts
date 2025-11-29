import { clearMods, openSidebar } from './setup';

describe('Wiki Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('creates a wiki', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('wiki').click();
    cy.get('#url').type('WIKI TEST');
    cy.get('button').contains('Next').click();
    cy.get('.editor textarea').type('Link to [[Other WIKI]].');
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Wiki test');
  });
  it('should rename page for URL', () => {
    cy.visit('/ref/e/wiki:Wiki_test?debug=USER');
    cy.get('.full-page.ref .link a').should('have.text', 'Wiki test');
  });
  it('should have internal wiki link', () => {
    cy.get('a').contains('Other WIKI').should('have.attr', 'href').should('eq', '/ref/wiki:Other_wiki');
    cy.get('a').contains('Other WIKI').should('not.have.attr', 'target');
  });
  it('click wiki link', () => {
    cy.get('a').contains('Other WIKI').click();
    cy.url().then(url => cy.visit(url.replace('/ref/', '/ref/e/') + '?debug=USER'));
    cy.get('.error-404').contains('Not Found');
    cy.get('.submit-button').contains('Submit Wiki').click();
    cy.get('h5').should('contain.text', 'Submit');
    cy.get('[name=title]').should('have.value', 'Other wiki');
  });
  it('turn on wiki config', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-wiki').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('set external wiki', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('template').click();
    cy.get('input.upload').selectFile(Cypress.Buffer.from(JSON.stringify({ tag: 'wiki', config: { prefix: 'https://externalwiki/', external: true }})), { force: true });
  });
  it('submit wiki button removed', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').should('not.have.text', 'wiki');
  });
  it('wiki link opens external', () => {
    cy.visit('/ref/e/wiki:Wiki_test?debug=USER');
    cy.get('a').contains('Other WIKI').should('have.attr', 'href').should('eq', 'https://externalwiki/Other_wiki');
    cy.get('a').contains('Other WIKI').should('have.attr', 'target').should('eq', '_blank');
  });
  it('delete wiki', () => {
    cy.visit('/ref/e/wiki:Wiki_test?debug=USER');
    cy.get('.full-page.ref .actions *').contains('delete').click();
    cy.get('.full-page.ref .actions *').contains('yes').click();
  });
});
