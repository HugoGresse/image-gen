import { useCallback, useEffect, useRef, useState } from 'react'
import { useImageModels } from '../models/modelsContext'
import { useWorkspace } from '../workspace/workspaceContext'
import { isRouterModel, modelIdProblem } from './catalogue'
import type { ChatModel } from './catalogue'
import { closeDanglingToolCalls, loadConversation, saveConversation } from './conversation'
import { sendChat } from './openrouterChat'
import type { ChatMessage } from './openrouterChat'
import { SYSTEM_PROMPT, TOOL_DEFINITIONS } from './toolDefinitions'
import { executeTool } from './toolRunner'
import type { ConfirmRequest } from './toolRunner'

const MAX_STEPS = 12

export interface PendingConfirm extends ConfirmRequest {
  resolve: (approved: boolean) => void
}

interface UseChatOptions {
  apiKey: string
  model: string
  catalogue: ChatModel[]
  onSpend: () => void
}

export function useChat({ apiKey, model, catalogue, onSpend }: UseChatOptions) {
  const { actions } = useWorkspace()
  const { models: imageModels } = useImageModels()
  const [messages, setMessages] = useState<ChatMessage[]>(loadConversation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spent, setSpent] = useState(0)
  const [servedBy, setServedBy] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runRef = useRef(0)
  const runningRef = useRef(false)
  const live = useRef({ imageModels, onSpend })

  useEffect(() => {
    live.current = { imageModels, onSpend }
  })

  useEffect(() => {
    if (!busy) saveConversation(messages)
  }, [messages, busy])

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      const signal = abortRef.current?.signal
      if (signal?.aborted) return resolve(false)
      const settle = (approved: boolean) => {
        setPending(null)
        resolve(approved)
      }
      signal?.addEventListener('abort', () => settle(false), { once: true })
      setPending({ ...request, resolve: settle })
    })
  }, [])

  const send = useCallback(
    async (text: string, history: ChatMessage[]) => {
      const content = text.trim()
      if (!content || runningRef.current) return
      const problem = modelIdProblem(model, catalogue)
      if (!apiKey || problem) {
        setError(apiKey ? problem : 'Enter your OpenRouter API key first.')
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      const run = ++runRef.current
      runningRef.current = true
      const publish = (next: ChatMessage[]) => {
        if (run === runRef.current) setMessages(next)
      }
      setBusy(true)
      setError(null)

      let conversation: ChatMessage[] = [...history, { role: 'user', content }]
      publish(conversation)
      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const reply = await sendChat(
            apiKey,
            { model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversation], tools: TOOL_DEFINITIONS },
            controller.signal
          )
          if (reply.cost !== null) setSpent((total) => total + (reply.cost ?? 0))
          setServedBy(isRouterModel(model, catalogue) ? reply.servedModel : null)
          conversation = [...conversation, reply.message]
          publish(conversation)
          const calls = reply.message.tool_calls ?? []
          if (calls.length === 0) break

          const ctx = { actions, imageModels: live.current.imageModels, confirm }
          for (const call of calls) {
            if (controller.signal.aborted) break
            const result = await executeTool(call.function.name, call.function.arguments, ctx)
            conversation = [...conversation, { role: 'tool', tool_call_id: call.id, content: result }]
            publish(conversation)
          }
          if (controller.signal.aborted) break
          if (step === MAX_STEPS - 1) {
            setError(`Stopped after ${MAX_STEPS} steps. Send "continue" to let the assistant carry on.`)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The assistant failed.')
      } finally {
        if (run === runRef.current) {
          runningRef.current = false
          setMessages(closeDanglingToolCalls(conversation, controller.signal.aborted ? 'Stopped by the user' : 'Not run'))
          setBusy(false)
          abortRef.current = null
        }
        live.current.onSpend()
      }
    },
    [actions, apiKey, catalogue, confirm, model]
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    runRef.current += 1
    runningRef.current = false
    setBusy(false)
    setMessages([])
    setError(null)
    setSpent(0)
    setServedBy(null)
  }, [])

  return { messages, busy, error, spent, servedBy, pending, send: (text: string) => send(text, messages), stop, reset }
}
