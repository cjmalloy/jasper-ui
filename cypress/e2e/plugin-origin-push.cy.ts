import { clearMods, openSidebar } from './setup';

describe('Origin Push Plugin', {
  testIsolation: false
}, () => {
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082';
  const replApiProxy = Cypress.env('CYPRESS_replApiProxy') || 'http://repl-web';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('turn on push', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-remoteorigin').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('creates a remote origin', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(replApiProxy);
    cy.contains('Next').click();
    cy.wait(400);
    cy.get('.floating-ribbons .plugin_origin_push').click();
    cy.get('#remote').type('@repl');
    cy.get('#title').type('Testing Remote @repl');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @repl');
  });
  it('creates ref', () => {
    cy.visit('/?debug=USER&tag=bob');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.wait(1000);
    cy.get('#title').type('Push Test');
    cy.get('button').contains('Submit').click({ force: true });
    cy.get('.full-page.ref .link a').should('have.text', 'Push Test');
  });
  it('push to @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@repl').parent().parent().parent().as('repl');
    cy.intercept({pathname: '/api/v1/origin/push'}).as('push');
    cy.get('@repl').find('.actions').contains('push').click();
    cy.get('@repl').find('.actions').contains('yes').click();
    cy.wait('@push');
    cy.wait(100);
  });
  it('check ref was scraped', () => {
    cy.visit(replUrl + '/tag/@repl?debug=ADMIN');
    cy.get('.ref-list .link').contains('Push Test').parent().parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: delete remote @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@repl').parent().parent().parent().as('repl');
    cy.get('@repl').find('.actions').contains('delete').click();
    cy.get('@repl').find('.actions').contains('yes').click();
  });
});
