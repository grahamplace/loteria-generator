/**
 * Defers construction of a service client until something actually touches it.
 *
 * Clients like Neon and Stripe throw from their constructor when their secret is
 * missing. Built at module scope, that turns a missing environment variable into
 * a *build* failure: `next build` evaluates every route module while collecting
 * page data, so a single unset secret fails the whole build with a stack trace
 * pointing at a bundled chunk rather than at the call site.
 *
 * Wrapping the client here keeps `import { db } from '@/db'` working unchanged
 * while moving the failure to the first real query, where the error names the
 * variable and the operation that needed it.
 */
export function lazyClient<T extends object>(create: () => T): T {
  let instance: T | undefined;
  const resolve = (): T => (instance ??= create());

  // The proxy target is an empty object: the real client is never constructed
  // until a trap fires. Traps forward to the resolved instance, and methods are
  // bound to it so `this` is the client rather than the proxy.
  return new Proxy({} as T, {
    get(_target, property) {
      const client = resolve();
      const value = Reflect.get(client, property, client);
      return typeof value === 'function' ? value.bind(client) : value;
    },
    set(_target, property, value) {
      const client = resolve();
      return Reflect.set(client, property, value, client);
    },
    has(_target, property) {
      return Reflect.has(resolve(), property);
    },
    ownKeys() {
      return Reflect.ownKeys(resolve());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), property);
      // A proxy may only report a property as non-configurable if the target
      // actually has it, and the target here is always empty. Forcing
      // `configurable` keeps Object.keys()/spread from throwing a TypeError.
      return descriptor && { ...descriptor, configurable: true };
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve());
    },
  });
}

/**
 * Reads a required environment variable, failing with a message that names the
 * variable and what needed it.
 */
export function requireEnv(name: string, usedBy: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — required by ${usedBy}.`);
  }
  return value;
}
