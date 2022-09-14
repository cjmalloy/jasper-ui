describe('Smoke Tests', () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 30000 });
  });
  it('creates a ref', () => {
    cy.contains('Submit Link').click();
    cy.get('#url').type('https://www.jasper-kms.info/');
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Title');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('deletes a ref', () => {
    cy.get('.full-page.ref .actions a').contains('delete').click();
    cy.get('.full-page.ref .actions a').contains('yes').click();
    cy.visit(`/ref/${encodeURIComponent('https://www.jasper-kms.info/')}?debug=USER`);
    cy.contains('Not Found');
  });
});
