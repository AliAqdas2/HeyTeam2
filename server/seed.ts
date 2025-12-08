import { DbStorage } from "./db-storage";

async function seed() {
  const storage = new DbStorage();

  console.log("Seeding database...");

  // Create demo user
  const user = await storage.createUser({
    username: "demo",
    password: "demo",
    email: "demo@heyteam.app",
  });

  console.log(`Created user: ${user.username}`);

  // Update subscription to Pro plan
  await storage.updateSubscription(user.id, {
    plan: "pro",
    messageCredits: 500,
  });

  console.log("Updated subscription to Pro plan");

  // Create sample contacts
  const contacts = await Promise.all([
    storage.createContact(user.id, {
      firstName: "John",
      lastName: "Doe",
      phone: "+15551234567",
      email: "john.doe@example.com",
      notes: "Lead carpenter",
    }),
    storage.createContact(user.id, {
      firstName: "Jane",
      lastName: "Smith",
      phone: "+15559876543",
      email: "jane.smith@example.com",
      notes: "Electrician",
    }),
    storage.createContact(user.id, {
      firstName: "Bob",
      lastName: "Johnson",
      phone: "+15555551234",
      email: "bob.j@example.com",
      notes: null,
    }),
  ]);

  console.log(`Created ${contacts.length} contacts`);

  // Create sample template
  const template = await storage.createTemplate(user.id, {
    name: "Availability Check",
    content: "Hi {{contact.firstName}}, are you available for {{job.name}} on {{job.date}} at {{job.location}}? Reply Y (yes), N (no), or M (maybe).",
  });

  console.log(`Created template: ${template.name}`);

  // Create sample job
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setHours(17, 0, 0, 0);

  const job = await storage.createJob(user.id, {
    name: "Downtown Construction",
    location: "123 Main St, Downtown",
    startTime: tomorrow,
    endTime: endTime,
    requiredHeadcount: 6,
    notes: "Bring safety equipment",
  });

  console.log(`Created job: ${job.name}`);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
