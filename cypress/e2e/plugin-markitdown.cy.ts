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
    
    // Click the upload tab
    cy.get('.tabs').contains('upload').click();
    
    // Upload the PDF file
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for file to be processed
    cy.wait(1000);
    
    // Add plugin/pdf tag to the uploaded ref
    cy.get('input#add-tag').type('plugin/pdf{enter}');
    
    // Set published date on the ref
    cy.get('app-ref [name=published]').first().type('2020-01-01T00:00').blur();
    
    // Upload all
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('upload all').click();
    cy.wait('@submit');
    
    // Verify the ref was created
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.pdf{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.pdf').should('exist');
  });

  it('should show markdown action button', () => {
    // Navigate to the uploaded ref
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.pdf{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.pdf').click();
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
    
    // Click the upload tab
    cy.get('.tabs').contains('upload').click();
    
    // Upload the DOC file
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test.doc', { force: true });
    
    // Wait for file to be processed
    cy.wait(1000);
    
    // Add plugin/file tag to the uploaded ref
    cy.get('input#add-tag').type('plugin/file{enter}');
    
    // Set published date on the ref
    cy.get('app-ref [name=published]').first().type('2020-01-03T00:00').blur();
    
    // Upload all
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('upload all').click();
    cy.wait('@submit');
    
    // Verify the ref was created
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.doc{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.doc').should('exist');
  });

  it('should have markdown action on file ref', () => {
    // Navigate to the uploaded ref
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.doc{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.doc').click();
    cy.get('.full-page.ref .actions').should('contain', 'markdown');
  });

  it('creates a public ref for visibility test', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    
    // Click the upload tab
    cy.get('.tabs').contains('upload').click();
    
    // Upload the PDF file
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for file to be processed
    cy.wait(1000);
    
    // Add public and plugin/pdf tags
    cy.get('input#add-tag').type('public{enter}');
    cy.get('input#add-tag').type('plugin/pdf{enter}');
    
    // Set published date on the ref
    cy.get('app-ref [name=published]').first().type('2020-01-04T00:00').blur();
    
    // Upload all
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('upload all').click();
    cy.wait('@submit');
    
    // Verify the ref was created with public tag
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.pdf public{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.pdf').should('exist');
  });

  it('should propagate public tag to response', () => {
    // Navigate to the public ref
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').type('test.pdf public{enter}');
    cy.wait(500);
    cy.get('.ref-list .link').contains('test.pdf').click();
    
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
    
    // Click the upload tab
    cy.get('.tabs').contains('upload').click();
    
    // Upload the PDF file
    cy.get('input[type="file"]').first().selectFile('cypress/fixtures/test.pdf', { force: true });
    
    // Wait for file to be processed
    cy.wait(1000);
    
    // Add plugin/pdf tag
    cy.get('input#add-tag').type('plugin/pdf{enter}');
    
    // Set published date on the ref
    cy.get('app-ref [name=published]').first().type('2020-01-05T00:00').blur();
    
    // Upload all
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('upload all').click();
    cy.wait('@submit');
    
    // Navigate to the ref
    cy.visit('/?debug=USER');
    openSidebar();
    cy.get('input[type=search]').clear().type('test.pdf{enter}');
    cy.wait(500);
    // Click on one of the test.pdf refs (there will be multiple)
    cy.get('.ref-list .link').contains('test.pdf').last().click();
    
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
    // Clean up the refs we created (there will be multiple test.pdf files)
    cy.visit('/?debug=USER');
    
    // Delete all test.pdf refs
    openSidebar();
    cy.get('input[type=search]').type('test.pdf{enter}');
    cy.wait(500);
    
    // Delete each test.pdf ref found
    const deleteRefs = () => {
      cy.get('body').then($body => {
        if ($body.find('.ref-list .link:contains("test.pdf")').length > 0) {
          cy.get('.ref-list .link').contains('test.pdf').first().parent().parent().parent().as('ref');
          cy.get('@ref').find('.actions').contains('delete').click();
          cy.get('@ref').find('.actions').contains('yes').click();
          cy.wait(500);
          deleteRefs(); // Recursively delete until none left
        }
      });
    };
    deleteRefs();
    
    // Delete test.doc
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
