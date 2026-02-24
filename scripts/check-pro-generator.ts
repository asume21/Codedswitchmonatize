// Quick check: does the ProAudioGenerator component have any import/compile errors?
import { execSync } from "child_process";

try {
  // Run TypeScript check on just the ProAudioGenerator file
  const result = execSync(
    'npx tsc --noEmit --jsx react-jsx --esModuleInterop --moduleResolution bundler --target es2020 --module esnext --strict false --skipLibCheck client/src/components/studio/ProAudioGenerator.tsx 2>&1',
    { cwd: 'D:\\Codedswitchmonatize', encoding: 'utf-8', timeout: 30000 }
  );
  console.log("TypeScript check passed:", result || "(no errors)");
} catch (e: any) {
  console.log("TypeScript errors found:");
  console.log(e.stdout || e.message);
}
