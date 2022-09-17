describe('Outbox Plugin: Remote Notifications', () => {
  const mainApi = Cypress.env('CYPRESS_mainApi') || 'http://localhost:8081';
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8084';
  const replApi = Cypress.env('CYPRESS_replApi') || 'http://localhost:8083';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN&tag=+user/alice');
    cy.contains('Home', { timeout: 30000 });
  });
  it('@main: turn on inbox, outbox and remote origins', () => {
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-comment').check();
    cy.get('#plugin-inbox').check();
    cy.get('#plugin-outbox').check();
    cy.get('#plugin-origin').check();
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
  });
  it('@main: creates a remote origin', () => {
    cy.contains('Replicate Remote Origin').click();
    cy.get('#url').type(replApi);
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#origin').type('@other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('@main: subscribe to remote notifications', () => {
    cy.contains('Create User Permissions').click();
    cy.get('#tag').type('+user/alice');
    cy.get('#readAccess button').click();
    cy.get('#readAccess input').type('plugin/outbox/main/user/alice@other');
    cy.get('button').contains('Create').click();
    cy.get('.tag-list').contains('+user/alice');
  });
  it('@other: turn on outbox and remote origins', () => {
    cy.visit(replUrl + '/?debug=ADMIN&tag=+user/bob');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-comment').check();
    cy.get('#plugin-inbox').check();
    cy.get('#plugin-outbox').check();
    cy.get('#plugin-origin').check();
    cy.get('#template-user').check();
    cy.get('button').contains('Save').click();
  });
  it('@main: creates a remote origin', () => {
    cy.contains('Replicate Remote Origin').click();
    cy.get('#url').type(mainApi);
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @main');
    cy.get('#origin').type('@main');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @main');
  });
  it('@main: subscribe to remote notifications', () => {
    cy.contains('Create User Permissions').click();
    cy.get('#tag').type('+user/bob');
    cy.get('#readAccess button').click();
    cy.get('#readAccess input').type('plugin/outbox/other/user/bob@main');
    cy.get('button').contains('Create').click();
    cy.get('.tag-list').contains('+user/bob');
  });
  it('@other: creates ref', () => {
    cy.visit(replUrl + '/?debug=USER&tag=+user/bob');
    cy.contains('Submit Text Post').click();
    cy.get('#title').type('Ref from other');
    cy.get('#comment').type('Hi +user/alice@main! How\'s it going?').blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('@main: scrape @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.intercept({pathname: '/api/v1/scrape/feed'}).as('scrape');
    cy.get('.actions').contains('scrape').click();
    cy.wait('@scrape');
  });
  it('@main: check ref was scraped', () => {
    cy.visit('/?debug=USER&tag=+user/alice');
    cy.get('.settings .notification').click();
    cy.get('.ref-list').contains('Ref from other');
    cy.get('.user.tag').contains('bob@other');
    cy.get('.origin.tag').contains('@other');
  });
  it('@main: reply to remote message', () => {
    cy.get('.actions').contains('comment').click();
    cy.get('.comment-reply textarea').type('Doing well, thanks!', {force: true}).blur();
    cy.get('.comment-reply button').contains('reply').click({force: true});
  });
  it('@other: scrape @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.intercept({pathname: '/api/v1/scrape/feed'}).as('scrape');
    cy.get('.actions').contains('scrape').click();
    cy.wait('@scrape');
  });
  it('@other: check reply was scraped', () => {
    cy.visit(replUrl + '/?debug=USER&tag=+user/bob');
    cy.get('.settings .notification').click();
    cy.get('.ref-list').contains('Reply to: Ref from other');
    cy.get('.user.tag').contains('alice@main');
    cy.get('.origin.tag').contains('@main');
  });
  it('@main: delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('.actions').contains('delete').click();
    cy.get('.actions').contains('yes').click();
  });
  it('@main: delete user permissions', () => {
    cy.get('.tabs').contains('users').click();
    cy.get('.actions').contains('delete').click();
    cy.get('.actions').contains('yes').click();
  });
  it('@other: delete remote @main', () => {
    cy.visit(replUrl + '/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('.actions').contains('delete').click();
    cy.get('.actions').contains('yes').click();
  });
  it('@other: delete user permissions', () => {
    cy.get('.tabs').contains('users').click();
    cy.get('.actions').contains('delete').click();
    cy.get('.actions').contains('yes').click();
  });
});
