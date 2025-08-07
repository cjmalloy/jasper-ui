import { addToBoard, dragCol } from './template-kanban';
import { clearMods, closeSidebar, openSidebar } from './setup';

export function loadBoard() {
  cy.intercept({pathname: '/api/v1/ref/page'}).as('page');
  cy.visit('/tag/kanban/test?debug=USER');
  cy.wait(new Array(3).fill('@page'));
}

describe('Kanban Template No Swimlanes', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Powered by Jasper', { timeout: 1000 * 60 });
  });
  it('clear mods', () => {
    clearMods();
  });
  it('turn on kanban', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings a').contains('settings').click();
    cy.get('.tabs').contains('setup').click();

    cy.wait(100);
    cy.get('#mod-root').should('not.be.checked').check().should('be.checked');
    cy.get('#mod-kanban').should('not.be.checked').check().should('be.checked');
    cy.get('button').contains('Save').click();
    cy.get('.log').contains('Success');
  });
  it('creates a board', () => {
    cy.visit('/?debug=MOD');
    cy.get('.subs').contains('tags').click();
    openSidebar();
    cy.contains('Extend').click();
    cy.get('[name=tag]').type('kanban/test');
    cy.get('button').contains('Extend').click();
    cy.get('[name=name]').type('Kanban Test');
    cy.get('.columns button').click()
        .type('doing{enter}')
        .type('done');
    cy.get('[name=showColumnBacklog]').click();
    cy.get('[name=columnBacklogTitle]').type('todo');
    cy.get('button').contains('Save').click();
    cy.get('h2').should('have.text', 'Kanban Test');
  });
  it('add to board', () => {
    closeSidebar();
    loadBoard();
    cy.wait(1000);
    addToBoard(1, 'first step');
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to doing', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to done', () => {
    loadBoard();
    dragCol(2, 3);
    cy.get('.kanban-column:nth-of-type(3) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to untagged col', () => {
    loadBoard();
    dragCol(3, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to trash', () => {
    loadBoard();
    dragCol(1);
    cy.get('.kanban-column').contains('first step').should('not.exist');
  });
  it('deletes board', () => {
    cy.visit('/ext/kanban/test?debug=MOD');
    cy.get('button').contains('Delete').click();
  });
});
