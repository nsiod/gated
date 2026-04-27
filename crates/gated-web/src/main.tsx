import * as React from 'react'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import '@/styles/app.css'

async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import('@/mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/ui/mockServiceWorker.js' },
    })

    // UI-026: axe-core reports a11y violations to the dev console
    // without blocking the page. Never runs in production bundles —
    // the dynamic import + `import.meta.env.DEV` guard means the
    // payload is tree-shaken out of the prod build.
    const { default: axe } = await import('@axe-core/react')
    void axe(React, ReactDOM, 1000)
  }

  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
}

void bootstrap()
