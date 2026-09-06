// Handles both this project's { error: { message } } shape and Nest's default HttpException shape
// ({ message }, a string or an array of validation failures) — Auth Service returns the latter.
export async function parseErrorMessage(response) {
  try {
    const body = await response.json();
    if (body?.error?.message) return body.error.message;
    if (Array.isArray(body?.message)) return body.message.join(' ');
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // response wasn't JSON — fall through to the generic message below
  }
  return `HTTP ${response.status}`;
}
