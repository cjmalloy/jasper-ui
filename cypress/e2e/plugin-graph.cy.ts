describe('Graph Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('button').contains('Save').click();
  });
  it('turn on graphing', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#plugin-graph').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a ref', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Title');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-01T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('shows graph', () => {
    cy.get('.full-page .actions a').contains('graph').click();
    cy.title().should('include', 'Graph: Title');
    cy.get('figure').contains('Title');
  });
  it('creates reply', () => {
    cy.get('.full-page .actions a').contains('reply').click();
    cy.get('#url').type('test:reply' + Math.random());
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Reply');
    cy.get('#published').type('2020-01-02T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('graphs reply', () => {
    cy.get('.full-page .actions a').contains('graph').click();
    cy.title().should('include', 'Graph: Reply');
    cy.contains('load more').click();
    cy.get('figure').contains('Title');
    cy.get('figure').contains('Reply');
  });
});
