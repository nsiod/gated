// Test-only i18n bootstrap. The production `@/app/i18n` uses
// `i18next-http-backend` to fetch JSON over the network, which jsdom
// can't serve — so unit tests wrap components in this stripped-down
// instance that returns keys verbatim.

import type { ReactNode } from 'react'
import i18n from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'

let initialized = false

function ensureInitialized(): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      lng: 'cimode', // returns the key as-is
      fallbackLng: 'cimode',
      ns: ['common', 'admin', 'gateway'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      resources: {},
    })
    initialized = true
  }
  return i18n
}

export function I18nTestProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={ensureInitialized()}>{children}</I18nextProvider>
}
