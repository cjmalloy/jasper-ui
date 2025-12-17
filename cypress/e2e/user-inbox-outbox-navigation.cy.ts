import { clearMods } from './setup';

describe('User Page: Inbox/Outbox Navigation', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=ADMIN');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });

  it('clear mods', () => {
    clearMods();
  });

  it('enable user and mailbox plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-user').should('not.be.checked').check().should('be.checked');
    cy.get('#mod-mailbox').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });

  it('displays inbox and outbox navigation buttons on user page', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.url().should('include', '/tag/user/alice');
    cy.get('.sidebar .tag-select').should('be.visible');
    cy.get('.sidebar .tag-select').contains('Inbox').should('be.visible');
    cy.get('.sidebar .tag-select').contains('Outbox').should('be.visible');
  });

  it('inbox button navigates to public user tag', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.get('.sidebar .tag-select').contains('Inbox').click();
    cy.url().should('include', '/tag/user/alice');
    cy.get('.sidebar .tag-select').contains('Inbox').parent().should('have.class', 'toggled');
  });

  it('outbox button navigates to protected user tag', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.get('.sidebar .tag-select').contains('Outbox').click();
    cy.url().should('include', '/tag/%2Buser/alice');
    cy.get('.sidebar .tag-select').contains('Outbox').parent().should('have.class', 'toggled');
  });

  it('inbox button is active when viewing public user tag', () => {
    cy.visit('/?debug=USER&tag=alice');
    cy.get('.sidebar .tag-select').contains('Inbox').parent().should('have.class', 'toggled');
    cy.get('.sidebar .tag-select').contains('Outbox').parent().should('not.have.class', 'toggled');
  });

  it('outbox button is active when viewing protected user tag', () => {
    cy.visit('/tag/%2Buser/alice?debug=USER');
    cy.get('.sidebar .tag-select').contains('Outbox').parent().should('have.class', 'toggled');
    cy.get('.sidebar .tag-select').contains('Inbox').parent().should('not.have.class', 'toggled');
  });

  it('navigation works for different user tags', () => {
    cy.visit('/?debug=USER&tag=bob');
    cy.url().should('include', '/tag/user/bob');
    cy.get('.sidebar .tag-select').contains('Inbox').should('be.visible');
    cy.get('.sidebar .tag-select').contains('Inbox').click();
    cy.url().should('include', '/tag/user/bob');
    cy.get('.sidebar .tag-select').contains('Outbox').click();
    cy.url().should('include', '/tag/%2Buser/bob');
  });
});
