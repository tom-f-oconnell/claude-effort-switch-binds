import { expect, test } from 'claude-code/testing'

import { stepLevel, stepModel } from '../hooks/register'

test('levels step within low..max, and models wrap round', async () => {
  expect(stepLevel('medium', -1)).toBe('low')
  expect(stepLevel('low', -1)).toBe('low')
  expect(stepLevel('xhigh', 1)).toBe('max')
  expect(stepLevel('max', 1)).toBe('max')
  expect(stepLevel(undefined, 1)).toBe('medium')
  const models = ['default', 'fable', 'opus', 'sonnet', 'haiku']
  expect(stepModel(models, 'claude-opus-5-5', 1)).toBe('sonnet')
  expect(stepModel(models, 'claude-opus-5-5', -1)).toBe('fable')
  expect(stepModel(models, 'claude-haiku-5-5', 1)).toBe('fable')
  expect(stepModel(models, 'claude-fable-5-2', -1)).toBe('haiku')
  expect(stepModel(models, 'something-else', 1)).toBe('fable')
  expect(stepModel(['default'], 'claude-opus-5-5', 1)).toBe(undefined)
})

// The engine stood in for: what each built-in command run asked, and the session's model and settings
function engine(on: Parameters<Parameters<typeof test>[1]>[1], ran: { command: string; args: string }[]) {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.after', () => ({ value: undefined }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('settings.read', () => ({ value: { claude: 1 } }))
  on('config.list', () => ({ value: [{ key: 'model', label: 'Model', kind: 'choice', value: 'opus', options: ['default', 'fable', 'opus', 'sonnet', 'haiku'] }] }))
  on('prompt.submit', (_, e) => {
    ran.push({ command: '(prompt)', args: e.text })
    return {}
  })
  on('command.run', (_, e) => {
    ran.push({ command: e.command, args: e.args })
    return { text: '' }
  })
}

test('a key runs the built-in command a person would type', async ($, on) => {
  const ran: { command: string; args: string }[] = []
  engine(on, ran)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'model-next' })
  await $.command.run({ command: 'model-prev' })
  await $.command.run({ command: 'effort-up' })
  await $.command.run({ command: 'effort-up' })
  await $.command.run({ command: 'effort-down' })
  const none = await $.command.run({ command: 'rerun-last' })
  await new Promise(r => setTimeout(r, 10))
  const builtins = ran.filter(r => ['model', 'effort', '(prompt)'].includes(r.command))
  expect(builtins).toEqual([
    { command: 'model', args: 'sonnet' }, { command: 'model', args: 'fable' },
    { command: 'effort', args: 'medium' }, { command: 'effort', args: 'high' }, { command: 'effort', args: 'medium' },
  ])
  expect(none.text).toBe('no prompt typed since this plugin loaded')
})
