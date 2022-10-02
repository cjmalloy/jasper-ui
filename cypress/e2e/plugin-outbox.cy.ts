describe('Outbox Plugin: Remote Notifications', () => {
  const mainApi = Cypress.env('CYPRESS_mainApi') || 'http://web';
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8082';
  const replApi = Cypress.env('CYPRESS_replApi') || 'http://repl-web';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Home', { timeout: 30000 });
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
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
    cy.wait(200);
  });
  it('@main: replicate @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Replicate Remote Origin').click();
    cy.get('#url').type(replApi);
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#origin').type('@other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('@main: create user ext', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.contains('Home');
  });
  it('@main: subscribe to remote notifications', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Create User Permissions').click();
    cy.get('#tag').type('+user/alice');
    cy.get('#readAccess button').click().click();
    cy.get('#tags-readAccess-0').type('plugin/inbox/user/alice');
    cy.get('#tags-readAccess-1').type('plugin/outbox/main/user/alice');
    cy.get('button').contains('Create').click();
    cy.get('.tag-list .link:not(.remote)').contains('+user/alice');
  });
  it('@other: turn on outbox and remote origins', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-comment').check();
    cy.get('#plugin-inbox').check();
    cy.get('#plugin-outbox').check();
    cy.get('#plugin-origin').check();
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
  });
  it('@other: replicate @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.contains('Replicate Remote Origin').click();
    cy.get('#url').type(mainApi);
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @main');
    cy.get('#origin').type('@main');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @main');
  });
  it('@other: subscribe to remote notifications for bob', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.contains('Create User Permissions').click();
    cy.get('#tag').type('+user/bob');
    cy.get('#readAccess button').click().click();
    cy.get('#tags-readAccess-0').type('plugin/inbox/user/bob');
    cy.get('#tags-readAccess-1').type('plugin/outbox/other/user/bob');
    cy.get('button').contains('Create').click();
    cy.get('.tag-list .link:not(.remote)').contains('+user/bob');
  });
  it('@main: create user ext for bob', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.contains('Home');
  });
  it('@other: subscribe to remote notifications for charlie', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.contains('Create User Permissions').click();
    cy.get('#tag').type('+user/charlie');
    cy.get('#readAccess button').click().click();
    cy.get('#tags-readAccess-0').type('plugin/inbox/user/charlie');
    cy.get('#tags-readAccess-1').type('plugin/outbox/other/user/charlie');
    cy.get('button').contains('Create').click();
    cy.get('.tag-list .link:not(.remote)').contains('+user/charlie');
  });
  it('@main: create user ext for charlie', () => {
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.contains('Home');
  });
  it('@other: creates ref', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.contains('Submit Text Post').click();
    cy.get('#title').type('Ref from other');
    cy.get('#comment').type('Hi +user/alice@main! How\'s it going? You should also see this +user/charlie.').blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('@other: local user notified', () => {
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link:not(.remote)').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob');
  });
  it('@main: scrape @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.intercept({pathname: '/api/v1/scrape/feed'}).as('scrape');
    cy.get('@other').find('.actions').contains('scrape').click();
    cy.wait('@scrape');
    cy.wait(100);
  });
  it('@main: check ref was scraped', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('bob@other');
    cy.get('@ref').find('.origin.tag').contains('@other');
  });
  it('@main: reply to remote message', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.get('.settings .inbox').click({force: true});
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('comment').click();
    cy.get('.comment-reply textarea').type('Doing well, thanks!', {force: true}).blur();
    cy.get('.comment-reply button').contains('reply').click({force: true});
  });
  it('@other: scrape @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.intercept({pathname: '/api/v1/scrape/feed'}).as('scrape');
    cy.get('@main').find('.actions').contains('scrape').click();
    cy.wait('@scrape');
  });
  it('@other: check reply was scraped', () => {
    cy.visit(replUrl + '/?debug=USER&tag=bob');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Reply to: Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
    cy.get('@ref').find('.origin.tag').contains('@main');
  });
  it('@other: check inbox was converted to outbox', () => {
    cy.visit(replUrl + '/?debug=USER&tag=charlie');
    cy.get('.settings .notification').click();
    cy.get('.tabs').contains('all').click();
    cy.get('.ref-list .link.remote').contains('Reply to: Ref from other').parent().parent().as('ref');
    cy.get('@ref').find('.user.tag').contains('alice@main');
    cy.get('@ref').find('.origin.tag').contains('@main');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('input[type=search]').type(replApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@other').parent().parent().as('other');
    cy.get('@other').find('.actions').contains('delete').click();
    cy.get('@other').find('.actions').contains('yes').click();
  });
  it('@main: delete users', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('users').click();
    cy.get('input[type=search]').type('+user/alice{enter}');
    cy.get('.link:not(.remote)').contains('+user/alice').parent().parent().as('alice');
    cy.get('@alice').find('.actions').contains('delete').click();
    cy.get('@alice').find('.actions').contains('yes').click();
  });
  it('@main: delete exts', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('extensions').click();
    cy.get('input[type=search]').type('+user/alice{enter}');
    cy.get('.link:not(.remote)').contains('+user/alice').parent().parent().as('alice');
    cy.get('@alice').find('.actions').contains('delete').click();
    cy.get('@alice').find('.actions').contains('yes').click();
  });
  it('@other: delete remote @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('input[type=search]').type(mainApi + '{enter}');
    cy.get('.link:not(.remote)').contains('@main').parent().parent().as('main');
    cy.get('@main').find('.actions').contains('delete').click();
    cy.get('@main').find('.actions').contains('yes').click();
  });
  it('@other: delete user for bob', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('users').click();
    cy.get('input[type=search]').type('+user/bob{enter}');
    cy.get('.link:not(.remote)').contains('+user/bob').parent().parent().as('bob');
    cy.get('@bob').find('.actions').contains('delete').click();
    cy.get('@bob').find('.actions').contains('yes').click();
  });
  it('@other: delete user for charlie', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('users').click();
    cy.get('input[type=search]').type('+user/charlie{enter}');
    cy.get('.link:not(.remote)').contains('+user/charlie').parent().parent().as('charlie');
    cy.get('@charlie').find('.actions').contains('delete').click();
    cy.get('@charlie').find('.actions').contains('yes').click();
  });
  it('@other: delete ext for bob', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('extensions').click();
    cy.get('input[type=search]').type('+user/bob{enter}');
    cy.get('.link:not(.remote)').contains('+user/bob').parent().parent().as('bob');
    cy.get('@bob').find('.actions').contains('delete').click();
    cy.get('@bob').find('.actions').contains('yes').click();
  });
  it('@other: delete ext for charlie', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('extensions').click();
    cy.get('input[type=search]').type('+user/charlie{enter}');
    cy.get('.link:not(.remote)').contains('+user/charlie').parent().parent().as('charlie');
    cy.get('@charlie').find('.actions').contains('delete').click();
    cy.get('@charlie').find('.actions').contains('yes').click();
  });
});
