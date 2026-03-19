import { describe, expect, it } from 'vitest'
import { ModeClassifier } from '../computers/ModeClassifier'
import { OrganismMode }   from '../types'

function makeClassifier(): ModeClassifier {
  return new ModeClassifier(1, 0)
}

function feedFrames(
  classifier: ModeClassifier,
  rms: number,
  pitch: number,
  centroid: number,
  hnr: number,
  count = 5
): OrganismMode {
  let mode: OrganismMode = OrganismMode.Glow
  for (let i = 0; i < count; i += 1) {
    mode = classifier.process(rms, pitch, centroid, hnr)
  }
  return mode
}

describe('ModeClassifier', () => {
  it('classifies Heat for high RMS + high variance + high centroid + low HNR', () => {
    const classifier = new ModeClassifier(2, 0)
    let mode: OrganismMode = OrganismMode.Glow
    for (let i = 0; i < 10; i += 1) {
      const rms = i % 2 === 0 ? 0.9 : 0.35
      mode = classifier.process(rms, 300, 3000, 2)
    }
    expect(mode).toBe(OrganismMode.Heat)
  })

  it('classifies Ice for low RMS + low variance + wide pitch range + high HNR', () => {
    const classifier = new ModeClassifier(10, 0)
    for (let i = 0; i < 10; i += 1) {
      const pitch = i % 2 === 0 ? 200 : 400
      classifier.process(0.2, pitch, 2200, 12)
    }
    expect(classifier.getCurrentMode()).toBe(OrganismMode.Ice)
  })

  it('classifies Smoke for low RMS + low centroid + low variance', () => {
    const classifier = makeClassifier()
    const mode = feedFrames(classifier, 0.3, 200, 1500, 2)
    expect(mode).toBe(OrganismMode.Smoke)
  })

  it('classifies Gravel for mid RMS + low pitch range + low centroid + low HNR', () => {
    const classifier = makeClassifier()
    const mode = feedFrames(classifier, 0.5, 250, 1800, 2)
    expect(mode).toBe(OrganismMode.Gravel)
  })

  it('defaults to Glow for ambiguous/default signals', () => {
    const classifier = makeClassifier()
    const mode = feedFrames(classifier, 0.5, 300, 2200, 6)
    expect(mode).toBe(OrganismMode.Glow)
  })

  it('cannot change mode faster than hysteresisFrames', () => {
    const hysteresis = 5
    const classifier = new ModeClassifier(1, hysteresis)

    classifier.process(0.3, 200, 1500, 2)
    const modeAfterFirstFrame = classifier.getCurrentMode()
    expect(modeAfterFirstFrame).toBe(OrganismMode.Smoke)

    for (let i = 0; i < hysteresis - 1; i += 1) {
      classifier.process(0.9, 300, 3000, 2)
    }
    expect(classifier.getCurrentMode()).toBe(OrganismMode.Smoke)
  })
})
