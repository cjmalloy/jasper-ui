/// <reference types="vitest/globals" />

/**
 * This is a deliberately failing test to verify that test failures
 * are properly propagated to the CI/CD pipeline.
 * 
 * This test should be removed or fixed after verifying the Dockerfile
 * changes correctly fail the GitHub Actions check when tests fail.
 */
describe('Test Failure Verification', () => {
  it('should fail to verify CI detects test failures', () => {
    // This test intentionally fails to verify our Dockerfile changes
    // properly propagate test failures to GitHub Actions
    expect(true).toBe(false);
  });
});
