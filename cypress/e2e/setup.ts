export function clearMods(base = '') {
    cy.intercept({method: 'GET', pathname: '/api/v1/plugin/page'}).as('load');
    cy.visit(base + '/settings/plugin?debug=ADMIN&pageSize=2000');
    cy.wait('@load');
    cy.intercept({method: 'DELETE', pathname: '/api/v1/plugin'}).as('clearPlugin');
    cy.get('.list-container').then(l => {
        if (!l.find('.plugin').length) return;
        cy.get('.plugin').each(ps => {
            console.log(ps.length);
            cy.wrap(ps).find('a').contains('delete').click();
            cy.wrap(ps).find('a').contains('yes').click();
            cy.wait('@clearPlugin');
        });
    });
    cy.intercept({method: 'GET', pathname: '/api/v1/template/page'}).as('load');
    cy.visit(base + '/settings/template?debug=ADMIN&pageSize=2000');
    cy.wait('@load');
    cy.intercept({method: 'DELETE', pathname: '/api/v1/template'}).as('clearTemplate');
    cy.get('.list-container').then(l => {
        if (!l.find('.template').length) return;
        cy.get('.template').each(ts => {
            console.log(ts.length);
            cy.wrap(ts).find('a').contains('delete').click();
            cy.wrap(ts).find('a').contains('yes').click();
            cy.wait('@clearTemplate');
        });
    });
}