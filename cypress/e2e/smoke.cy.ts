describe('Smoke Tests', () => {
  it('loads the page', () => {
    cy.visit('/');
    cy.contains('Home');
  });
  it('creates a ref', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit Link').click();
    cy.get('#url').type('https://www.jasper-kms.info/');
    cy.get('#scrape').click();
    cy.contains('Next').click();
    cy.get('#title').type('Title');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
    cy.get('.full-page.ref .actions a').contains('delete').click();
    cy.get('.full-page.ref .actions a').contains('yes').click();
    cy.visit(`/ref/${encodeURIComponent('https://www.jasper-kms.info/')}?debug=USER`);
    cy.contains('Not Found');
  });
});
