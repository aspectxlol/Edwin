import OpenAI from "openai";
import "dotenv/config";

export const aiClient = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://localhost:3000",
    "X-Title": "Edwin",
  },
});

export const MODEL = "deepseek/deepseek-v4-flash-vision-exp";
