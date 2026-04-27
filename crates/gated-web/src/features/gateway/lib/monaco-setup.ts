// Bundle Monaco locally so `<Editor />` doesn't fetch from CDN.

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

interface MonacoGlobal {
  MonacoEnvironment?: {
    getWorker: (workerId: string, label: string) => Worker
  }
}

const g = globalThis as unknown as MonacoGlobal
g.MonacoEnvironment ??= {
  getWorker() {
    return new EditorWorker()
  },
}

loader.config({ monaco })
