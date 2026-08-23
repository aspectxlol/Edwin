// tools/timeTool.ts
import { AgentTool } from "../types";
import { tavily } from "@tavily/core";

export const getSystemTimeTool: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "getSystemTime",
      description: "Gets the current system date and time ISO string.",
      parameters: { type: "object", properties: {} },
    },
  },
  handler: async () => {
    return { isoString: new Date().toISOString() };
  },
};

// tools/calculatorTool.ts

export const calculateTool: AgentTool<{ expression: string }> = {
  definition: {
    type: "function",
    function: {
      name: "calculate",
      description: "Evaluates a basic mathematical expression.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The math formula, e.g. '12 * (4 + 5)'",
          },
        },
        required: ["expression"],
      },
    },
  },
  handler: async ({ expression }) => {
    try {
      const cleanExpr = expression.replace(/[^0-9+\-*/().]/g, "");
      return { result: Function(`'use strict'; return (${cleanExpr})`)() };
    } catch {
      return { error: "Invalid expression" };
    }
  },
};

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

interface WebSearchArgs {
  query: string;
  maxResults?: number;
}

export const webSearchTool: AgentTool<WebSearchArgs> = {
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Searches the web for real-time information, current facts, news, documentation, or broad knowledge.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query term or phrase.",
          },
          maxResults: {
            type: "number",
            description: "Number of search results to return (default: 3).",
          },
        },
        required: ["query"],
      },
    },
  },
  handler: async ({ query, maxResults = 3 }) => {
    try {
      const response = await tvly.search(query, {
        maxResults,
        searchDepth: "basic",
      });

      // Map down to clean essential text so context tokens aren't wasted
      const results = response.results.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
      }));

      return { results };
    } catch (error: any) {
      return { error: `Search failed: ${error?.message || "Unknown error"}` };
    }
  },
};
