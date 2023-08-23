
export function addToBoard(col: number, text: string) {
  cy.intercept({method: 'POST', pathname: '/api/v1/ref'}).as('add');
  cy.get(`.kanban-column:nth-of-type(${col})`).first().find('input').focus().type(text + '{enter}', {force: true});
  cy.wait('@add');
}

export function dragCol(from: number, to?: number) {
  cy.get(`.kanban-column:nth-of-type(${from}) a`, { timeout: 5_000 }).should('be.visible');
  cy.wait(16);
  cy.get(`.kanban-column:nth-of-type(${from}) a`)
    .realMouseDown({ button: 'left', position: 'center' })
    .realMouseMove(0, 0, { position: 'center' })
    .realMouseMove(0, 10, { position: 'center' });
  cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
  if (to) {
    cy.get(`.kanban-column:nth-of-type(${to})`)
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
  } else {
    cy.get('.kanban-remove').parent()
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseMove(30, 30, { position: 'topLeft' })
      .wait(1000)
      .realMouseUp();
  }
  cy.wait('@tag');
}
