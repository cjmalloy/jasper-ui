import { addToBoard, dragCol } from './template-kanban';

export function loadBoard() {
  cy.intercept({pathname: '/api/v1/ref/page'}).as('page');
  cy.visit('/tag/kanban%2fsl?debug=USER');
  cy.wait(new Array(9).fill('@page'), { timeout: 30_000 });
}

describe('Kanban Template with Swim Lanes', {
  testIsolation: false
}, () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 1000 * 60 });
  });
  it('clear plugins', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('button').contains('Save').click();
  });
  it('turn on kanban', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('input[type=checkbox]').uncheck();
    cy.get('#mod-kanban').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a board with swim lanes', () => {
    cy.visit('/?debug=MOD');
    cy.contains('Edit').click();
    cy.get('#tag').type('kanban/sl');
    cy.get('button').contains('Extend').click();
    cy.get('#name').type('Kanban Test');
    cy.get('#columns button').click().click();
    cy.get('#qtags-columns-0').type('doing');
    cy.get('#qtags-columns-1').type('done');
    cy.get('#showNoColumn').click();
    cy.get('#noColumnTitle').type('todo');
    cy.get('#swimLanes button').click().click();
    cy.get('#qtags-swimLanes-0').type('alice');
    cy.get('#qtags-swimLanes-1').type('bob');
    cy.get('#showNoSwimLane').click();
    cy.get('button').contains('Save').click();
    cy.get('h2').should('have.text', 'Kanban Test');
  });
  it('add to board', () => {
    loadBoard();
    addToBoard(7, 'first step');
    cy.get('.kanban-column:nth-of-type(7) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to doing', () => {
    loadBoard();
    dragCol(7, 8);
    cy.get('.kanban-column:nth-of-type(8) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to done', () => {
    loadBoard();
    dragCol(8, 9);
    cy.get('.kanban-column:nth-of-type(9) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to untagged col', () => {
    loadBoard();
    dragCol(9, 7);
    cy.get('.kanban-column:nth-of-type(7) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to alice', () => {
    loadBoard();
    dragCol(7, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice done', () => {
    loadBoard();
    dragCol(2, 3);
    cy.get('.kanban-column:nth-of-type(3) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to alice todo', () => {
    loadBoard();
    dragCol(3, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing again', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to bob', () => {
    loadBoard();
    dragCol(2, 4);
    cy.get('.kanban-column:nth-of-type(4) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob doing', () => {
    loadBoard();
    dragCol(4, 5);
    cy.get('.kanban-column:nth-of-type(5) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob done', () => {
    loadBoard();
    dragCol(5, 6);
    cy.get('.kanban-column:nth-of-type(6) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
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
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
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
    cy.visit('/ext/kanban%2fsl?debug=MOD');
    cy.get('button').contains('Delete').click();
    cy.contains('Not Found');
  });
});
