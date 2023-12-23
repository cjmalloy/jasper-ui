import { clearMods } from './setup';

describe('Ref Actions', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('creates a ref', () => {
    cy.visit('/?debug=MOD');
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Title');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-01T00:00').blur();
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('edits comments field', () => {
    cy.get('.actions *').contains('edit').click();
    cy.get('#comment textarea').type('Comment field');
    cy.get('form .md').should('contain', 'Comment field');
    cy.get('button').contains('save').click();
    cy.get('.full-page.ref').should('contain', 'Comment field');
    cy.get('.full-page.ref .toggle-x').click();
    cy.get('.full-page.ref').should('not.contain', 'Comment field');
  });
  xit('adds tag inline (this breaks loading "1 citation" text)', () => {
    cy.get('.actions *').contains('tag').click();
    cy.get('.inline-tagging input').type('cool{enter}');
    cy.get('.full-page.ref .tag:not(.user)').contains('cool').should('exist');
  });
  it('creates reply', () => {
    cy.get('.actions *').contains('reply').click();
    cy.get('#title').type('Reply');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('shows parent', () => {
    cy.get('.actions *').contains('parent').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
    cy.title().should('includes', 'Title');
  });
  it('adds tag inline', () => {
    cy.get('.actions *').contains('tag').click();
    cy.get('.inline-tagging input').type('cool{enter}');
    cy.get('.full-page.ref .tag:not(.user)').contains('cool').should('exist');
  });
  it('shows responses', () => {
    cy.get('.full-page.ref .actions *').contains('1 citation').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
    cy.title().should('includes', 'Responses: Title');
    cy.get('.ref-list .ref .link a').contains('Reply');
  });
  it('should delete reply', () => {
    cy.get('.ref-list .ref .actions *').contains('delete').click();
    cy.get('.ref-list .ref .actions *').contains('yes').click();
    cy.get('.ref-list .ref .actions *').contains('parent').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
});
