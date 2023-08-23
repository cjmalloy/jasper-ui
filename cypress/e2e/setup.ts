export function clearSetup() {
    cy.get('input[type=checkbox]').then(is => {
        if (is.filter(':checked').length) {
            cy.get('input[type=checkbox]').uncheck();
            cy.intercept({method: 'DELETE', pathname: '/api/v1/*'}).as('clear');
            cy.get('button').contains('Save').click();
            cy.wait('@clear');
            cy.wait(16);
        }
    });
}
