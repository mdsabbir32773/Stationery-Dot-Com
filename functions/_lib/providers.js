// Payment provider adapters. EMPTY ON PURPOSE: no provider has been chosen and no merchant credentials exist yet.
// To connect a provider (after merchant onboarding), add one file and register it here:
//   adapters.PROVIDERNAME = { async verify(rawBody, headers, env) { ...check the provider's signature / call its verify API...
//     return { orderCode, eventId, providerRef, amount, paid } }  // must THROW if the signature/verification fails
//   };
// Use only secrets from `env` (Cloudflare encrypted variables). Never put secrets in src/ or VITE_ variables.
export const adapters={};
