export function loadBoard() {
  cy.intercept({pathname: '/api/v1/ref/page'}).as('page');
  cy.visit('/tag/kanban%2ftest?debug=USER');
  cy.wait(new Array(3).fill('@page'));
}

export function addToBoard(col: number, text: string) {
  cy.intercept({method: 'POST', pathname: '/api/v1/ref'}).as('add');
  cy.get(`.kanban-column:nth-of-type(${col})`).first().find('input').focus().type(text + '{enter}', {force: true});
  cy.wait('@add');
}

export function dragCol(from: number, to?: number) {
  cy.wait(400);
  cy.get(`.kanban-column:nth-of-type(${from}) a`)
    .realMouseDown({ button: 'left', position: 'center' })
    .realMouseMove(0, 10, { position: 'center' });
  cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
  if (to) {
    cy.get(`.kanban-column:nth-of-type(${to})`)
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
  } else {
    cy.get('.kanban-remove').parent()
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
  }
  cy.wait('@tag');
}

describe('Kanban Template', () => {
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
    cy.get('#template-kanban').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a board', () => {
    cy.visit('/?debug=MOD');
    cy.contains('Create Tag Extension').click();
    cy.get('#tag').type('kanban/test');
    cy.get('#name').type('Kanban Test');
    cy.get('button').contains('Create').click();
    cy.get('#columns button').click().click();
    cy.get('#qtags-columns-0').type('doing');
    cy.get('#qtags-columns-1').type('done');
    cy.get('#showNoColumn').click();
    cy.get('#noColumnTitle').type('todo');
    cy.get('button').contains('Save').click();
    cy.get('h2').should('have.text', 'Kanban Test');
  });
  it('add to board', () => {
    loadBoard();
    addToBoard(1, 'first step');
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to doing', () => {
    loadBoard();
    dragCol(1, 2);
    cy.get('.kanban-column:nth-of-type(2) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to done', () => {
    loadBoard();
    dragCol(2, 3);
    cy.get('.kanban-column:nth-of-type(3) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to untagged col', () => {
    loadBoard();
    dragCol(3, 1);
    cy.get('.kanban-column:nth-of-type(1) a').contains('first step').click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/test').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to trash', () => {
    loadBoard();
    dragCol(1);
    cy.get('.kanban-column').contains('first step').should('not.exist');
  });
  it('deletes board', () => {
    cy.visit('/tag/kanban%2ftest/edit?debug=MOD');
    cy.get('button').contains('Delete').click();
    cy.contains('Not Found');
  });
});
