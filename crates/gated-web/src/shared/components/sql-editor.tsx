import type { Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import Editor from '@monaco-editor/react'
import '@/features/gateway/lib/monaco-setup'

export type SqlEditorHandle = MonacoEditor.IStandaloneCodeEditor
export type SqlEditorMonaco = Monaco

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onMount: (editor: SqlEditorHandle, monaco: SqlEditorMonaco) => void
  theme: string
}

export default function SqlEditor({ value, onChange, onMount, theme }: SqlEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      value={value}
      onChange={(v) => { onChange(v ?? '') }}
      onMount={onMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  )
}
