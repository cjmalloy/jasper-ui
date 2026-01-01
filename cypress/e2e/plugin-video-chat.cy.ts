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

  it('turn on chat mod (includes chat, lobby, and video plugins)', () => {
    cy.visit('/settings/setup?debug=ADMIN');

    cy.wait(100);
    cy.get('#mod-experiments').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.reload();

    cy.wait(100);
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
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'Video Chat Room');

    // Add plugin/chat tag after creation
    cy.get('.actions *').contains('tag').click();
    cy.get('.inline-tagging input').type('plugin/chat{enter}');
    cy.wait(500); // Wait for tag to be processed
    cy.get('.full-page.ref .tag:not(.user)').contains('plugin/chat').should('exist');
  });

  it('shows call button in chatroom', () => {
    cy.get('.sidebar .button-bar').should('contain', 'call');
    cy.get('.submit-button').contains('call').should('be.visible');
  });

  it('starts a video call', () => {
    // Mock getUserMedia to avoid browser permission prompts
    // Using minimal mock to test basic call flow
    cy.window().then((win) => {
      cy.stub(win.navigator.mediaDevices, 'getUserMedia').resolves({
        getTracks: () => [],
        getVideoTracks: () => [],
        getAudioTracks: () => [],
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
    cy.intercept({pathname: '/api/v1/ref'}).as('submit');
    cy.get('button').contains('Submit').click();
    cy.wait('@submit');
    cy.get('.full-page.ref .link a').should('have.text', 'General Chat');

    // Add chat/general tag after creation
    cy.get('.actions *').contains('tag').click();
    cy.get('.inline-tagging input').type('chat/general{enter}');
    cy.wait(500); // Wait for tag to be processed
    cy.get('.full-page.ref .tag:not(.user)').contains('chat/general').should('exist');
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
    // Mock getUserMedia with a more realistic stream to test track handling
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
    // Set up intercepts before the actions
    cy.intercept({method: 'DELETE', pathname: '/api/v1/ref'}).as('delete1');

    cy.visit('/ref/e/internal:?debug=USER&search=Video+Chat+Room');
    cy.get('.ref-list-item.ref .actions *').contains('delete').click();
    cy.get('.ref-list-item.ref .actions *').contains('yes').click();

    // Wait for deletion to complete before navigating
    cy.wait('@delete1');

    cy.intercept({method: 'DELETE', pathname: '/api/v1/ref'}).as('delete2');
    cy.visit('/ref/e/internal:?debug=USER&search=General+Chat');
    cy.get('.ref-list-item.ref .actions *').contains('delete').click();
    cy.get('.ref-list-item.ref .actions *').contains('yes').click();
    cy.wait('@delete2');
  });
});
