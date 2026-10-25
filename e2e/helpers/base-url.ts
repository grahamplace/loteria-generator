/** The dev server Playwright starts. Override with E2E_PORT when 3006 is taken. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3006);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
