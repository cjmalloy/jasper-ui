import { clearMods, openSidebar } from './setup';

describe('Ref Actions', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('creates a ref', () => {
    cy.visit('/?debug=MOD');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('Title');
    cy.contains('show advanced').click();
    cy.get('[name=published]').type('2020-01-01T00:00').blur();
    cy.get('button').contains('Submit').click({ force: true });
    cy.get('.full-page.ref .link a').should('have.text', 'Title');
  });
  it('edits comments field', () => {
    cy.get('.actions *').contains('edit').click();
    cy.get('button').contains('+ Add abstract').click();
    cy.get('.full-page.ref .editor textarea').type('Comment field');
    cy.get('button').contains('save').click();
    cy.get('.full-page.ref').should('contain', 'Comment field');
    cy.get('.full-page.ref .toggle-x').click();
    cy.get('.full-page.ref').should('not.contain', 'Comment field');
  });
  it('adds tag inline (this breaks loading "1 citation" text)', () => {
    cy.get('.actions *').contains('tag').click();
    cy.get('.inline-tagging input').type('cool{enter}');
    cy.get('.full-page.ref .tag:not(.user)').contains('cool').should('exist');
  });
  it('creates reply', () => {
    cy.get('.actions *').contains('reply').click();
    cy.get('.full-page.ref .comment-reply textarea').type('Reply');
    cy.get('.full-page.ref button').contains('reply').click();
    cy.get('.full-page.ref .actions *').contains('1 citation').click();
    cy.get('.ref-list-item.ref .actions *').contains('permalink').click();
    cy.get('.full-page.ref .link a').should('have.text', 'Reply');
  });
  it('shows parent', () => {
    cy.get('.full-page.ref .actions *').contains('parent').click();
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

  // Tests for "(X new)" indicator functionality
  describe('New Comments/Threads/Replies Indicators', () => {
    it('should clear localStorage for clean test', () => {
      cy.clearLocalStorage();
    });

    it('should create a ref with comments enabled', () => {
      cy.visit('/?debug=MOD');
      openSidebar();
      cy.contains('Submit').click();
      cy.get('.tabs').contains('text').click();
      cy.get('[name=title]').type('Test Ref for New Indicators');
      cy.contains('show advanced').click();
      cy.get('[name=published]').type('2020-02-01T00:00').blur();
      cy.get('button').contains('Submit').click({ force: true });
      cy.get('.full-page.ref .link a').should('have.text', 'Test Ref for New Indicators');
    });

    it('should show "(1 new)" when first comment is added', () => {
      // Add a comment with API intercept
      cy.intercept('POST', '/api/v1/ref').as('createComment');
      cy.get('.actions *').contains('reply').click();
      cy.get('.full-page.ref .comment-reply textarea').type('First comment');
      cy.get('.full-page.ref button').contains('reply').click();
      
      // Wait for comment to be created
      cy.wait('@createComment');
      cy.wait(1000); // Additional wait for metadata to update
      
      // Navigate away
      cy.visit('/?debug=MOD');
      cy.wait(1000);
      
      // Navigate back and check for "(1 new)" indicator
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions').should('contain', 'comment');
      cy.get('@testRef').find('.actions').should('contain', '(1 new)');
    });

    it('should clear "(X new)" after viewing comments', () => {
      // Click on comments link to view them
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions *').contains('comment').click();
      
      // Wait for page to load
      cy.wait(1000);
      
      // Navigate away and back
      cy.visit('/?debug=MOD');
      cy.wait(1000);
      
      // Check that "(X new)" is gone
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions').should('contain', 'comment');
      cy.get('@testRef').find('.actions').should('not.contain', 'new');
    });

    it('should show "(2 new)" when two more comments are added', () => {
      // Navigate to the ref
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').click();
      
      // Add second comment with API intercept
      cy.intercept('POST', '/api/v1/ref').as('createComment2');
      cy.get('.actions *').contains('reply').click();
      cy.get('.full-page.ref .comment-reply textarea').type('Second comment');
      cy.get('.full-page.ref button').contains('reply').click();
      cy.wait('@createComment2');
      cy.wait(1000);
      
      // Add third comment with API intercept
      cy.intercept('POST', '/api/v1/ref').as('createComment3');
      cy.get('.actions *').contains('reply').click();
      cy.get('.full-page.ref .comment-reply textarea').type('Third comment');
      cy.get('.full-page.ref button').contains('reply').click();
      cy.wait('@createComment3');
      cy.wait(1000);
      
      // Navigate away and back
      cy.visit('/?debug=MOD');
      cy.wait(1000);
      
      // Check for "(2 new)" indicator (3 total - 1 previously seen)
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions').should('contain', 'comment');
      cy.get('@testRef').find('.actions').should('contain', '(2 new)');
    });

    it('should persist "(X new)" across page reloads', () => {
      // Reload the page
      cy.reload();
      cy.wait(1000);
      
      // Check that "(2 new)" is still there
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions').should('contain', 'comment');
      cy.get('@testRef').find('.actions').should('contain', '(2 new)');
    });

    it('should reset counter when navigating to comments page', () => {
      // Click on comments to view them
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions *').contains('comment').click();
      
      // Wait for page to load and navigate away
      cy.wait(1000);
      cy.visit('/?debug=MOD');
      cy.wait(1000);
      
      // Verify "(X new)" is cleared
      cy.get('.ref-list .link a').contains('Test Ref for New Indicators').parent().parent().parent().as('testRef');
      cy.get('@testRef').find('.actions').should('contain', 'comment');
      cy.get('@testRef').find('.actions').should('not.contain', 'new');
    });

    it('should show "(X new)" for collapsed comments in comment thread', () => {
      // Create a ref with a comment
      cy.visit('/?debug=MOD');
      openSidebar();
      cy.contains('Submit').click();
      cy.get('.tabs').contains('text').click();
      cy.get('[name=title]').type('Parent for Nested Comments');
      cy.contains('show advanced').click();
      cy.get('[name=published]').type('2020-03-01T00:00').blur();
      cy.get('button').contains('Submit').click({ force: true });
      cy.get('.full-page.ref .link a').should('have.text', 'Parent for Nested Comments');
      
      // Add a comment with API intercept
      cy.intercept('POST', '/api/v1/ref').as('createParent');
      cy.get('.actions *').contains('reply').click();
      cy.get('.full-page.ref .comment-reply textarea').type('Parent comment');
      cy.get('.full-page.ref button').contains('reply').click();
      cy.wait('@createParent');
      cy.wait(1000);
      
      // Navigate to the comment
      cy.get('.full-page.ref .actions *').contains('citation').click();
      cy.wait(500);
      cy.get('.ref-list-item.ref .actions *').contains('permalink').click();
      cy.wait(1000);
      
      // Add a reply to the comment with API intercept
      cy.intercept('POST', '/api/v1/ref').as('createChild');
      cy.get('.actions *').contains('reply').click();
      cy.get('.full-page.ref .comment-reply textarea').type('Child comment');
      cy.get('.full-page.ref button').contains('reply').click();
      cy.wait('@createChild');
      cy.wait(1000);
      
      // Collapse the comment (if expanded)
      cy.get('.comment-collapse').first().click();
      cy.wait(500);
      
      // The collapsed comment should show "(1 new)" for the child comment
      cy.get('.comment.collapsed').should('contain', 'child');
      cy.get('.comment.collapsed').should('contain', '(1 new)');
    });
  });
});
