import dotenv from "dotenv";
dotenv.config();

console.log("REPLICATE_API_TOKEN:", process.env.REPLICATE_API_TOKEN ? `SET (${process.env.REPLICATE_API_TOKEN.substring(0, 6)}...)` : "NOT SET");
console.log("SUNO_API_KEY:", process.env.SUNO_API_KEY ? `SET (${process.env.SUNO_API_KEY.substring(0, 6)}...)` : "NOT SET");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("PORT:", process.env.PORT);
console.log("XAI_API_KEY:", process.env.XAI_API_KEY ? "SET" : "NOT SET");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "SET" : "NOT SET");
