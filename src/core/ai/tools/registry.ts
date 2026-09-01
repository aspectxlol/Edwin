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
import { deleteNoteTool, saveNoteTool, searchNotesTool } from "./noteTools";
import {
  createReminderTool,
  deleteReminderTool,
  listRemindersTool,
  updateReminderTool,
} from "./reminderTools";

export const toolsRegistry: ToolRegistry = {
  get_system_time: getSystemTimeTool,
  calculate: calculateTool,
  web_search: webSearchTool,
  get_weather: getWeatherTool,
  get_system_status: getSystemStatusTool,

  // create_order: createOrderTool,
  // get_order: getOrderTool,
  // get_orders: getOrdersTool,
  // update_order: updateOrderTool,
  // delete_order: deleteOrderTool,

  // get_reference_price: referencePriceTool,

  save_note: saveNoteTool,
  search_notes: searchNotesTool,
  delete_note: deleteNoteTool,

  create_reminder: createReminderTool,
  list_reminders: listRemindersTool,
  update_reminder: updateReminderTool,
  delete_reminder: deleteReminderTool,
};

export const toolDefinitions: OpenAI.ChatCompletionTool[] = Object.values(
  toolsRegistry,
).map((tool) => tool.definition);
