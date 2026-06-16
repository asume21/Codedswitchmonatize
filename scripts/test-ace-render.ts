/**
 * Step-0 proof for the ACE-Step pipeline: submit a cheap render against the
 * configured backend (RunPod serverless when RUNPOD_SERVERLESS_ENDPOINT_ID is
 * set) and wait for a playable file. On a no-audio completion the serverless
 * service logs the response-key banner we need to extend resolveAudio.
 *
 * Run:  npx tsx scripts/test-ace-render.ts
 */
import 'dotenv/config'
import { generateAndWait } from '../server/services/aceStepService'

async function main() {
  const t0 = Date.now()
  console.log('[test-ace-render] submitting 10s / 20-step render...')
  const job = await generateAndWait({
    prompt: 'boom bap, hip-hop, jazz samples, kick snare, 90 bpm, instrumental, high fidelity',
    audioDuration: 10,
    inferStep: 20,
  })
  console.log('[test-ace-render] job result:')
  console.log(JSON.stringify(job, null, 2))
  console.log(`[test-ace-render] elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  if (!job.outputPath && !job.outputUrl) {
    console.error('[test-ace-render] FAIL: completed without audio')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[test-ace-render] FAIL:', err)
  process.exitCode = 1
})
