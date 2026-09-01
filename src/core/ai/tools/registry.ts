import OpenAI from "openai";
import { ToolRegistry } from "../types";

import {
  getSystemTimeTool,
  calculateTool,
  webSearchTool,
  getWeatherTool,
  getSystemStatusTool,
} from "./generalTools";
import {
  createOrderTool,
  deleteOrderTool,
  getOrdersTool,
  getOrderTool,
  referencePriceTool,
  updateOrderTool,
} from "./orderTools";

export const toolsRegistry: ToolRegistry = {
  get_system_time: getSystemTimeTool,
  calculate: calculateTool,
  web_search: webSearchTool,
  get_weather: getWeatherTool,
  get_system_status: getSystemStatusTool,

  create_order: createOrderTool,
  get_order: getOrderTool,
  get_orders: getOrdersTool,
  update_order: updateOrderTool,
  delete_order: deleteOrderTool,

  get_reference_price: referencePriceTool,
};

export const toolDefinitions: OpenAI.ChatCompletionTool[] = Object.values(
  toolsRegistry,
).map((tool) => tool.definition);
