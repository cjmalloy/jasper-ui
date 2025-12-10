import { clearMods, openSidebar } from './setup';

describe('Cursor-based Pagination', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });

  it('clear mods', () => {
    clearMods();
  });

  // Create multiple refs with different published dates for pagination testing
  it('creates first ref with older date', () => {
    cy.visit('/?debug=MOD');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('Oldest Post');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-01T00:00').blur();
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Oldest Post');
  });

  it('creates second ref with middle date', () => {
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('Middle Post');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2021-06-15T12:00').blur();
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Middle Post');
  });

  it('creates third ref with newest date', () => {
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('Newest Post');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2023-12-25T18:00').blur();
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Newest Post');
  });

  it('navigates to tag page with published sort and small page size', () => {
    // Visit the home page with sort by published and page size of 1
    cy.visit('/tag/*?debug=MOD&sort=published,DESC&pageSize=1');
    cy.intercept({pathname: '/api/v1/ref/page'}).as('load');
    cy.wait('@load');
    // Should show the newest post first
    cy.get('.ref-list-item .link a').first().should('have.text', 'Newest Post');
  });

  it('clicks next button and verifies cursor-based filter is applied', () => {
    // Click the next button
    cy.intercept({pathname: '/api/v1/ref/page'}).as('nextPage');
    cy.get('.page-controls .next-page').click();
    cy.wait('@nextPage');

    // URL should contain a published/before filter instead of pageNumber
    cy.url().should('include', 'filter=');
    cy.url().should('include', 'published%2Fbefore%2F');
    cy.url().should('not.include', 'pageNumber=');

    // Should show the middle post now
    cy.get('.ref-list-item .link a').first().should('have.text', 'Middle Post');
  });

  it('clicks next button again to get to oldest post', () => {
    cy.intercept({pathname: '/api/v1/ref/page'}).as('nextPage');
    cy.get('.page-controls .next-page').click();
    cy.wait('@nextPage');

    // Should still have published/before filter
    cy.url().should('include', 'published%2Fbefore%2F');

    // Should show the oldest post now
    cy.get('.ref-list-item .link a').first().should('have.text', 'Oldest Post');
  });

  it('clicks first button and verifies cursor filter is removed', () => {
    cy.intercept({pathname: '/api/v1/ref/page'}).as('firstPage');
    cy.get('.page-controls .first-page').click();
    cy.wait('@firstPage');

    // URL should not contain published/before filter anymore
    cy.url().should('not.include', 'published%2Fbefore%2F');
    cy.url().should('not.include', 'published%2Fafter%2F');

    // Should show the newest post first again
    cy.get('.ref-list-item .link a').first().should('have.text', 'Newest Post');
  });

  // Test cursor pagination with 'created' sort
  it('navigates with created sort and verifies cursor pagination', () => {
    cy.visit('/tag/*?debug=MOD&sort=created,DESC&pageSize=1');
    cy.intercept({pathname: '/api/v1/ref/page'}).as('load');
    cy.wait('@load');

    // Click next - should use created/before filter
    cy.intercept({pathname: '/api/v1/ref/page'}).as('nextPage');
    cy.get('.page-controls .next-page').click();
    cy.wait('@nextPage');

    cy.url().should('include', 'created%2Fbefore%2F');
    cy.url().should('not.include', 'pageNumber=');
  });

  // Test cursor pagination with 'modified' sort
  it('navigates with modified sort and verifies cursor pagination', () => {
    cy.visit('/tag/*?debug=MOD&sort=modified,DESC&pageSize=1');
    cy.intercept({pathname: '/api/v1/ref/page'}).as('load');
    cy.wait('@load');

    // Click next - should use modified/before filter
    cy.intercept({pathname: '/api/v1/ref/page'}).as('nextPage');
    cy.get('.page-controls .next-page').click();
    cy.wait('@nextPage');

    cy.url().should('include', 'modified%2Fbefore%2F');
    cy.url().should('not.include', 'pageNumber=');
  });

  // Test that non-date sorts still use regular pagination
  it('verifies non-date sort uses regular pageNumber pagination', () => {
    cy.visit('/tag/*?debug=MOD&sort=title,ASC&pageSize=1');
    cy.intercept({pathname: '/api/v1/ref/page'}).as('load');
    cy.wait('@load');

    // Click next - should use pageNumber instead of filter
    cy.intercept({pathname: '/api/v1/ref/page'}).as('nextPage');
    cy.get('.page-controls .next-page').click();
    cy.wait('@nextPage');

    cy.url().should('include', 'pageNumber=');
    cy.url().should('not.include', 'published%2F');
    cy.url().should('not.include', 'created%2F');
    cy.url().should('not.include', 'modified%2F');
  });

  // Cleanup
  it('cleanup: delete test refs', () => {
    cy.visit('/tag/*?debug=MOD');
    cy.intercept({pathname: '/api/v1/ref/page'}).as('load');
    cy.wait('@load');

    // Delete all refs we created
    cy.get('.ref-list-item').each(() => {
      cy.get('.ref-list-item').first().find('.actions *').contains('delete').click();
      cy.get('.ref-list-item').first().find('.actions *').contains('yes').click();
      cy.wait(500);
    });
  });
});
