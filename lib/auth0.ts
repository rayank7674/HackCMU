import { Auth0Client } from "@auth0/nextjs-auth0/server";
import {
  AUTH0_CALLBACK_PATH,
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  AUTH0_ME_PATH,
  getAuth0Env,
  isAuth0Configured,
} from "@/lib/auth/env";

/**
 * Lazy Auth0 client. Never constructed during `next build` when env is
 * missing — v4 warns (and later request-time throws) without domain/secret.
 */
let cached: Auth0Client | undefined;

export function getAuth0Client(): Auth0Client | null {
  if (cached) return cached;
  const env = getAuth0Env();
  if (!env) return null;

  cached = new Auth0Client({
    domain: env.domain,
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    secret: env.secret,
    appBaseUrl: env.appBaseUrl,
    authorizationParameters: {
      scope: "openid profile email",
    },
    enableAccessTokenEndpoint: false,
    noContentProfileResponseWhenUnauthenticated: true,
    signInReturnToPath: "/plan",
    routes: {
      login: AUTH0_LOGIN_PATH,
      logout: AUTH0_LOGOUT_PATH,
      callback: AUTH0_CALLBACK_PATH,
      profile: AUTH0_ME_PATH,
    },
  });

  return cached;
}

export { isAuth0Configured };
