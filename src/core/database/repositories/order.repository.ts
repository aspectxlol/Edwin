import { and, eq, ilike } from "drizzle-orm";
import { db } from "..";
import { orderItemsTable, ordersTable, productsTable } from "../schema";

export async function createOrder(order: {
  items: {
    name: string;
    variant?: string;
    quantity: number;
    priceAtSale: number;
  }[];
  pickupDate: Date;
  type: "onsite" | "delivery";
  deliveryLocation?: string;
}) {
  return db.transaction(async (tx) => {
    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        pickupDate: order.pickupDate,
        type: order.type,
        deliveryLocation:
          order.type === "delivery" ? order.deliveryLocation : null,
      })
      .returning();

    const items = await tx
      .insert(orderItemsTable)
      .values(
        order.items.map((item) => ({
          orderId: createdOrder.id,
          itemName: item.name,
          variant: item.variant,
          priceAtSale: item.priceAtSale,
          quantity: item.quantity,
        })),
      )
      .returning();

    return {
      ...createdOrder,
      items,
    };
  });
}

export async function getOrder(id: number, database = db) {
  const [order] = await database
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!order) {
    return null;
  }

  const items = await database
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));

  return {
    ...order,
    items,
  };
}

export async function getOrders(
  status?: "pending" | "confirmed" | "completed" | "cancelled",
) {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(status ? eq(ordersTable.status, status) : undefined);

  return Promise.all(orders.map((order) => getOrder(order.id)));
}

export async function updateOrder(
  id: number,
  updates: {
    status?: "pending" | "confirmed" | "completed" | "cancelled";

    pickupDate?: Date;

    type?: "onsite" | "delivery";

    deliveryLocation?: string;
  },
) {
  const [order] = await db
    .update(ordersTable)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, id))
    .returning();

  if (!order) {
    return null;
  }

  return getOrder(order.id);
}

export async function deleteOrder(id: number) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .delete(ordersTable)
      .where(eq(ordersTable.id, id))
      .returning();

    if (!order) {
      return null;
    }

    await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    return order;
  });
}

export async function findProductPrice(product: string, variant?: string) {
  const conditions = [ilike(productsTable.name, product)];

  if (variant) {
    conditions.push(ilike(productsTable.variant, variant));
  }

  const [productResult] = await db
    .select()
    .from(productsTable)
    .where(and(...conditions))
    .limit(10);

  if (!productResult) {
    return null;
  }

  return {
    product: productResult.name,
    variant: productResult.variant,
    price: productResult.price,
  };
}
