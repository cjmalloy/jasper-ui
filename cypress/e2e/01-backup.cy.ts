import { openSidebar } from './setup';

describe('Backup / Restore', () => {
  it('creates a ref', () => {
    cy.visit('/?debug=ADMIN');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('test:backup');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(1000); // First part of title getting truncated
    cy.get('[name=title]').type('Backup Test');
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Backup Test');
  });
  it('creates backup', () => {
    cy.visit('/settings/backup?debug=ADMIN');
    cy.get('button').contains('+ backup').click();
    // Wait for overlay to appear
    cy.get('button').contains('OK').should('be.visible');
    // Click OK to create backup with default options
    cy.get('button').contains('OK').click();
  });
  it('deletes ref', () => {
    cy.visit(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    cy.get('.full-page.ref .actions *').contains('delete').click();
    cy.get('.full-page.ref .actions *').contains('yes').click();
    cy.visit(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    cy.contains('Not Found');
  });
  it('restores backup', () => {
    cy.visit('/settings/backup?debug=ADMIN');
    cy.get('.backup .action .fake-link').contains('restore').click();
    cy.get('.backup .action .fake-link').contains('yes').click();
    cy.wait(1000);
    cy.visit(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    cy.get('.full-page.ref .link a').should('have.text', 'Backup Test');
  });
  it('deletes ref', () => {
    cy.visit(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    cy.get('.full-page.ref .actions *').contains('delete').click();
    cy.get('.full-page.ref .actions *').contains('yes').click();
    cy.visit(`/ref/e/${encodeURIComponent('test:backup')}?debug=ADMIN`);
    cy.contains('Not Found');
  });
});
