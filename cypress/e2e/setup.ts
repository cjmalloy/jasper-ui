export function clearMods() {
    cy.intercept({method: 'GET', pathname: '/api/v1/plugin/page'}).as('load');
    cy.visit('/settings/plugin?debug=ADMIN&pageSize=2000');
    cy.wait('@load');
    cy.wait(1000);
    cy.get('.list-container').then(l => {
        if (!l.find('.plugin').length) return;
        cy.get('.plugin').each(ps => {
            console.log(ps.length);
            cy.wrap(ps).find('a').contains('delete').click();
            cy.intercept({method: 'DELETE', pathname: '/api/v1/plugin'}).as('clear');
            cy.wrap(ps).find('a').contains('yes').click();
            cy.wait('@clear');
        });
    });
    cy.intercept({method: 'GET', pathname: '/api/v1/template/page'}).as('load');
    cy.visit('/settings/template?debug=ADMIN&pageSize=2000');
    cy.wait('@load');
    cy.wait(1000);
    cy.get('.list-container').then(l => {
        if (!l.find('.template').length) return;
        cy.get('.template').each(ts => {
            console.log(ts.length);
            cy.wrap(ts).find('a').contains('delete').click();
            cy.intercept({method: 'DELETE', pathname: '/api/v1/template'}).as('clear');
            cy.wrap(ts).find('a').contains('yes').click();
            cy.wait('@clear');
        });
    });
}
