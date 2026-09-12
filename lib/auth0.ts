import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextRequest } from "next/server";
import {
  AUTH0_CALLBACK_PATH,
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  AUTH0_ME_PATH,
  getAuth0Env,
  isAbsoluteHttpUrl,
  isAuth0Configured,
  readAppBaseUrl,
  toAbsoluteReturnTo,
  type Auth0Env,
} from "@/lib/auth/env";

/**
 * Lazy Auth0 client. Never constructed during `next build` when env is
 * missing - v4 warns (and later request-time throws) without domain/secret.
 */
let cached: Auth0Client | undefined;

export function auth0ClientOptions(env: Auth0Env) {
  return {
    domain: env.domain,
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    secret: env.secret,
    // Only pass appBaseUrl when AUTH0_BASE_URL / APP_BASE_URL is set.
    // Passing `undefined` can hide the SDK's own APP_BASE_URL fallback.
    ...(env.appBaseUrl ? { appBaseUrl: env.appBaseUrl } : {}),
    authorizationParameters: {
      scope: "openid profile email",
    },
    enableAccessTokenEndpoint: false,
    noContentProfileResponseWhenUnauthenticated: true,
    signInReturnToPath: "/home",
    routes: {
      login: AUTH0_LOGIN_PATH,
      logout: AUTH0_LOGOUT_PATH,
      callback: AUTH0_CALLBACK_PATH,
      profile: AUTH0_ME_PATH,
    },
  };
}

export function getAuth0Client(): Auth0Client | null {
  if (cached) return cached;
  const env = getAuth0Env();
  if (!env) return null;

  cached = new Auth0Client(auth0ClientOptions(env));

  return cached;
}

/**
 * Auth0 v4 `handleLogout` sends `returnTo` as `post_logout_redirect_uri`
 * unchanged. A relative `/` becomes Auth0 `invalid_request`.
 *
 * When a base URL is configured, rewrite to an absolute URL under it.
 * When it is not, drop a relative `returnTo` so the SDK builds one from
 * `appBaseUrl` / the request host.
 */
export function withAbsoluteLogoutReturnTo(request: NextRequest): NextRequest {
  if (request.nextUrl.pathname !== AUTH0_LOGOUT_PATH) {
    return request;
  }

  const current = request.nextUrl.searchParams.get("returnTo");
  const appBaseUrl = getAuth0Env()?.appBaseUrl ?? readAppBaseUrl();

  if (appBaseUrl) {
    const absolute = toAbsoluteReturnTo(current, appBaseUrl, "/");
    if (current === absolute) return request;
    const url = request.nextUrl.clone();
    url.searchParams.set("returnTo", absolute);
    return new NextRequest(url, request);
  }

  if (current && !isAbsoluteHttpUrl(current)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("returnTo");
    return new NextRequest(url, request);
  }

  return request;
}

export async function handleAuth0Middleware(request: Request) {
  const client = getAuth0Client();
  if (!client) return null;
  const nextRequest =
    request instanceof NextRequest
      ? request
      : new NextRequest(request.url, request);
  return client.middleware(withAbsoluteLogoutReturnTo(nextRequest));
}

export { isAuth0Configured };
