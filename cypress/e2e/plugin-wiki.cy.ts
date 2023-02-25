describe('Wiki Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('button').contains('Save').click();
  });
  it('creates a wiki', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('wiki').click();
    cy.get('#url').type('WIKI TEST');
    cy.get('button').contains('Next').click();
    cy.get('#comment textarea').type('Link to [[Other WIKI]].');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Wiki test');
  });
  it('should rename page for URL', () => {
    cy.visit('/ref/wiki:Wiki_test?debug=USER');
    cy.get('.full-page.ref .link a').should('have.text', 'Wiki test');
  });
  it('should have internal wiki link', () => {
    cy.get('a').contains('Other WIKI').should('have.attr', 'href').should('eq', '/ref/wiki:Other_wiki');
    cy.get('a').contains('Other WIKI').should('not.have.attr', 'target');
  });
  it('click wiki link', () => {
    cy.get('a').contains('Other WIKI').click();
    cy.url().then(url => cy.visit(url + '?debug=USER'));
    cy.get('.error-404').contains('Not Found');
    cy.get('.submit-button').contains('Submit Wiki').click();
    cy.get('h5').should('have.text', 'Submit');
    cy.get('#title').should('have.value', 'Other wiki');
  });
  it('turn on wiki plugin', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#plugin-wiki').check();
    cy.get('button').contains('Save').click();
  });
  it('set external wiki', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('plugin').click();
    cy.get('.actions').contains('edit').click();
    cy.wait(1000); // Warm up monaco editor
    cy.get('#config').click().focused().type('{ctrl}a{backspace}');
    cy.get('#config').type(JSON.stringify({ prefix: 'https://externalwiki/', external: true }), { parseSpecialCharSequences: false });
    cy.get('button').contains('save').click();
  });
  it('submit wiki button removed', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit').click();
    cy.get('.tabs').should('not.have.text', 'wiki');
  });
  it('wiki link opens external', () => {
    cy.visit('/ref/wiki:Wiki_test?debug=USER');
    cy.get('a').contains('Other WIKI').should('have.attr', 'href').should('eq', 'https://externalwiki/Other_wiki');
    cy.get('a').contains('Other WIKI').should('have.attr', 'target').should('eq', '_blank');
  });
  it('delete wiki', () => {
    cy.visit('/ref/wiki:Wiki_test?debug=USER');
    cy.get('.full-page.ref .actions a').contains('delete').click();
    cy.get('.full-page.ref .actions a').contains('yes').click();
  });
});
