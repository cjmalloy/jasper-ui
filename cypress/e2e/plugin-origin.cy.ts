describe('Origin Plugin: Remote Replication', () => {
  const replUrl = Cypress.env('CYPRESS_replUrl') || 'http://localhost:8084';
  const replApi = Cypress.env('CYPRESS_replApi') || 'http://localhost:8083';
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Home', { timeout: 30000 });
  });
  it('turn on remote origins', () => {
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-origin').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a remote origin', () => {
    cy.contains('Replicate Remote Origin').click();
    cy.get('#url').type(replApi);
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Testing Remote @other');
    cy.get('#origin').type('@other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Testing Remote @other');
  });
  it('creates ref on remote', () => {
    cy.visit(replUrl + '/?debug=USER&tag=+user/bob');
    cy.contains('Submit Text Post').click();
    cy.get('#title').type('Ref from other');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Ref from other');
  });
  it('scrape @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('.actions').contains('scrape').click();
    cy.reload();
    cy.get('.info').contains('last scraped');
  });
  it('check ref was scraped', () => {
    cy.visit('/tag/@other?debug=USER');
    cy.get('.ref-list').contains('Ref from other');
    cy.get('.user.tag').contains('bob@other');
    cy.get('.origin.tag').contains('@other');
  });
  it('delete remote @other', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('origins').click();
    cy.get('.actions').contains('delete').click();
    cy.get('.actions').contains('yes').click();
  });
});
