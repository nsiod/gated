// Extracts the user-facing error text from a failed SQL Console query.
// Handles three shapes the gateway client can surface:
//
// 1. Fetch errors the generated client wraps as `{ response: Response }`
//    with a JSON body `{ "error": "..." }` — preferred path.
// 2. Fetch errors with a non-JSON body — we still return the raw text.
// 3. Anything else (Error, plain value) — fall through to `String(err)`.

export async function errorMessage(err: unknown): Promise<string> {
  if (err instanceof Error && 'response' in err) {
    const resp = (err as { response?: Response }).response
    if (resp != null) {
      try {
        const body = await resp.clone().text()
        try {
          const parsed = JSON.parse(body) as { error?: string }
          if (parsed.error != null)
            return parsed.error
        }
        catch { /* not json */ }
        if (body !== '')
          return body
      }
      catch { /* ignore */ }
      return `HTTP ${resp.status}`
    }
  }
  if (err instanceof Error)
    return err.message
  return String(err)
}
