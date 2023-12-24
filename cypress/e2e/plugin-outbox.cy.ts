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
  it('clear mods', () => {
    clearMods();
  });
  it('@main: turn on inbox, outbox and remote origins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-comment').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-mailbox').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-remoteorigin').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-user').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('@main: replicate @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(replApi).blur();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('.floating-ribbons .plugin-origin-pull').click();
    cy.get('#local').type('@other');
    cy.get('.plugins-form details.advanced summary').click();
    cy.get('#proxy').type(replApiProxy).blur();
    cy.get('#title').type('Testing Remote @other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('@other: clear mods', () => {
    clearMods(replUrl);
  });
  it('@other: turn on outbox and remote origins', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-comment').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-mailbox').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-remoteorigin').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');

    cy.wait(100);
    cy.get('#mod-user').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('@other: replicate @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type(mainApi).blur();
    cy.contains('Next').click();
    cy.wait(1000) // First part of text is missing
    cy.get('.floating-ribbons .plugin-origin-pull').click();
    cy.get('#local').type('@main');
    cy.get('.plugins-form details.advanced summary').click();
    cy.get('#proxy').type(mainApiProxy).blur();
    cy.get('#title').type('Testing Remote @main');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @main');
  });
  it('@main: pull @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@other').find('.actions').contains('pull').click();
    cy.wait('@pull');
    cy.wait(2000);
    cy.get('#show-remotes').check();
    cy.get('input[type=search]').clear().type('{enter}');
    cy.get('.ref-list .link.remote').contains('Testing Remote @main');
  });
  it('@other: pull @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@main').find('.actions').contains('pull').click();
    cy.wait('@pull');
    cy.wait(2000);
    cy.get('#show-remotes').check();
    cy.get('input[type=search]').clear().type('{enter}');
    cy.get('.ref-list .link.remote').contains('Testing Remote @other');
  });
  it('@other: creates ref', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Ref from other');
    cy.get('#comment textarea').type('Hi +user/alice@main! How\'s it going? You should also see this +user/charlie.').blur();
    cy.get('button').contains('Submit').click({ force: true });
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('@other: local user notified', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link:not(.remote)').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: pull @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@other').find('.actions').contains('pull').click();
    cy.wait('@pull');
  });
  it('@main: check ref was pulled', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob@other');
  });
  it('@main: reply to remote message', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .inbox').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('permalink').click();
    cy.get('.comment-reply textarea').type('Doing well, thanks!').blur();
    cy.get('.comment-reply button').contains('reply').click();
  });
  it('@other: pull @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@main').find('.actions').contains('pull').click();
    cy.wait('@pull');
  });
  it('@other: check reply was pulled', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Doing well, thanks!').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
  });
  it('@other: check inbox was converted to outbox', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.wait('@notifications');
    cy.wait(100);
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Doing well, thanks!').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
  it('@other: delete remote @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    openSidebar();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.get('@main').find('.actions').contains('delete').click();
    cy.get('@main').find('.actions').contains('yes').click();
  });
});
