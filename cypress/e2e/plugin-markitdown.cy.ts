import { clearMods, openSidebar } from './setup';

describe('MarkItDown Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });

  it('clear mods', () => {
    clearMods();
  });

  it('turn on markitdown plugin', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-markitdown').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });

  it('creates a ref with plugin/pdf tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://example.com/sample.pdf');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(500);
    cy.get('[name=title]').type('Test PDF Document');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-01T00:00').blur();
    
    // Add plugin/pdf tag
    cy.get('[name=tags]').type('plugin/pdf{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Test PDF Document');
  });

  it('should show markdown action button', () => {
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
  });

  it('should trigger markdown conversion', () => {
    // Click the markdown action button
    cy.get('.full-page.ref .actions *').contains('markdown').click();
    
    // Should now show cancel button
    cy.get('.full-page.ref .actions').should('contain', 'cancel');
    
    // Wait for conversion to complete (or timeout)
    // The plugin has a 10-minute timeout
    cy.wait(2000);
  });

  it('should show markdown query notification', () => {
    // Check if the markitdown query tag was added
    cy.get('.full-page.ref').should('contain', 'markitdown');
  });

  it('creates a ref with plugin/image tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://example.com/image.png');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(500);
    cy.get('[name=title]').type('Test Image');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-02T00:00').blur();
    
    // Add plugin/image tag
    cy.get('[name=tags]').type('plugin/image{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Test Image');
  });

  it('should have markdown action on image ref', () => {
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
  });

  it('creates a ref with plugin/file tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://example.com/document.docx');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(500);
    cy.get('[name=title]').type('Test Word Document');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-03T00:00').blur();
    
    // Add plugin/file tag
    cy.get('[name=tags]').type('plugin/file{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Test Word Document');
  });

  it('should have markdown action on file ref', () => {
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
  });

  it('creates a public ref for visibility test', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://example.com/public.pdf');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(500);
    cy.get('[name=title]').type('Public PDF Document');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-04T00:00').blur();
    
    // Add public and plugin/pdf tags
    cy.get('[name=tags]').type('public{enter}');
    cy.get('[name=tags]').type('plugin/pdf{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Public PDF Document');
  });

  it('should propagate public tag to response', () => {
    // Verify public tag is visible
    cy.get('.full-page.ref .tag').contains('public').should('exist');
  });

  it('should show markdown filter in notifications', () => {
    cy.visit('/?debug=USER');
    cy.get('.settings .notification').click();
    
    // Should see markitdown query filter
    cy.get('.tabs').should('contain', 'markitdown');
  });

  it('can filter by markdown signature tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    
    // Check if markdown filter exists in sidebar
    cy.get('.sidebar').should('contain', 'markdown');
  });

  it('cancels markdown conversion', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('#url').type('https://example.com/cancel.pdf');
    cy.contains('Next').as('next');
    cy.get('@next').click();
    cy.wait(500);
    cy.get('[name=title]').type('Cancel Test PDF');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-05T00:00').blur();
    
    // Add plugin/pdf tag
    cy.get('[name=tags]').type('plugin/pdf{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Cancel Test PDF');
    
    // Click markdown action
    cy.get('.full-page.ref .actions *').contains('markdown').click();
    cy.get('.full-page.ref .actions').should('contain', 'cancel');
    
    // Click cancel
    cy.get('.full-page.ref .actions *').contains('cancel').click();
    
    // Should show markdown action again (not cancel)
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
    cy.get('.full-page.ref .actions').should('not.contain', 'cancel');
  });

  it('cleans up test refs', () => {
    // Clean up the refs we created
    cy.visit('/?debug=USER');
    
    // Search for Test PDF Document
    openSidebar();
    cy.get('input[type=search]').type('Test PDF Document{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('Test PDF Document').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('delete').click();
    cy.get('@ref').find('.actions').contains('yes').click();
    cy.wait(500);
    
    // Search for Test Image
    cy.get('input[type=search]').clear().type('Test Image{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('Test Image').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('delete').click();
    cy.get('@ref').find('.actions').contains('yes').click();
    cy.wait(500);
    
    // Search for Test Word Document
    cy.get('input[type=search]').clear().type('Test Word Document{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('Test Word Document').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('delete').click();
    cy.get('@ref').find('.actions').contains('yes').click();
    cy.wait(500);
    
    // Search for Public PDF Document
    cy.get('input[type=search]').clear().type('Public PDF Document{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('Public PDF Document').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('delete').click();
    cy.get('@ref').find('.actions').contains('yes').click();
    cy.wait(500);
    
    // Search for Cancel Test PDF
    cy.get('input[type=search]').clear().type('Cancel Test PDF{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('Cancel Test PDF').parent().parent().parent().as('ref');
    cy.get('@ref').find('.actions').contains('delete').click();
    cy.get('@ref').find('.actions').contains('yes').click();
  });
});
