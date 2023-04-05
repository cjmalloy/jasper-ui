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
  it('clear plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('button').contains('Save').click();
  });
  it('@main: turn on inbox, outbox and remote origins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#plugin-comment').check();
    cy.get('#plugin-inbox').check();
    cy.get('#plugin-outbox').check();
    cy.get('#plugin-origin').check();
    cy.get('#plugin-originPull').check();
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
    cy.wait(200);
  });
  it('@main: replicate @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Submit').click();
    cy.get('.select-plugin select').select('+plugin/origin');
    cy.get('#url').type(replApi).blur();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#ribbon-plugin-pull').click();
    cy.get('#local').type('@other');
    cy.get('#proxy').type(replApiProxy).blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('@other: turn on outbox and remote origins', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-comment').check();
    cy.get('#plugin-inbox').check();
    cy.get('#plugin-outbox').check();
    cy.get('#plugin-origin').check();
    cy.get('#plugin-originPull').check();
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
  });
  it('@other: replicate @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.contains('Submit').click();
    cy.get('.select-plugin select').select('+plugin/origin');
    cy.get('#url').type(mainApi).blur();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @main');
    cy.get('#ribbon-plugin-pull').click();
    cy.get('#local').type('@main');
    cy.get('#proxy').type(mainApiProxy).blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @main');
  });
  it('@other: creates ref', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Ref from other');
    cy.get('#comment textarea').type('Hi +user/alice@main! How\'s it going? You should also see this +user/charlie.').blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('@other: local user notified', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.wait('@notifications');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link:not(.remote)').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: pull @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/origin/pull'}).as('pull');
    cy.get('@other').find('.actions').contains('pull').click();
    cy.wait('@pull');
    cy.wait(100);
  });
  it('@main: check ref was pulled', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob@other');
    cy.get('@ref').find('.origin.tag').contains('@other');
  });
  it('@main: reply to remote message', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit('/?debug=USER&tag=alice');
    cy.wait('@notifications');
    cy.get('.settings .inbox').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('permalink').click();
    cy.get('.comment-reply textarea').type('Doing well, thanks!').blur();
    cy.get('.comment-reply button').contains('reply').click();
  });
  it('@other: pull @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
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
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Reply to: Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
    cy.get('@ref').find('.origin.tag').contains('@main');
  });
  it('@other: check inbox was converted to outbox', () => {
    cy.intercept({pathname: '/api/v1/ref/count'}).as('notifications');
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.wait('@notifications');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Reply to: Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
    cy.get('@ref').find('.origin.tag').contains('@main');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
  it('@other: delete remote @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origin').click();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.get('@main').find('.actions').contains('delete').click();
    cy.get('@main').find('.actions').contains('yes').click();
  });
});
