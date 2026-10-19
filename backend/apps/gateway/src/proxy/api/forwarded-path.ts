// The internal path for a request: the route's path with each `:param` filled in from the request,
// URL-encoded (so a param can't add path segments), plus a GET's query string, passed on as sent.
export function forwardedPath(
  routePath: string,
  params: Record<string, string>,
  method: string,
  originalUrl: string,
): string {
  const path = routePath.replace(/:(\w+)/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? ''),
  );
  const q = originalUrl.indexOf('?');
  return method === 'GET' && q >= 0 ? path + originalUrl.slice(q) : path;
}
