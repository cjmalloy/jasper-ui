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
    
    // Enable plugin/file for upload functionality
    cy.wait(100);
    cy.get('#mod-file').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });

  it('creates a ref with plugin/pdf tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    
    // Select plugin/pdf from dropdown to show upload button
    cy.get('app-select-plugin select').select('plugin/pdf');
    
    // Upload the PDF file
    cy.get('app-pdf-upload input[type="file"]').selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for upload to complete and form to navigate to web page
    cy.wait(2000);
    
    // Set published date
    cy.get('[name=published]').type('2020-01-01T00:00').blur();
    
    // The plugin/pdf tag should already be added from the plugin selection
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'test.pdf');
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

  it('creates a ref with plugin/file tag', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    
    // For generic file types, we'll use plugin/pdf which accepts various formats
    cy.get('app-select-plugin select').select('plugin/pdf');
    
    // Upload the DOC file
    cy.get('app-pdf-upload input[type="file"]').selectFile('cypress/fixtures/test.doc', { force: true });
    
    // Wait for upload to complete and form to navigate to web page
    cy.wait(2000);
    
    // Set published date
    cy.get('[name=published]').type('2020-01-03T00:00').blur();
    
    // Change the plugin tag from plugin/pdf to plugin/file
    cy.get('app-tags input').last().type('plugin/file{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'test.doc');
  });

  it('should have markdown action on file ref', () => {
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
  });

  it('creates a public ref for visibility test', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    
    // Select plugin/pdf from dropdown to show upload button
    cy.get('app-select-plugin select').select('plugin/pdf');
    
    // Upload the PDF file
    cy.get('app-pdf-upload input[type="file"]').selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for upload to complete and form to navigate to web page
    cy.wait(2000);
    
    // Set published date
    cy.get('[name=published]').type('2020-01-04T00:00').blur();
    
    // Add public tag
    cy.get('app-tags input').last().type('public{enter}');
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'test.pdf');
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
    
    // Select plugin/pdf from dropdown to show upload button
    cy.get('app-select-plugin select').select('plugin/pdf');
    
    // Upload the PDF file
    cy.get('app-pdf-upload input[type="file"]').selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for upload to complete and form to navigate to web page
    cy.wait(2000);
    
    // Set published date
    cy.get('[name=published]').type('2020-01-05T00:00').blur();
    
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click({ force: true });
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'test.pdf');
    
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
    
    // Search for test.pdf (there will be multiple, delete them all)
    openSidebar();
    cy.get('input[type=search]').type('test.pdf{enter}');
    cy.wait(500);
    
    // Delete all test.pdf refs
    cy.get('body').then($body => {
      if ($body.find('.ref-list .link:contains("test.pdf")').length > 0) {
        cy.get('.ref-list .link').contains('test.pdf').parent().parent().parent().as('ref');
        cy.get('@ref').find('.actions').contains('delete').click();
        cy.get('@ref').find('.actions').contains('yes').click();
        cy.wait(500);
      }
    });
    
    // Search for test.doc
    cy.get('input[type=search]').clear().type('test.doc{enter}');
    cy.wait(500);
    cy.get('body').then($body => {
      if ($body.find('.ref-list .link:contains("test.doc")').length > 0) {
        cy.get('.ref-list .link').contains('test.doc').parent().parent().parent().as('ref');
        cy.get('@ref').find('.actions').contains('delete').click();
        cy.get('@ref').find('.actions').contains('yes').click();
      }
    });
  });
});
