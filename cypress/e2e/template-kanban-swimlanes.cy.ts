describe('Kanban Template with Swim Lanes', () => {
  it('loads the page', () => {
    cy.visit('/?debug=USER');
    cy.contains('Home', { timeout: 30000 });
  });
  it('turn on kanban', () => {
    cy.visit('/?debug=ADMIN');
    cy.get('.settings').contains('settings').click();
    cy.get('.tabs').contains('setup').click();
    cy.get('#template-kanban').check();
    cy.get('button').contains('Save').click();
  });
  it('creates a board with swim lanes', () => {
    cy.visit('/?debug=MOD');
    cy.contains('Create Tag Extension').click();
    cy.get('#tag').type('kanban/sl');
    cy.get('#name').type('Kanban Test');
    cy.get('button').contains('Create').click();
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
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.get('.kanban-column:nth-of-type(7)').first().find('input').focus().type("first step{enter}", {force: true});
    cy.get('.kanban-column a').contains("first step").click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to doing', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(7) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(8)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(8) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to done', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(8) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(9)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(9) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to untagged col', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(9) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(7)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(7) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to alice', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(7) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(2)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(2) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice done', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(2) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(3)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(3) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to alice todo', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(3) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to alice doing again', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(2)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(2) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('assign to bob', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(2) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(4)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(4) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob doing', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(4) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(5)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(5) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to bob done', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(5) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-column:nth-of-type(6)' )
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.get('.kanban-column:nth-of-type(6) a').contains("first step").click({force: true});
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'alice');
    cy.get('.full-page.ref .tag:not(.user)').contains('bob').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'doing');
    cy.get('.full-page.ref .tag:not(.user)').contains('done').should('exist');
  });
  it('move to trash', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column:nth-of-type(6) a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-remove' ).parent()
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.reload();
    cy.get('.kanban-column').contains("first step").should('not.exist');
  });
  it('add to alice doing', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.get('.kanban-column:nth-of-type(2)').first().find('input').focus().type("first step{enter}", {force: true});
    cy.get('.kanban-column a').contains("first step").click();
    cy.get('.full-page.ref .tag:not(.user)').contains('kanban/sl').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').contains('alice').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'bob');
    cy.get('.full-page.ref .tag:not(.user)').contains('doing').should('exist');
    cy.get('.full-page.ref .tag:not(.user)').should('not.include.text', 'done');
  });
  it('move to trash', () => {
    cy.visit('/tag/kanban%2fsl?debug=USER');
    cy.intercept({method: 'PATCH', pathname: '/api/v1/tags'}).as('tag');
    cy.get('.kanban-column a')
      .realMouseDown({ button: 'left', position: 'center' })
      .realMouseMove(0, 10, { position: 'center' });
    cy.get('.kanban-remove' ).parent()
      .realMouseMove(30, 30, { position: 'topLeft' })
      .realMouseUp();
    cy.wait('@tag');
    cy.reload();
    cy.get('.kanban-column').contains("first step").should('not.exist');
  });
  it('deletes board', () => {
    cy.visit('/tag/kanban%2fsl?debug=MOD');
    cy.get('.sidebar-link').contains('edit').click();
    cy.get('button').contains('Delete').click();
    cy.contains('Not Found');
  });
});
