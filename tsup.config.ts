import { defineConfig } from 'tsup';

/** Bundles the socket server to a single JS file for the Fly image. */
export default defineConfig({
  entry: { server: 'socket/index.ts' },
  outDir: 'socket/dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // Both stay real dependencies the runtime image installs, for the same
  // reason from opposite directions: `pg` ships optional native bits that do
  // not survive bundling, and `ws` is CommonJS whose `require('events')`
  // becomes an unsupported dynamic require once inlined into an ESM bundle.
  external: ['pg', 'ws'],
});
