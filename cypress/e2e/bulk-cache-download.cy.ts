import { openSidebar } from './setup';

describe('Bulk Download/Upload with Cache Files', () => {
  const testFileContent = 'Test cache file content for Cypress test';
  const testFileName = 'test-cache-file.txt';
  const downloadsFolder = Cypress.config('downloadsFolder');
  
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
  
  it('downloads refs with bulk download (real zip)', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Open bulk actions
    cy.get('.bulk.actions').should('be.visible');
    
    // Click download button - this creates a real zip file
    cy.get('.bulk.actions button').contains('download').click();
    
    // Wait for download to complete
    cy.wait(3000);
    
    // Verify the downloaded zip exists
    cy.readFile(`${downloadsFolder}/test_cache_bulk.zip`, { timeout: 10000 }).should('exist');
  });
  
  it('deletes the cached ref to test restore', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Delete the ref to test restore functionality
    cy.get('.bulk.actions button').contains('delete').click();
    cy.get('.bulk.actions').contains('yes').click();
    cy.wait(2000);
    
    // Verify ref is deleted
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    cy.get('body').should('contain', 'No Refs');
  });
  
  it('uploads the downloaded zip to restore refs with cache files', () => {
    cy.visit('/submit/upload?debug=ADMIN');
    
    // Intercept the cache upload network request
    cy.intercept('POST', '/api/v1/proxy').as('cacheUpload');
    // Upload the previously downloaded zip file
    cy.get('input[type="file"]').selectFile(`${downloadsFolder}/test_cache_bulk.zip`, { force: true });
    // Wait for the upload network request to complete
    cy.wait('@cacheUpload');
    
    // The refs should appear in the upload list
    cy.get('.uploads').should('contain', testFileName);
  });
  
  it('submits the restored refs', () => {
    cy.visit('/submit/upload?debug=ADMIN');
    
    // Check if there are refs to submit
    cy.get('body').then($body => {
      if ($body.find('.uploads .ref').length > 0) {
        // Submit the refs
        cy.intercept({pathname: '/api/v1/ref'}).as('submit');
        cy.get('button').contains('push').click();
        cy.wait('@submit');
        cy.wait(1000);
      }
    });
  });
  
  it('verifies the restored ref exists with cache file', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Should see the restored ref
    cy.get('.ref').should('have.length.greaterThan', 0);
    cy.get('.ref').first().should('contain', testFileName);
  });
  
  it('tests individual ref download with cache file', () => {
    cy.visit('/tag/test/cache/bulk?debug=ADMIN');
    cy.wait(1000);
    
    // Click on the first ref to open it
    cy.get('.ref').first().click();
    cy.wait(1000);
    
    // Find and click the download action
    cy.get('.actions').contains('download').click();
    cy.wait(2000);
    
    // Verify a zip was downloaded for the individual ref with cache
    // The filename will be based on the ref title
    cy.task('findDownloadedFile', { 
      folder: downloadsFolder, 
      pattern: '*.zip',
      exclude: 'test_cache_bulk.zip'
    }).should('exist');
  });
  
  it('cleans up test refs and downloaded files', () => {
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
    
    // Clean up downloaded files
    cy.task('deleteDownloads', downloadsFolder);
  });
});
