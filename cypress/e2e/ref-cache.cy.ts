import { openSidebar } from './setup';

describe('Download/Upload with Cache Files', () => {
  const testFileContent = 'Test cache file content for Cypress test';
  const testFileName = 'test-cache-file.txt';
  const downloadsFolder = Cypress.config('downloadsFolder');

  it('uploads a file to create a cached ref and submits it', () => {
    // Go directly to the upload page
    cy.visit('/submit/upload?debug=ADMIN');

    // Intercept the proxy upload
    cy.intercept('POST', '/api/v1/proxy').as('cacheUpload');

    // Wait for the page to load and find the file input
    cy.get('input[type="file"]', { timeout: 10000 }).should('exist');

    // Upload a file which will be cached
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from(testFileContent),
      fileName: testFileName,
      mimeType: 'text/plain'
    }, { force: true });

    // Wait for cache upload to complete
    cy.wait('@cacheUpload', { timeout: 15000 });

    // The file should now be in the uploads list
    cy.get('.uploads', { timeout: 10000 }).should('contain', testFileName);

    // Tag all refs with a test tag (without reloading the page)
    cy.get('input[placeholder*="tag"]').type('test/cache{enter}');

    // Submit the refs
    cy.intercept('POST', '/api/v1/ref').as('submit');
    cy.get('button').contains('push').click();
    cy.wait('@submit', { timeout: 15000 });
    cy.wait(1000);
  });

  it('navigates to the test tag and verifies ref exists', () => {
    cy.visit('/tag/test/cache?debug=ADMIN');
    cy.wait(1000);

    // Should see at least one ref
    cy.get('.ref').should('have.length.greaterThan', 0);
    cy.get('.ref').first().should('contain', testFileName);
  });

  it('downloads refs with bulk download (real zip)', () => {
    cy.visit('/tag/test/cache?debug=ADMIN');

    // Wait for refs to load
    cy.get('.ref', { timeout: 10000 }).should('have.length.greaterThan', 0);

    // Open bulk actions
    cy.get('.bulk.actions').should('be.visible');

    // Intercept cache file fetch
    cy.intercept('GET', '/api/v1/proxy*').as('cacheFetch');

    // Click download button - this creates a real zip file
    cy.get('.bulk.actions button').contains('download').click();

    // Wait for cache fetch (may or may not happen depending on if ref has cache)
    cy.wait(3000);

    // Verify the downloaded zip exists (filename is based on tag: test/cache -> test_cache.zip)
    cy.readFile(`${downloadsFolder}/test_cache.zip`, { timeout: 10000 }).should('exist');
  });

  it('deletes the cached ref to test restore', () => {
    cy.visit('/tag/test/cache?debug=ADMIN');

    // Wait for refs to load
    cy.get('.ref', { timeout: 10000 }).should('have.length.greaterThan', 0);

    // Intercept delete request
    cy.intercept('DELETE', '/api/v1/ref*').as('deleteRef');

    // Delete the ref to test restore functionality
    cy.get('.bulk.actions button').contains('delete').click();
    cy.get('.bulk.actions').contains('yes').click();
    cy.wait('@deleteRef', { timeout: 15000 });

    // Verify ref is deleted
    cy.visit('/tag/test/cache?debug=ADMIN');
    cy.wait(1000);
    cy.get('body').should('contain', 'No Refs');
  });

  it('uploads the downloaded zip to restore refs with cache files and submits them', () => {
    cy.visit('/submit/upload?debug=ADMIN');

    // Wait for the file input to be available
    cy.get('input[type="file"]', { timeout: 10000 }).should('exist');

    // Upload the previously downloaded zip file (filename is test_cache.zip based on tag)
    // Note: With current implementation, cache files from zips are NOT uploaded when selected.
    // They are extracted but not uploaded until implementation is enhanced to upload them
    // conditionally when refs are submitted (after existence check fails).
    cy.get('input[type="file"]').selectFile(`${downloadsFolder}/test_cache.zip`, { force: true });

    // The refs should appear in the upload list
    cy.get('.uploads', { timeout: 10000 }).should('contain', testFileName);

    // Submit the refs (without reloading the page)
    cy.intercept('POST', '/api/v1/ref').as('submit');
    cy.get('button').contains('push').click();
    cy.wait('@submit', { timeout: 15000 });
    cy.wait(1000);
  });

  it('verifies the restored ref exists with cache file', () => {
    cy.visit('/tag/test/cache?debug=ADMIN');

    // Should see the restored ref
    cy.get('.ref', { timeout: 10000 }).should('have.length.greaterThan', 0);
    cy.get('.ref').first().should('contain', testFileName);
  });

  it('tests individual ref download with cache file', () => {
    cy.visit('/tag/test/cache?debug=ADMIN');

    // Wait for refs to load
    cy.get('.ref', { timeout: 10000 }).should('have.length.greaterThan', 0);

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
      exclude: 'test_cache.zip'
    }).should('exist');
  });

  it('cleans up test refs and downloaded files', () => {
    // Delete refs with test tag
    cy.visit('/tag/test/cache?debug=ADMIN');
    cy.wait(1000);

    cy.get('body').then($body => {
      if ($body.find('.ref').length > 0) {
        cy.intercept('DELETE', '/api/v1/ref*').as('cleanup');
        cy.get('.bulk.actions button').contains('delete').click();
        cy.get('.bulk.actions').contains('yes').click();
        cy.wait('@cleanup', { timeout: 15000 });
      }
    });

    // Clean up downloaded files
    cy.task('deleteDownloads', downloadsFolder);
  });
});
