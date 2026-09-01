// tools/timeTool.ts
import { AgentTool } from "../types";
import { tavily } from "@tavily/core";
import { getLocalSystemStatus } from "../../libs/system/system-status";

export const getSystemTimeTool: AgentTool = {
  definition: {
    type: "function",
    function: {
      name: "get_system_time",
      description:
        "Gets the current local date and time in a human-readable format. Use this whenever the user asks for the current time or date.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  handler: async () => {
    const now = new Date();

    return {
      dateTime: new Intl.DateTimeFormat("en-ID", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(now),
      timezone: "Asia/Jakarta",
    };
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

interface GetWeatherArgs {
  location?: string;
}

export const getWeatherTool: AgentTool<GetWeatherArgs> = {
  definition: {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Gets the current weather and today's forecast for a location. If no location is provided, use Bekasi, West Java, Indonesia.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description:
              "The city, town, or other location to get weather for. Defaults to Bekasi, West Java, Indonesia.",
          },
        },
        required: [],
      },
    },
  },

  handler: async ({ location = "Bekasi, West Java, Indonesia" }) => {
    try {
      const geocodeResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          location,
        )}&count=1&language=en&format=json`,
      );

      if (!geocodeResponse.ok) {
        throw new Error("Failed to find location");
      }

      const geocode = await geocodeResponse.json();
      const place = geocode.results?.[0];

      if (!place) {
        return {
          error: `Could not find a location matching "${location}".`,
        };
      }

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=1`,
      );

      if (!weatherResponse.ok) {
        throw new Error("Failed to fetch weather");
      }

      const weather = await weatherResponse.json();

      return {
        location: {
          name: place.name,
          country: place.country,
          latitude: place.latitude,
          longitude: place.longitude,
          timezone: weather.timezone,
        },
        current: {
          temperature: weather.current.temperature_2m,
          apparentTemperature: weather.current.apparent_temperature,
          humidity: weather.current.relative_humidity_2m,
          precipitation: weather.current.precipitation,
          windSpeed: weather.current.wind_speed_10m,
          weatherCode: weather.current.weather_code,
          isDay: weather.current.is_day === 1,
        },
        today: {
          high: weather.daily.temperature_2m_max[0],
          low: weather.daily.temperature_2m_min[0],
          precipitationProbability:
            weather.daily.precipitation_probability_max[0],
          sunrise: weather.daily.sunrise[0],
          sunset: weather.daily.sunset[0],
        },
      };
    } catch (error: any) {
      return {
        error: `Weather lookup failed: ${error?.message || "Unknown error"}`,
      };
    }
  },
};

interface SystemStatusArgs {}

export const getSystemStatusTool: AgentTool<SystemStatusArgs> = {
  definition: {
    type: "function",
    function: {
      name: "get_system_status",
      description:
        "Gets the current status of the machine running Edwin, including CPU usage, CPU temperature when available, memory usage, disk usage, operating system information, load average, and system uptime.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  handler: async () => {
    try {
      return await getLocalSystemStatus();
    } catch (error: any) {
      return {
        error: `Failed to get system status: ${
          error?.message || "Unknown error"
        }`,
      };
    }
  },
};
