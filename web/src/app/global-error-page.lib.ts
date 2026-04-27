import { isRouteErrorResponse } from 'react-router'

export function summarizeRouteError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string' && error.data !== ''
      ? `: ${error.data}`
      : ''
    return `${error.status} ${error.statusText}${detail}`
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error instanceof Response) {
    return `${error.status} ${error.statusText}`.trim()
  }

  if (error != null && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: unknown }).response
    if (response instanceof Response) {
      return `${response.status} ${response.statusText}`.trim()
    }
  }

  return String(error)
}
