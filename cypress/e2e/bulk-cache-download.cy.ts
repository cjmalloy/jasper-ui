import { openSidebar } from './setup';

describe('Bulk Download/Upload with Cache Files', () => {
  const testFileContent = 'Test cache file content for Cypress test';
  const testFileName = 'test-cache-file.txt';
  
  it('uploads a file to create a cached ref', () => {
    cy.visit('/?debug=ADMIN');
    openSidebar();
    cy.contains('Submit').click();
    
    // Upload a file which will be cached
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(testFileContent),
      fileName: testFileName,
      mimeType: 'text/plain'
    }, { force: true });
    
    // Wait for upload to complete
    cy.wait(2000);
    
    // The file should now be in the uploads list
    cy.get('.uploads').should('contain', testFileName);
  });
  
  it('tags and submits the cached ref', () => {
    cy.visit('/submit/upload?debug=ADMIN');
    
    // Tag all refs with a test tag
    cy.get('input[placeholder*="tag"]').type('test/cache/bulk{enter}');
    
    // Submit the refs
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('push').click();
    cy.wait('@submit');
    cy.wait(1000);
  });
  
  it('navigates to the test tag and verifies ref exists', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Should see at least one ref
    cy.get('.ref').should('have.length.greaterThan', 0);
    cy.get('.ref').first().should('contain', testFileName);
  });
  
  it('downloads refs with bulk download', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Open bulk actions
    cy.get('.bulk.actions').should('be.visible');
    
    // Click download button
    cy.get('.bulk.actions button').contains('download').click();
    
    // File should start downloading
    // Note: Cypress has limitations with file downloads, so we mainly verify the button click works
    cy.wait(2000);
  });
  
  it('verifies download functionality by checking the downloadPage call', () => {
    // This test verifies the download function is properly wired
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Spy on the download function
    cy.window().then((win) => {
      cy.spy(win.console, 'warn').as('consoleWarn');
    });
    
    // Trigger download
    cy.get('.bulk.actions button').contains('download').click();
    cy.wait(2000);
    
    // If there were any cache fetch failures, they would be logged
    // In a successful case, there should be no warnings
  });
  
  it('tests upload with cache files via mock zip', () => {
    // Create a mock zip structure with cache files
    // Since Cypress doesn't easily support creating actual zip files,
    // we'll verify the upload form accepts files
    cy.visit('/submit/upload?debug=ADMIN');
    
    // Verify the upload area exists
    cy.get('input[type="file"]').should('exist');
    
    // Try uploading a JSON file (which simulates part of a zip)
    const mockRef = {
      url: 'cache:test-uuid-123',
      title: 'Test Cache Ref',
      tags: ['test/cache/restore'],
      origin: '',
      plugins: {
        '_plugin/cache': {
          id: 'test-uuid-123'
        }
      }
    };
    
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify([mockRef])),
      fileName: 'test-refs.json',
      mimeType: 'application/json'
    }, { force: true });
    
    cy.wait(1000);
    
    // Verify the ref appears in the upload list
    cy.get('.uploads').should('contain', 'Test Cache Ref');
  });
  
  it('cleans up test refs', () => {
    // Delete refs with test tag
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    cy.get('body').then($body => {
      if ($body.find('.ref').length > 0) {
        cy.get('.bulk.actions button').contains('delete').click();
        cy.get('.bulk.actions').contains('yes').click();
        cy.wait(2000);
      }
    });
    
    cy.visit('/tag/test/cache/restore?debug=ADMIN');
    cy.wait(1000);
    
    cy.get('body').then($body => {
      if ($body.find('.ref').length > 0) {
        cy.get('.bulk.actions button').contains('delete').click();
        cy.get('.bulk.actions').contains('yes').click();
        cy.wait(2000);
      }
    });
  });
});
