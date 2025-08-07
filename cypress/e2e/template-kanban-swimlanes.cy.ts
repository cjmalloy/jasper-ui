import { addToBoard, dragCol } from './template-kanban';
import { clearMods, closeSidebar, openSidebar } from './setup';

export function loadBoard() {
  cy.intercept({pathname: '/api/v1/ref/page'}).as('page');
  cy.visit('/tag/kanban/sl?debug=USER');
  cy.wait(new Array(9).fill('@page'), { timeout: 30_000 });
}

describe('Kanban Template with Swim Lanes', {
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
  it('creates a board with swim lanes', () => {
    cy.visit('/?debug=MOD');
    cy.get('.subs').contains('tags').click();
    openSidebar();
    cy.contains('Extend').click();
    cy.get('[name=tag]').type('kanban/sl');
    cy.get('button').contains('Extend').click();
    cy.get('[name=name]').type('Kanban Swim Lane Test');
    cy.get('.columns button').click()
        .type('doing{enter}')
        .type('done');
    cy.get('[name=showColumnBacklog]').click();
    cy.get('[name=columnBacklogTitle]').type('todo');
    cy.get('.swim-lanes button').click()
        .type('alice{enter}')
        .type('bob');
    cy.get('[name=showSwimLaneBacklog]').click();
    cy.get('button').contains('Save').click();
    cy.get('h2').should('have.text', 'Kanban Swim Lane Test');
  });
  it('add to board', () => {
    closeSidebar();
    loadBoard();
    cy.wait(1000);
    addToBoard(7, 'first step');
    cy.get('.kanban-column:nth-of-type(7) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to doing', () => {
    loadBoard();
    dragCol(7, 8);
    cy.get('.kanban-column:nth-of-type(8) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to done', () => {
    loadBoard();
    dragCol(8, 9);
    cy.get('.kanban-column:nth-of-type(9) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to untagged col', () => {
    loadBoard();
    dragCol(9, 7);
    cy.get('.kanban-column:nth-of-type(7) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to alice', () => {
    loadBoard();
    dragCol(7, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice done', () => {
    loadBoard();
    dragCol(2, 3);
    cy.get('.kanban-column:nth-of-type(3) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to alice todo', () => {
    loadBoard();
    dragCol(3, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing again', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to bob', () => {
    loadBoard();
    dragCol(2, 4);
    cy.get('.kanban-column:nth-of-type(4) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob doing', () => {
    loadBoard();
    dragCol(4, 5);
    cy.get('.kanban-column:nth-of-type(5) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob done', () => {
    loadBoard();
    dragCol(5, 6);
    cy.get('.kanban-column:nth-of-type(6) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to trash', () => {
    loadBoard();
    dragCol(6);
    loadBoard();
    cy.get('.kanban-column').contains('first step').should('not.exist');
  });
  it('add to alice doing', () => {
    loadBoard();
    addToBoard(2, 'second step');
    cy.get('.kanban-column:nth-of-type(2) a').contains('second step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('Kanban Swim Lane Test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to trash again', () => {
    loadBoard();
    dragCol(2);
    cy.reload();
    cy.get('.kanban-column').contains('second step').should('not.exist');
  });
  it('deletes board', () => {
    cy.visit('/ext/kanban/sl?debug=MOD');
    cy.get('button').contains('Delete').click();
  });
});
