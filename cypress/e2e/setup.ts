export function clearMods(base = '') {
  cy.intercept({method: 'GET', pathname: '/api/v1/plugin/page'}).as('load');
  cy.visit(base + '/settings/plugin?debug=ADMIN&pageSize=2000');
  cy.wait('@load');
  cy.intercept({method: 'DELETE', pathname: '/api/v1/plugin'}).as('clearPlugin');
  cy.get('.list-container').then(l => {
    if (!l.find('.plugin').length) return;
    cy.get('.plugin').each(ps => {
      cy.wrap(ps).find('.action').contains('delete').click();
      cy.wrap(ps).find('.action').contains('yes').click();
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
      if (ts.find('.host').text().startsWith('(_config/')) return;
      cy.wrap(ts).find('.action').contains('delete').click();
      cy.wrap(ts).find('.action').contains('yes').click();
      cy.wait('@clearTemplate');
    });
  });
}

export function openSidebar() {
  cy.get('.sidebar').then($sidebar => {
    if (!$sidebar.hasClass('expanded')) {
      cy.get('.sidebar:not(.expanded) .row .toggle').click();
    }
  });
}

export function closeSidebar() {
  cy.get('.sidebar').then($sidebar => {
    if ($sidebar.hasClass('expanded')) {
      cy.get('.sidebar.expanded .row .toggle').click();
    }
  });
}

const REPLICATION_WAIT_MS = 3000; // Time to wait between replication checks

export function waitForNotification(url: string, maxAttempts = 5): Cypress.Chainable<void> {
  // Wait for remote replication and reload until notification appears
  // Notifications are checked only when page loads, so we need to reload
  const checkForNotification = (attemptsLeft: number): Cypress.Chainable<void> | void => {
    if (attemptsLeft <= 0) {
      cy.log('Max attempts reached, notification should be visible now');
      return;
    }
    
    return cy.get('body').then($body => {
      if ($body.find('.settings .notification').length === 0) {
        cy.log(`Notification not found, ${attemptsLeft} attempts remaining. Reloading...`);
        cy.wait(REPLICATION_WAIT_MS);
        cy.reload();
        return cy.then(() => checkForNotification(attemptsLeft - 1));
      }
    });
  };
  
  cy.visit(url);
  return checkForNotification(maxAttempts) as Cypress.Chainable<void>;
}
