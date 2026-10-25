/**
 * Worker bindings. The concrete shape lives in the generated
 * `worker-configuration.d.ts`; this re-export gives application and test code a
 * normal module to import instead of relying on the global `Env`.
 */
export type Env = Cloudflare.Env;
