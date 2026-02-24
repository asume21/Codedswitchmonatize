import dotenv from "dotenv";
dotenv.config();
import Replicate from "replicate";

const token = process.env.REPLICATE_API_TOKEN;
console.log("Token present:", !!token);
console.log("Token prefix:", token?.substring(0, 8));

const replicate = new Replicate({ auth: token });

async function test() {
  try {
    console.log("Testing Replicate API connection...");
    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      {
        input: {
          prompt: "simple drum beat 120 bpm",
          duration: 5,
          model_version: "stereo-large",
          output_format: "wav",
        }
      }
    );
    console.log("SUCCESS! Output:", String(output).substring(0, 100));
  } catch (e: any) {
    console.log("FAILED:", e.message);
    if (e.response) {
      console.log("Status:", e.response.status);
      try {
        const body = await e.response.text();
        console.log("Response body:", body.substring(0, 500));
      } catch {}
    }
  }
}

test();
