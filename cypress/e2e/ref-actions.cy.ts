describe('Ref Actions', () => {
  it('loads the page', () => {
    cy.visit('/');
    cy.contains('Home');
  });
  it('creates a ref', () => {
    cy.visit('/?debug=USER');
    cy.contains('Submit Text Post').click();
    cy.get('#title').type('Title');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');

    cy.get('.actions a').contains('graph').click();
    cy.title().should('equals', 'Jasper ± Graph: Title');

    cy.get('.actions a').contains('uncited').click();
    cy.title().should('equals', 'Jasper ± Responses: Title');

    cy.get('.actions a').contains('unsourced').click();
    cy.title().should('equals', 'Jasper ± Sources: Title');

    cy.get('.actions a').contains('edit').click();
    cy.get('#comment').type('Comment field');
    cy.get('form .md').should('contain', 'Comment field');
    cy.get('button').contains('save').click();
    cy.get('form .md').should('contain', 'Comment field');
    cy.get('.full-page.ref  .toggle-comment').click();
    cy.get('.full-page.ref').should('not.contain', 'Comment field');

    cy.get('.actions a').contains('tag').click();
    cy.get('.inline-tagging input').type('cool{enter}');
    cy.get('.full-page.ref .tag:not(.user)').contains('cool').should('exist');

    cy.get('.actions a').contains('reply').click();
    cy.get('#url').type('comment:test-reply' + Math.random());
    cy.get('#scrape').click();
    cy.contains('Next').click();
    cy.get('#title').type('Reply');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');

    cy.get('.actions a').contains('graph').click();
    cy.title().should('equals', 'Jasper ± Graph: Reply');

    cy.get('.actions a').contains('uncited').click();
    cy.title().should('equals', 'Jasper ± Responses: Reply');

    cy.get('.actions a').contains('1 source').click();
    cy.title().should('equals', 'Jasper ± Sources: Reply');
    cy.get('.ref-list .ref .link a').contains('Title');

    cy.get('.full-page.ref .actions a').contains('delete').click();
    cy.get('.full-page.ref .actions a').contains('yes').click();
    cy.get('.ref-list .ref .actions a').contains('1 citation').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
});
