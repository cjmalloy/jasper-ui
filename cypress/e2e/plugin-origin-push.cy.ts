describe('Origin Push Plugin', {
  testIsolation: false
}, () => {
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082';
  const replOtherApi = Cypress.env('CYPRESS_replOtherApi') || 'http://localhost:8085';
  const replOtherApiProxy = Cypress.env('CYPRESS_replOtherApiProxy') || 'http://repl-other-web';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('button').contains('Save').click();
  });
  it('turn on push', () => {
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#mod-origin').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a remote origin', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Submit').click();
    cy.get('.select-plugin select').select('+plugin/origin');
    cy.get('#url').type(replOtherApiProxy);
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#ribbon-plugin-push').click();
    cy.get('#remote').type('@other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('creates ref', () => {
    cy.visit('/?debug=USER&tag=bob');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Push Test');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Push Test');
  });
  it('push to @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replOtherApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/origin/push'}).as('push');
    cy.get('@other').find('.actions').contains('push').click();
    cy.wait('@push');
    cy.wait(100);
  });
  it('check ref was scraped', () => {
    cy.visit(replUrl + '/tag/@other?debug=ADMIN');
    cy.get('.ref-list .link.remote').contains('Push Test').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob@other');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replOtherApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
});
