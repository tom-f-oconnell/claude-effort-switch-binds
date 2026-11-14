import type { EngineInterface, Register } from 'claude-code'

// Slash commands meant to be bound to keys (~/.claude/keybindings.json, "command:<name>" in a Chat block): the effort
// level a step down or up, the model before or after this one in /model's list, and the last prompt sent again. Each
// runs the built-in command a person would type (/effort <level>, /model <name>), so the session, its status line and
// its saved default change as they do then.

export const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Level = (typeof LEVELS)[number]

const COMMANDS = {
  'effort-down': 'Effort level a step lower (low, medium, high, xhigh, max)',
  'effort-up': 'Effort level a step higher (low, medium, high, xhigh, max)',
  'model-prev': "The model before this one in /model's list",
  'model-next': "The model after this one in /model's list",
  'rerun-last': 'Send the last prompt you typed again, with the model and effort as they are now',
} as const

/** The level `by` steps from `now`, held at the ends; from an unknown level, medium. */
export function stepLevel(now: string | undefined, by: number): Level {
  const i = LEVELS.indexOf(now as Level)
  if (i < 0) return 'medium'
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i + by))] ?? 'medium'
}

/** The model `by` steps from `now` in `options` (wrapping round), matched by alias or by family in a full id. */
export function stepModel(options: readonly string[], now: string, by: number): string | undefined {
  const names = options.filter(o => o !== 'default')
  if (!names.length) return undefined
  const id = now.toLowerCase()
  const i = names.findIndex(o => id === o.toLowerCase() || id.includes(o.toLowerCase()))
  if (i < 0) return names[by > 0 ? 0 : names.length - 1]
  return names[(i + by + names.length) % names.length]
}

// What the module knows between keys: the main loop's last effort, and the last prompt typed (both start over on a
// reload, when they're read again from the settings or wait for the next prompt)
let effort: string | undefined
let lastPrompt: string | undefined

async function currentEffort($: EngineInterface): Promise<string | undefined> {
  if (effort) return effort
  const model = await $.session.model()
  const per = (await $.settings.read({ key: 'modelSettings' })) as Record<string, { effortLevel?: string }> | undefined
  const own = per && Object.entries(per).find(([id]) => model.includes(id) || id.includes(model))?.[1]?.effortLevel
  return own ?? ((await $.settings.read({ key: 'effortLevel' })) as string | undefined)
}

async function modelOptions($: EngineInterface): Promise<readonly string[]> {
  const row = (await $.config.list()).find(r => r.key === 'model')
  return row?.options?.length ? row.options : ['fable', 'opus', 'sonnet', 'haiku']
}

// A command.run hook can't run another command itself (it would wait on the turn the hook holds): it answers at once
// and runs the built-in a moment later, on a timer of its own
function later($: EngineInterface, run: () => Promise<unknown>): void {
  void $.clock.after(1, () => {
    void run().catch(e => $.ui.toast(`effort-switch-binds: ${e instanceof Error ? e.message : String(e)}`))
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const [name, description] of Object.entries(COMMANDS)) {
      await $.command.register({ name, description, immediate: true })
    }
    return next(e)
  })

  // the effort the main loop really sends, so a step starts from it
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && typeof e.effort === 'string') effort = e.effort
    return yield* next(e)
  })

  // the last prompt typed at the prompt, not a slash command
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer' && !e.command && e.text.trim()) lastPrompt = e.text
    return next(e)
  })

  for (const [name, by] of [['effort-down', -1], ['effort-up', 1]] as const) {
    on('command.run', { command: name }, async $ => {
      const to = stepLevel(await currentEffort($), by)
      effort = to
      later($, () => $.command.run({ command: 'effort', args: to }))
      return { text: `effort: ${to}` }
    })
  }

  for (const [name, by] of [['model-prev', -1], ['model-next', 1]] as const) {
    on('command.run', { command: name }, async $ => {
      const to = stepModel(await modelOptions($), await $.session.model(), by)
      if (!to) return { text: 'no models to switch between' }
      effort = undefined     // each model keeps its own effort level: read it again
      later($, () => $.command.run({ command: 'model', args: to }))
      return { text: `model: ${to}` }
    })
  }

  on('command.run', { command: 'rerun-last' }, async $ => {
    if (!lastPrompt) return { text: 'no prompt typed since this plugin loaded' }
    const text = lastPrompt
    later($, () => $.prompt.submit({ text, asUser: true }))
    return { text: 'sending the last prompt again' }
  })
}
