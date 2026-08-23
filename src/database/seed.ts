import "dotenv/config";
import { db } from "./index";
import { productsTable } from "./schema";

const products = [
  {
    name: "Nastar",
    variant: "Large",
    price: 120000,
  },
  {
    name: "Nastar",
    variant: "Medium",
    price: 80000,
  },
  {
    name: "Nastar",
    variant: "Small",
    price: 55000,
  },

  {
    name: "Semprit",
    variant: "Large",
    price: 80000,
  },
  {
    name: "Semprit",
    variant: "Medium",
    price: 55000,
  },
  {
    name: "Semprit",
    variant: "Small",
    price: 35000,
  },

  {
    name: "Buttercake",
    variant: "Full",
    price: 135000,
  },
  {
    name: "Buttercake",
    variant: "Half",
    price: 70000,
  },

  {
    name: "Buttercake Wijsman",
    variant: "Full",
    price: 220000,
  },

  {
    name: "Cheese Buttercake",
    variant: "Full",
    price: 160000,
  },
  {
    name: "Cheese Buttercake",
    variant: "Half",
    price: 80000,
  },

  {
    name: "Marmer Brownies",
    variant: "Full",
    price: 160000,
  },
  {
    name: "Marmer Brownies",
    variant: "Half",
    price: 80000,
  },

  {
    name: "Brownies Classic",
    variant: "Full",
    price: 85000,
  },
  {
    name: "Brownies Classic",
    variant: "Half",
    price: 45000,
  },

  {
    name: "Brownies Cube",
    variant: "Full",
    price: 100000,
  },
  {
    name: "Brownies Cube",
    variant: "Half",
    price: 50000,
  },

  {
    name: "Brownies Ketan Hitam",
    variant: "Full",
    price: 70000,
  },
  {
    name: "Brownies Ketan Hitam",
    variant: "Half",
    price: 40000,
  },

  {
    name: "Brownies Ketan Hitam Keju",
    variant: "Full",
    price: 110000,
  },
  {
    name: "Brownies Ketan Hitam Keju",
    variant: "Half",
    price: 55000,
  },

  {
    name: "Chiffon Pandan Suji",
    variant: "Full",
    price: 150000,
  },
  {
    name: "Chiffon Pandan Suji",
    variant: "Half",
    price: 70000,
  },

  {
    name: "Chiffon Cokelat",
    variant: "Full",
    price: 150000,
  },
  {
    name: "Chiffon Cokelat",
    variant: "Half",
    price: 75000,
  },

  {
    name: "Chiffon Kacang Merah",
    variant: "Full",
    price: 150000,
  },
  {
    name: "Chiffon Kacang Merah",
    variant: "Half",
    price: 75000,
  },

  {
    name: "Chiffon Ketan Hitam",
    variant: "Full",
    price: 150000,
  },
  {
    name: "Chiffon Ketan Hitam",
    variant: "Half",
    price: 75000,
  },

  {
    name: "Lapis Legit Wijsman",
    variant: "Full",
    price: 480000,
  },
  {
    name: "Lapis Legit Wijsman",
    variant: "Half",
    price: 240000,
  },
  {
    name: "Lapis Legit Wijsman",
    variant: "Quarter",
    price: 125000,
  },

  {
    name: "Lapis Legit Segitiga",
    variant: "Full",
    price: 450000,
  },

  {
    name: "Lapis Prunes Wijsman",
    variant: "Full",
    price: 580000,
  },
  {
    name: "Lapis Prunes Wijsman",
    variant: "Half",
    price: 300000,
  },
  {
    name: "Lapis Prunes Wijsman",
    variant: "Quarter",
    price: 150000,
  },

  {
    name: "Pineapple Cake",
    variant: "Full",
    price: 180000,
  },
  {
    name: "Pineapple Cake",
    variant: "Half",
    price: 90000,
  },
  {
    name: "Pineapple Cake",
    variant: "Quarter",
    price: 50000,
  },
];

async function seed() {
  console.log("Seeding database...");

  await db.insert(productsTable).values(products).onConflictDoNothing();

  console.log(`Seeded ${products.length} products.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
