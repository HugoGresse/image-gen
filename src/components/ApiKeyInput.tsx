import { useState } from 'react'
import { saveApiKey } from '../lib/storage'

interface ApiKeyInputProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function ApiKeyInput({ apiKey, onApiKeyChange }: ApiKeyInputProps) {
  const [editing, setEditing] = useState(!apiKey)
  const [value, setValue] = useState(apiKey)

  function handleSave() {
    saveApiKey(value)
    onApiKeyChange(value)
    setEditing(false)
  }

  function handleReset() {
    setValue('')
    setEditing(true)
  }

  if (!editing && apiKey) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">
          API Key: <span className="font-mono text-zinc-300">{apiKey.slice(0, 8)}••••••••</span>
        </span>
        <button
          onClick={handleReset}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="sk-or-v1-..."
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 w-72"
      />
      <button
        onClick={handleSave}
        disabled={!value.trim()}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        Save Key
      </button>
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-zinc-500 hover:text-violet-400 transition-colors"
      >
        Get a key →
      </a>
    </div>
  )
}
