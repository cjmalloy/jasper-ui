describe('Origin Pull Plugin', {
  testIsolation: false
}, () => {
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082';
  const replApiProxy = Cypress.env('CYPRESS_replApiProxy') || 'http://repl-web';
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
  it('turn on pull', () => {
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#mod-remoteorigin').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a remote origin', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Submit').click();
    cy.get('.select-plugin select').select('+plugin/origin');
    cy.get('#url').type(replApiProxy);
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#ribbon-plugin-pull').click();
    cy.get('#local').type('@other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('creates ref on remote', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Pull Test');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Pull Test');
  });
  it('pull @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@other').find('.actions').contains('pull').click();
    cy.wait('@pull');
    cy.wait(100);
  });
  it('check ref was pulled', () => {
    cy.visit('/tag/@other?debug=USER');
    cy.get('.ref-list .link.remote').contains('Pull Test').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob@other');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
});
