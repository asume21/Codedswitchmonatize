import { describe, it, expect } from 'vitest'
import { buildAceStepInput, ACE_STEP_MODEL } from '../replicateService'

/**
 * ACE-Step has never run in production. REPLICATE_MODEL_VERSION was never set
 * because the code assumed a self-hosted cog build that was never pushed — and
 * even with a version set, the input names it sent (prompt/audio_duration/
 * infer_step/instrumental) do not exist on the public model, which wants
 * tags/duration/number_of_steps and `[inst]` in lyrics.
 */
describe('buildAceStepInput', () => {
  it('sends the prompt as `tags`, the field the model actually requires', () => {
    const input = buildAceStepInput({ prompt: 'dark trap, 808' })
    expect(input.tags).toBe('dark trap, 808')
    expect(input).not.toHaveProperty('prompt')
  })

  it('maps audioDuration to `duration`', () => {
    expect(buildAceStepInput({ prompt: 'x', audioDuration: 8 }).duration).toBe(8)
  })

  it('maps inferStep to `number_of_steps`', () => {
    expect(buildAceStepInput({ prompt: 'x', inferStep: 32 }).number_of_steps).toBe(32)
  })

  it('clamps duration to the model range of 1..240', () => {
    expect(buildAceStepInput({ prompt: 'x', audioDuration: 999 }).duration).toBe(240)
    expect(buildAceStepInput({ prompt: 'x', audioDuration: 0 }).duration).toBe(1)
  })

  it('clamps steps to the model range of 10..200', () => {
    expect(buildAceStepInput({ prompt: 'x', inferStep: 2 }).number_of_steps).toBe(10)
    expect(buildAceStepInput({ prompt: 'x', inferStep: 5000 }).number_of_steps).toBe(200)
  })

  it('uses -1 for a random seed, not null, which the model rejects', () => {
    expect(buildAceStepInput({ prompt: 'x' }).seed).toBe(-1)
    expect(buildAceStepInput({ prompt: 'x', seed: 4242 }).seed).toBe(4242)
  })

  it('forces instrumental via the [inst] lyrics token, not a nonexistent flag', () => {
    const input = buildAceStepInput({ prompt: 'x', instrumental: true })
    expect(input.lyrics).toBe('[inst]')
    expect(input).not.toHaveProperty('instrumental')
  })

  it('passes real lyrics through when they are supplied', () => {
    const input = buildAceStepInput({ prompt: 'x', lyrics: '[verse]\nhello' })
    expect(input.lyrics).toBe('[verse]\nhello')
  })

  it('drops fields the public model has no concept of', () => {
    const input = buildAceStepInput({ prompt: 'x', bpm: 90, taskType: 'text2music' })
    expect(input).not.toHaveProperty('bpm')
    expect(input).not.toHaveProperty('task_type')
    expect(input).not.toHaveProperty('audio_duration')
    expect(input).not.toHaveProperty('infer_step')
  })

  it('names a real, publicly hosted model', () => {
    expect(ACE_STEP_MODEL).toBe('lucataco/ace-step')
  })
})
