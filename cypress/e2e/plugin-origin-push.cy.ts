import { clearMods, openSidebar } from './setup';

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
  it('clear mods', () => {
    clearMods();
  });
  it('turn on push', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-remoteorigin').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('creates a remote origin', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(replOtherApiProxy);
    cy.contains('Next').click();
    cy.wait(400);
    cy.get('.floating-ribbons .plugin-origin-push').click();
    cy.get('#remote').type('@other');
    cy.get('#title').type('Testing Remote @other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
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
  it('push to @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
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
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replOtherApiProxy + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
});
