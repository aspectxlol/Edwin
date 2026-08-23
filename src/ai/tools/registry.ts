import OpenAI from "openai";
import { ToolRegistry } from "../types";

import {
  getSystemTimeTool,
  calculateTool,
  webSearchTool,
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
  getSystemTime: getSystemTimeTool,
  calculate: calculateTool,
  web_search: webSearchTool,

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
