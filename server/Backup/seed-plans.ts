import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { subscriptionPlans, smsBundles } from "@shared/schema";

const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function seedPlans() {
  try {
    console.log("Seeding subscription plans...");

    // Check if plans already exist
    const existingPlans = await db.select().from(subscriptionPlans);
    if (existingPlans.length > 0) {
      console.log("Plans already exist, skipping seed.");
      return;
    }

    // Starter Plan - £29/mo (500 messages)
    const [starterPlan] = await db.insert(subscriptionPlans).values({
      name: "Starter",
      description: "Perfect for small teams getting started with workforce coordination",
      priceGBP: 2900, // £29.00
      priceUSD: 3700, // $37.00
      priceEUR: 3400, // €34.00
      monthlyCredits: 500,
      supportLevel: "email",
      customTemplates: false,
      autoFollowUp: false,
      multiManager: false,
      aiFeatures: false,
      dedicatedNumber: false,
      isActive: true,
    }).returning();

    // Team Plan - £79/mo (3,000 messages)
    const [teamPlan] = await db.insert(subscriptionPlans).values({
      name: "Team",
      description: "For growing teams needing advanced features and more messages",
      priceGBP: 7900, // £79.00
      priceUSD: 10000, // $100.00
      priceEUR: 9200, // €92.00
      monthlyCredits: 3000,
      supportLevel: "priority",
      customTemplates: true,
      autoFollowUp: true,
      multiManager: true,
      aiFeatures: false,
      dedicatedNumber: false,
      isActive: true,
    }).returning();

    // Business Plan - £199/mo (10,000 messages)
    const [businessPlan] = await db.insert(subscriptionPlans).values({
      name: "Business",
      description: "Complete solution with dedicated support and advanced AI features",
      priceGBP: 19900, // £199.00
      priceUSD: 25200, // $252.00
      priceEUR: 23200, // €232.00
      monthlyCredits: 10000,
      supportLevel: "dedicated",
      customTemplates: true,
      autoFollowUp: true,
      multiManager: true,
      aiFeatures: true,
      dedicatedNumber: true,
      isActive: true,
    }).returning();

    console.log("✓ Created subscription plans");

    // Create SMS bundles for each plan
    await db.insert(smsBundles).values([
      // Starter bundles
      {
        name: "Starter - 500 SMS",
        description: "Additional 500 messages for Starter plan",
        credits: 500,
        priceGBP: 1500, // £15.00
        priceUSD: 1900, // $19.00
        priceEUR: 1700, // €17.00
        planId: starterPlan.id,
        isActive: true,
      },
      {
        name: "Starter - 1,000 SMS",
        description: "Additional 1,000 messages for Starter plan",
        credits: 1000,
        priceGBP: 2500, // £25.00
        priceUSD: 3200, // $32.00
        priceEUR: 2900, // €29.00
        planId: starterPlan.id,
        isActive: true,
      },
      // Team bundles
      {
        name: "Team - 1,000 SMS",
        description: "Additional 1,000 messages for Team plan",
        credits: 1000,
        priceGBP: 2000, // £20.00
        priceUSD: 2500, // $25.00
        priceEUR: 2300, // €23.00
        planId: teamPlan.id,
        isActive: true,
      },
      {
        name: "Team - 5,000 SMS",
        description: "Additional 5,000 messages for Team plan",
        credits: 5000,
        priceGBP: 9000, // £90.00
        priceUSD: 11400, // $114.00
        priceEUR: 10500, // €105.00
        planId: teamPlan.id,
        isActive: true,
      },
      // Business bundles
      {
        name: "Business - 5,000 SMS",
        description: "Additional 5,000 messages for Business plan",
        credits: 5000,
        priceGBP: 7500, // £75.00
        priceUSD: 9500, // $95.00
        priceEUR: 8700, // €87.00
        planId: businessPlan.id,
        isActive: true,
      },
      {
        name: "Business - 10,000 SMS",
        description: "Additional 10,000 messages for Business plan",
        credits: 10000,
        priceGBP: 13500, // £135.00
        priceUSD: 17100, // $171.00
        priceEUR: 15700, // €157.00
        planId: businessPlan.id,
        isActive: true,
      },
    ]);

    console.log("✓ Created SMS bundles");
    console.log("\nSeeding complete!");
    console.log(`Created ${existingPlans.length === 0 ? 3 : 0} subscription plans and 6 SMS bundles`);
  } catch (error) {
    console.error("Error seeding plans:", error);
    throw error;
  }
}

seedPlans()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
