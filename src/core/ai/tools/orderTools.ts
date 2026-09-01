import { AgentTool } from "../types";
import {
  createOrder,
  getOrder,
  getOrders,
  updateOrder,
  deleteOrder,
  findProductPrice,
} from "../../database/repositories/order.repository";
// import { PrinterOrder, printOrder } from "../../libs/orderPrinter";

interface OrderItemInput {
  name: string;
  variant?: string;
  quantity: number;
  priceAtSale: number;
}

interface CreateOrderArgs {
  items: OrderItemInput[];
  pickupDate: string;
  type: "onsite" | "delivery";
  deliveryLocation?: string;
}

interface GetOrderArgs {
  id: number;
}

interface GetOrdersArgs {
  status?: "pending" | "confirmed" | "completed" | "cancelled";
}

interface UpdateOrderArgs {
  id: number;
  status?: "pending" | "confirmed" | "completed" | "cancelled";
  pickupDate?: string;
  type?: "onsite" | "delivery";
  deliveryLocation?: string;
}

interface DeleteOrderArgs {
  id: number;
}

interface ReferencePriceArgs {
  product: string;
  variant?: string;
}

interface PrintOrderArgs {
  id?: number;
  items: OrderItemInput[];
  pickupDate: string;
  type: "onsite" | "delivery";
  deliveryLocation?: string;
}

export const createOrderTool: AgentTool<CreateOrderArgs> = {
  definition: {
    type: "function",
    function: {
      name: "create_order",
      description:
        "Creates a new customer order. Use reference_price first when the price of an item is unknown.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Items in the order.",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Product name.",
                },
                variant: {
                  type: "string",
                  description:
                    "Product variant such as Large, Medium, Small, Full, Half, or Quarter.",
                },
                quantity: {
                  type: "number",
                  description: "Quantity.",
                },
                priceAtSale: {
                  type: "number",
                  description: "Actual price charged for one item.",
                },
              },
              required: ["name", "quantity", "priceAtSale"],
            },
          },
          pickupDate: {
            type: "string",
            description: "Pickup or delivery date and time in ISO 8601 format.",
          },
          type: {
            type: "string",
            enum: ["onsite", "delivery"],
          },
          deliveryLocation: {
            type: "string",
            description: "Delivery address. Required for delivery.",
          },
        },
        required: ["items", "pickupDate", "type"],
      },
    },
  },

  handler: async (args) => {
    if (args.type === "delivery" && !args.deliveryLocation) {
      return {
        error: "A delivery location is required.",
      };
    }

    if (args.items.length === 0) {
      return {
        error: "An order must contain at least one item.",
      };
    }

    const order = await createOrder({
      ...args,
      pickupDate: new Date(args.pickupDate),
    });

    return {
      success: true,
      order,
    };
  },
};

export const getOrderTool: AgentTool<GetOrderArgs> = {
  definition: {
    type: "function",
    function: {
      name: "get_order",
      description: "Gets a specific order by ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "Order ID.",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id }) => {
    const order = await getOrder(id);

    if (!order) {
      return {
        error: `Order ${id} was not found.`,
      };
    }

    return {
      order,
    };
  },
};

export const getOrdersTool: AgentTool<GetOrdersArgs> = {
  definition: {
    type: "function",
    function: {
      name: "get_orders",
      description: "Gets customer orders, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "confirmed", "completed", "cancelled"],
          },
        },
      },
    },
  },

  handler: async ({ status }) => {
    const orders = await getOrders(status);

    return {
      orders,
    };
  },
};

export const updateOrderTool: AgentTool<UpdateOrderArgs> = {
  definition: {
    type: "function",
    function: {
      name: "update_order",
      description: "Updates an existing order.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
          },
          status: {
            type: "string",
            enum: ["pending", "confirmed", "completed", "cancelled"],
          },
          pickupDate: {
            type: "string",
            description: "New pickup or delivery date in ISO 8601 format.",
          },
          type: {
            type: "string",
            enum: ["onsite", "delivery"],
          },
          deliveryLocation: {
            type: "string",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id, pickupDate, ...updates }) => {
    const order = await updateOrder(id, {
      ...updates,
      ...(pickupDate ? { pickupDate: new Date(pickupDate) } : {}),
    });

    if (!order) {
      return {
        error: `Order ${id} was not found.`,
      };
    }

    return {
      success: true,
      order,
    };
  },
};

export const deleteOrderTool: AgentTool<DeleteOrderArgs> = {
  definition: {
    type: "function",
    function: {
      name: "delete_order",
      description:
        "Deletes an order. Use only when the user explicitly asks to delete or cancel an order.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
          },
        },
        required: ["id"],
      },
    },
  },

  handler: async ({ id }) => {
    const deleted = await deleteOrder(id);

    if (!deleted) {
      return {
        error: `Order ${id} was not found.`,
      };
    }

    return {
      success: true,
      order: deleted,
    };
  },
};

export const referencePriceTool: AgentTool<ReferencePriceArgs> = {
  definition: {
    type: "function",
    function: {
      name: "reference_price",
      description:
        "Looks up the reference selling price of a bakery product and variant. Use this before creating an order when the price is unknown.",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "string",
            description:
              "Product name, for example Nastar or Brownies Classic.",
          },
          variant: {
            type: "string",
            description:
              "Variant such as Large, Medium, Small, Full, Half, or Quarter.",
          },
        },
        required: ["product"],
      },
    },
  },

  handler: async ({ product, variant }) => {
    const result = await findProductPrice(product, variant);

    if (!result) {
      return {
        found: false,
        error: "No matching reference price was found.",
      };
    }

    return {
      found: true,
      product: result.product,
      variant: result.variant,
      price: result.price,
    };
  },
};

// export const printOrderTool: AgentTool<PrintOrderArgs> = {
//   definition: {
//     type: "function",
//     function: {
//       name: "print_order",
//       description:
//         "Prints an order receipt. If an order ID is provided, retrieves that existing order from the database and prints it. If no ID is provided, prints the order directly from the supplied items and order details without saving it to the database.",

//       parameters: {
//         type: "object",
//         properties: {
//           id: {
//             type: "integer",
//             description:
//               "Existing order ID to print. When provided, the order is loaded from the database.",
//           },

//           items: {
//             type: "array",
//             description:
//               "Order items to print. Required when no order ID is provided.",
//             items: {
//               type: "object",
//               properties: {
//                 name: {
//                   type: "string",
//                   description: "Product name.",
//                 },
//                 variant: {
//                   type: "string",
//                   description: "Product variant such as Large, Half, or 500gr.",
//                 },
//                 quantity: {
//                   type: "integer",
//                   description: "Quantity ordered.",
//                 },
//                 priceAtSale: {
//                   type: "number",
//                   description: "Price per item at the time of sale.",
//                 },
//               },
//               required: ["name", "quantity", "priceAtSale"],
//             },
//           },

//           pickupDate: {
//             type: "string",
//             description: "Pickup or delivery date/time in ISO 8601 format.",
//           },

//           type: {
//             type: "string",
//             enum: ["onsite", "delivery"],
//             description: "Whether the order is onsite pickup or delivery.",
//           },

//           deliveryLocation: {
//             type: "string",
//             description: "Delivery address. Required when type is delivery.",
//           },
//         },
//         required: [],
//       },
//     },
//   },

//   handler: async (args) => {
//     let order: PrinterOrder;

//     if (args.id !== undefined) {
//       const result = await getOrder(args.id);

//       if (!order) {
//         return {
//           success: false,
//           error: `Order #${args.id} was not found.`,
//         };
//       }
//     } else {
//       if (!args.items || args.items.length === 0) {
//         return {
//           success: false,
//           error:
//             "Items are required when printing without an existing order ID.",
//         };
//       }

//       if (!args.pickupDate) {
//         return {
//           success: false,
//           error:
//             "pickupDate is required when printing without an existing order ID.",
//         };
//       }

//       if (!args.type) {
//         return {
//           success: false,
//           error: "type is required when printing without an existing order ID.",
//         };
//       }

//       if (args.type === "delivery" && !args.deliveryLocation) {
//         return {
//           success: false,
//           error: "deliveryLocation is required for delivery orders.",
//         };
//       }

//       order = {
//         items: args.items,
//         pickupDate: new Date(args.pickupDate),
//         type: args.type,
//         deliveryLocation:
//           args.type === "delivery" ? args.deliveryLocation : undefined,
//       };
//     }

//     await printOrder(order);

//     return {
//       success: true,
//       message: args.id
//         ? `Order #${args.id} printed successfully.`
//         : "Order printed successfully.",
//       orderId: args.id ?? null,
//     };
//   },
// };
