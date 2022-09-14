describe('Graph', () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 30000 });
  });
  it('turn on graphing', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#plugin-graph').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a ref', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit Text Post').click();
    cy.get('#title').type('Title');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-01T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('shows graph', () => {
    cy.get('.actions a').contains('graph').click();
    cy.title().should('equals', 'CYPRESS ± Graph: Title');
    cy.get('figure').contains('Title');
  });
  it('creates reply', () => {
    cy.get('.actions a').contains('reply').click();
    cy.get('#url').type('comment:test-reply' + Math.random());
    cy.get('#scrape').click();
    cy.contains('Next').click();
    cy.get('#title').type('Reply');
    cy.get('#published').type('2020-01-02T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('graphs reply', () => {
    cy.get('.actions a').contains('graph').click();
    cy.title().should('equals', 'CYPRESS ± Graph: Reply');
    cy.contains('load more').click();
    cy.get('figure').contains('Title');
    cy.get('figure').contains('Reply');
  });
});
