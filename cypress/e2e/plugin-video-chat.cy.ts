import { clearMods, openSidebar } from './setup';

describe('Video Chat Plugin', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 }); // 1 minute
  });

  it('clear mods', () => {
    clearMods();
  });

  it('turn on chat and video plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    // Wait for the setup tab to load
    cy.get('#mod-chat').should('be.visible');
    cy.get('#mod-chat').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });

  it('creates a chatroom', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('Video Chat Room');
    cy.contains('show advanced').click();
    cy.get('.tag-edit input').type('plugin/chat{enter}');
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Video Chat Room');
  });

  it('shows call button in chatroom', () => {
    cy.get('.sidebar .button-bar').should('contain', 'call');
    cy.get('.submit-button').contains('call').should('be.visible');
  });

  it('starts a video call', () => {
    // Mock getUserMedia to avoid browser permission prompts
    cy.window().then((win) => {
      cy.stub(win.navigator.mediaDevices, 'getUserMedia').resolves({
        getTracks: () => [],
      } as any);
    });

    cy.intercept({method: 'POST', pathname: '/api/v1/ref/source'}).as('respond');
    cy.get('.submit-button').contains('call').click();
    cy.wait('@respond');
  });

  it('shows hangup button after call starts', () => {
    cy.get('.sidebar .button-bar').should('contain', 'hangup');
    cy.get('.submit-button').contains('hangup').should('be.visible');
    cy.get('.submit-button').contains('call').should('not.exist');
  });

  it('shows loading indicator when waiting for other users', () => {
    cy.get('.sidebar .button-bar app-loading').should('exist');
  });

  it('ends the video call', () => {
    cy.intercept({method: 'DELETE', pathname: '/api/v1/ref/source'}).as('deleteResponse');
    cy.get('.submit-button').contains('hangup').click();
    cy.wait('@deleteResponse');
  });

  it('shows call button again after hangup', () => {
    cy.get('.sidebar .button-bar').should('contain', 'call');
    cy.get('.submit-button').contains('call').should('be.visible');
    cy.get('.submit-button').contains('hangup').should('not.exist');
  });

  it('video chat works with chat/ tagged refs', () => {
    cy.visit('/?debug=USER');
    openSidebar();
    cy.contains('Submit').click();
    cy.get('.tabs').contains('text').click();
    cy.get('[name=title]').type('General Chat');
    cy.contains('show advanced').click();
    cy.get('.tag-edit input').type('chat/general{enter}');
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'General Chat');
  });

  it('shows call button for chat/ tagged refs', () => {
    cy.get('.sidebar .button-bar').should('contain', 'call');
    cy.get('.submit-button').contains('call').should('be.visible');
  });

  it('video call button appears in tag view for chat/ tags', () => {
    cy.visit('/tag/chat/general?debug=USER');
    cy.get('.sidebar .button-bar').should('contain', 'call');
    cy.get('.submit-button').contains('call').should('be.visible');
  });

  it('video call works with mock media stream', () => {
    // Mock getUserMedia with a more realistic stream
    cy.window().then((win) => {
      const mockTrack = {
        stop: cy.stub(),
        kind: 'video',
        enabled: true,
      };
      const mockStream = {
        getTracks: () => [mockTrack],
        getVideoTracks: () => [mockTrack],
        getAudioTracks: () => [],
      };
      cy.stub(win.navigator.mediaDevices, 'getUserMedia').resolves(mockStream as any);
    });

    cy.intercept({method: 'POST', pathname: '/api/v1/ref/source'}).as('respond');
    cy.get('.submit-button').contains('call').click();
    cy.wait('@respond');

    // Verify hangup button is shown
    cy.get('.submit-button').contains('hangup').should('be.visible');

    // Hangup
    cy.intercept({method: 'DELETE', pathname: '/api/v1/ref/source'}).as('deleteResponse');
    cy.get('.submit-button').contains('hangup').click();
    cy.wait('@deleteResponse');
  });

  it('cleans up test refs', () => {
    cy.visit('/ref/e/internal:?debug=USER&search=Video+Chat+Room');
    cy.get('.ref-list-item.ref .actions *').contains('delete').click();
    cy.get('.ref-list-item.ref .actions *').contains('yes').click();
    
    // Wait for deletion to complete before navigating
    cy.intercept({method: 'DELETE', pathname: '/api/v1/ref'}).as('delete1');
    cy.wait('@delete1');

    cy.visit('/ref/e/internal:?debug=USER&search=General+Chat');
    cy.get('.ref-list-item.ref .actions *').contains('delete').click();
    cy.get('.ref-list-item.ref .actions *').contains('yes').click();
  });
});
