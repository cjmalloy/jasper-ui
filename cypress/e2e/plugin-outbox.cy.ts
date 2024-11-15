import { clearMods, openSidebar } from './setup';

describe('Outbox Plugin: Remote Notifications', {
  testIsolation: false
}, () => {
  const mainApi = Cypress.env('CYPRESS_mainApi') || 'http://localhost:8081';
  const mainApiProxy = Cypress.env('CYPRESS_mainApiProxy') || 'http://web';
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082';
  const replApi = Cypress.env('CYPRESS_replApi') || 'http://localhost:8083';
  const replApiProxy = Cypress.env('CYPRESS_replApiProxy') || 'http://repl-web';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('@main: clear mods', () => {
    clearMods();
  });
  it('@main: turn on inbox, outbox and remote origins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-comment').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-mailbox').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-remoteorigin').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-user').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('@main: replicate @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(replApi).blur();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @repl');
    cy.get('.floating-ribbons .plugin_origin_pull').click();
    cy.get('#local').type('@repl');
    cy.get('#remote').type('@repl');
    cy.get('.plugins-form details.advanced summary').click();
    cy.get('#proxy').type(replApiProxy).blur();
    cy.get('#title').type('Testing Remote @repl');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @repl');
  });
  it('@repl: clear mods', () => {
    clearMods(replUrl);
  });
  it('@repl: turn on outbox and remote origins', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-comment').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-mailbox').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-remoteorigin').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-user').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('@repl: replicate @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(mainApi).blur();
    cy.contains('Next').click();
    cy.wait(1000) // First part of text is missing
    cy.get('.floating-ribbons .plugin_origin_pull').click();
    cy.get('#local').type('@main');
    cy.get('.plugins-form details.advanced summary').click();
    cy.get('#proxy').type(mainApiProxy).blur();
    cy.get('#title').type('Testing Remote @main');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @main');
  });
  it('@main: pull @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@repl').parent().parent().parent().as('repl');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@repl').find('.actions').contains('pull').click();
    cy.get('@repl').find('.actions').contains('yes').click();
    cy.wait('@pull');
    cy.wait(100);
    cy.get('#show-remotes').check();
    cy.get('input[type=search]').clear().type('{enter}');
    cy.get('.ref-list .link.remote').contains('Testing Remote @main');
  });
  it('@repl: pull @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().parent().as('main');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@main').find('.actions').contains('pull').click();
    cy.get('@main').find('.actions').contains('yes').click();
    cy.wait('@pull');
    cy.wait(100);
    cy.get('#show-remotes').check();
    cy.get('input[type=search]').clear().type('{enter}');
    cy.get('.ref-list .link.remote').contains('Testing Remote @repl');
  });
  it('@repl: creates ref', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Ref from other');
    cy.get('#comment textarea').type('Hi +user/alice@repl.main! How\'s it going? You should also see this +user/charlie.').blur();
    cy.get('button').contains('Submit').click({ force: true });
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('@repl: local user notified', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link:not(.remote)').contains('Ref from other').parent().parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: pull @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@repl').parent().parent().parent().as('repl');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@repl').find('.actions').contains('pull').click();
    cy.get('@repl').find('.actions').contains('yes').click();
    cy.wait('@pull');
    cy.wait(100);
  });
  it('@main: check ref was pulled', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: reply to remote message', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .inbox').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('permalink').click();
    cy.get('.comment-reply textarea').type('Doing well, thanks!').blur();
    cy.get('.comment-reply button').contains('reply').click();
  });
  it('@repl: pull @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().parent().as('main');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@main').find('.actions').contains('pull').click();
    cy.get('@main').find('.actions').contains('yes').click();
    cy.wait('@pull');
    cy.wait(100);
  });
  xit('@repl: check reply was pulled', () => {
    // Broken only on ci
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=ADMIN&tag=bob');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Doing well, thanks!').parent().parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice');
  });
  xit('@repl: check inbox was converted to outbox', () => {
    // Broken only on ci
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=ADMIN&tag=charlie');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Doing well, thanks!').parent().parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice');
  });
  it('@main: delete remote @repl', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@repl').parent().parent().parent().as('repl');
    cy.get('@repl').find('.actions').contains('delete').click();
    cy.get('@repl').find('.actions').contains('yes').click();
  });
  it('@repl: delete remote @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().parent().as('main');
    cy.get('@main').find('.actions').contains('delete').click();
    cy.get('@main').find('.actions').contains('yes').click();
  });
});
