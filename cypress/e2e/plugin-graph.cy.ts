import { clearMods, openSidebar } from './setup';

describe('Graph Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('turn on graphing', () => {
    cy.visit('/settings/setup?debug=ADMIN');

    cy.wait(100);
    cy.get('#mod-experiments').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.reload();

    cy.wait(100);
    cy.get('#mod-graph').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('creates a ref', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('#title').type('Title');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-01T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('shows graph', () => {
    cy.get('.full-page .actions *').contains('edit').click();
    cy.get('#url').then($url => {
      cy.visit('/tag/@*?search=' + $url.val() + '&debug=USER');
    });
    cy.get('.tabs').contains('graph').click();
    cy.get('figure').contains('Title');
  });
  it('creates reply', () => {
    cy.get('.ref .actions *').contains('reply').click();
    cy.get('#title').type('Reply');
    cy.contains('show advanced').click();
    cy.get('#published').type('2020-01-02T00:00');
    cy.get('button').contains('Submit').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('graphs reply', () => {
    cy.get('.full-page .actions *').contains('edit').click();
    cy.get('#url').then($url => {
      cy.visit('/tag/@*?search=' + $url.val() + '&debug=USER');
    });
    cy.get('.tabs').contains('graph').click();
    cy.get('figure').contains('Reply');
    cy.contains('load more').click();
    cy.get('figure').rightclick();
    cy.contains('Select all').click();
    cy.get('figure').contains('Title');
  });
});
