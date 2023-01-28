describe('Ref Actions', {
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
  it('creates a ref', () => {
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Title');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-01T00:00').blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('edits comments field', () => {
    cy.get('.actions a').contains('edit').click();
    cy.get('#comment').type('Comment field');
    cy.get('form .md').should('contain', 'Comment field');
    cy.get('button').contains('save').click();
    cy.get('.full-page.ref').should('not.contain', 'Comment field');
    cy.get('.full-page.ref  .toggle-comment').click();
    cy.get('.full-page.ref').should('contain', 'Comment field');
  });
  it('adds tag inline', () => {
    cy.get('.actions a').contains('tag').click();
    cy.get('.inline-tagging input').type('cool{enter}');
    cy.get('.full-page.ref .tag:not(.user)').contains('cool').should('exist');
  });
  it('creates reply', () => {
    cy.get('.actions a').contains('reply').click();
    cy.get('#url').type('test:reply' + Math.random());
    cy.get('#scrape').uncheck();
    cy.contains('Next').click();
    cy.get('#title').type('Reply');
    cy.get('#published').type('2020-01-02T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('shows parent', () => {
    cy.get('.actions a').contains('parent').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
    cy.title().should('includes', 'Title');
  });
  it('shows responses', () => {
    cy.get('.full-page.ref .actions a').contains('1 citation').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
    cy.title().should('includes', 'Responses: Title');
    cy.get('.ref-list .ref .link a').contains('Reply');
  });
  it('should delete reply', () => {
    cy.get('.ref-list .ref .actions a').contains('delete').click();
    cy.get('.ref-list .ref .actions a').contains('yes').click();
    cy.get('.ref-list .ref .actions a').contains('parent').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
});
