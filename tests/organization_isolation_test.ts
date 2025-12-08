/**
 * Organization Data Isolation Test
 * 
 * This test verifies that data is properly isolated between organizations
 * and that users from one organization cannot access data from another.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DbStorage } from '../server/db-storage';
import { MemStorage } from '../server/storage';

describe('Organization Data Isolation', () => {
  let storage: DbStorage | MemStorage;
  
  // Test data
  let org1Id: string;
  let org2Id: string;
  let user1Id: string; // User in org1
  let user2Id: string; // User in org2
  let contact1Id: string; // Contact in org1
  let contact2Id: string; // Contact in org2
  let job1Id: string; // Job in org1
  let job2Id: string; // Job in org2

  beforeAll(async () => {
    // Use DbStorage for real database testing, or MemStorage for unit testing
    storage = new DbStorage(); // Change to MemStorage() for unit tests
    
    // Create test organizations
    const org1 = await storage.createOrganization({ name: "Test Organization 1" });
    const org2 = await storage.createOrganization({ name: "Test Organization 2" });
    org1Id = org1.id;
    org2Id = org2.id;
    
    // Create test users
    const user1 = await storage.createUser({
      username: "testuser1",
      email: "test1@example.com",
      password: "hashedpassword1",
      organizationId: org1Id,
      firstName: "Test",
      lastName: "User1"
    });
    
    const user2 = await storage.createUser({
      username: "testuser2", 
      email: "test2@example.com",
      password: "hashedpassword2",
      organizationId: org2Id,
      firstName: "Test",
      lastName: "User2"
    });
    
    user1Id = user1.id;
    user2Id = user2.id;
    
    // Create test contacts
    const contact1 = await storage.createContact(org1Id, user1Id, {
      firstName: "John",
      lastName: "Doe",
      phone: "+1234567890",
      email: "john@example.com"
    });
    
    const contact2 = await storage.createContact(org2Id, user2Id, {
      firstName: "Jane",
      lastName: "Smith", 
      phone: "+0987654321",
      email: "jane@example.com"
    });
    
    contact1Id = contact1.id;
    contact2Id = contact2.id;
    
    // Create test jobs
    const job1 = await storage.createJob(org1Id, user1Id, {
      name: "Test Job 1",
      location: "Location 1",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000) // 1 hour later
    });
    
    const job2 = await storage.createJob(org2Id, user2Id, {
      name: "Test Job 2", 
      location: "Location 2",
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000)
    });
    
    job1Id = job1.id;
    job2Id = job2.id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await storage.deleteContact(contact1Id);
      await storage.deleteContact(contact2Id);
      await storage.deleteJob(job1Id);
      await storage.deleteJob(job2Id);
      // Note: Users and organizations cleanup would depend on your implementation
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  });

  describe('Contact Isolation', () => {
    it('should only return contacts for the specified organization', async () => {
      const org1Contacts = await storage.getContacts(org1Id);
      const org2Contacts = await storage.getContacts(org2Id);
      
      // Org1 should only see its own contacts
      expect(org1Contacts).toHaveLength(1);
      expect(org1Contacts[0].id).toBe(contact1Id);
      expect(org1Contacts[0].organizationId).toBe(org1Id);
      
      // Org2 should only see its own contacts
      expect(org2Contacts).toHaveLength(1);
      expect(org2Contacts[0].id).toBe(contact2Id);
      expect(org2Contacts[0].organizationId).toBe(org2Id);
    });

    it('should not allow access to contacts from other organizations', async () => {
      // Try to get org1's contact using org2's organizationId
      const contact = await storage.getContact(contact1Id, org2Id);
      expect(contact).toBeUndefined();
      
      // Try to get org2's contact using org1's organizationId
      const contact2 = await storage.getContact(contact2Id, org1Id);
      expect(contact2).toBeUndefined();
    });
  });

  describe('Job Isolation', () => {
    it('should only return jobs for the specified organization', async () => {
      const org1Jobs = await storage.getJobs(org1Id);
      const org2Jobs = await storage.getJobs(org2Id);
      
      // Org1 should only see its own jobs
      expect(org1Jobs).toHaveLength(1);
      expect(org1Jobs[0].id).toBe(job1Id);
      expect(org1Jobs[0].organizationId).toBe(org1Id);
      
      // Org2 should only see its own jobs
      expect(org2Jobs).toHaveLength(1);
      expect(org2Jobs[0].id).toBe(job2Id);
      expect(org2Jobs[0].organizationId).toBe(org2Id);
    });

    it('should not allow access to jobs from other organizations', async () => {
      // Try to get org1's job using org2's organizationId
      const job = await storage.getJob(job1Id, org2Id);
      expect(job).toBeUndefined();
      
      // Try to get org2's job using org1's organizationId  
      const job2 = await storage.getJob(job2Id, org1Id);
      expect(job2).toBeUndefined();
    });
  });

  describe('Subscription Isolation', () => {
    it('should isolate subscriptions by organization', async () => {
      // Create test subscriptions
      await storage.createSubscription(user1Id, {
        status: "active",
        currency: "USD"
      });
      
      await storage.createSubscription(user2Id, {
        status: "trial", 
        currency: "GBP"
      });
      
      const org1Sub = await storage.getSubscription(user1Id);
      const org2Sub = await storage.getSubscription(user2Id);
      
      expect(org1Sub).toBeDefined();
      expect(org1Sub?.organizationId).toBe(org1Id);
      expect(org1Sub?.status).toBe("active");
      
      expect(org2Sub).toBeDefined();
      expect(org2Sub?.organizationId).toBe(org2Id);
      expect(org2Sub?.status).toBe("trial");
    });
  });

  describe('Message Isolation', () => {
    it('should isolate messages by organization', async () => {
      // Create test messages
      await storage.createMessage(org1Id, user1Id, {
        contactId: contact1Id,
        content: "Test message 1",
        direction: "outbound"
      });
      
      await storage.createMessage(org2Id, user2Id, {
        contactId: contact2Id,
        content: "Test message 2", 
        direction: "outbound"
      });
      
      const org1Messages = await storage.getMessages(contact1Id, org1Id);
      const org2Messages = await storage.getMessages(contact2Id, org2Id);
      
      expect(org1Messages).toHaveLength(1);
      expect(org1Messages[0].organizationId).toBe(org1Id);
      expect(org1Messages[0].content).toBe("Test message 1");
      
      expect(org2Messages).toHaveLength(1);
      expect(org2Messages[0].organizationId).toBe(org2Id);
      expect(org2Messages[0].content).toBe("Test message 2");
      
      // Try to access org1's messages using org2's organizationId
      const crossOrgMessages = await storage.getMessages(contact1Id, org2Id);
      expect(crossOrgMessages).toHaveLength(0);
    });
  });

  describe('Template Isolation', () => {
    it('should isolate templates by organization', async () => {
      // Create test templates
      await storage.createTemplate(org1Id, user1Id, {
        name: "Template 1",
        content: "Hello from org 1"
      });
      
      await storage.createTemplate(org2Id, user2Id, {
        name: "Template 2",
        content: "Hello from org 2"
      });
      
      const org1Templates = await storage.getTemplates(org1Id);
      const org2Templates = await storage.getTemplates(org2Id);
      
      expect(org1Templates).toHaveLength(1);
      expect(org1Templates[0].organizationId).toBe(org1Id);
      expect(org1Templates[0].content).toBe("Hello from org 1");
      
      expect(org2Templates).toHaveLength(1);
      expect(org2Templates[0].organizationId).toBe(org2Id);
      expect(org2Templates[0].content).toBe("Hello from org 2");
    });
  });

  describe('Credit System Isolation', () => {
    it('should isolate credits by organization', async () => {
      // Create test credit grants
      await storage.createCreditGrant(user1Id, {
        organizationId: org1Id,
        userId: user1Id,
        sourceType: "subscription",
        creditsGranted: 1000,
        creditsRemaining: 1000
      });
      
      await storage.createCreditGrant(user2Id, {
        organizationId: org2Id,
        userId: user2Id,
        sourceType: "subscription", 
        creditsGranted: 500,
        creditsRemaining: 500
      });
      
      const org1Credits = await storage.getTotalCredits(user1Id);
      const org2Credits = await storage.getTotalCredits(user2Id);
      
      expect(org1Credits).toBe(1000);
      expect(org2Credits).toBe(500);
      
      const org1Grants = await storage.getCreditGrants(user1Id);
      const org2Grants = await storage.getCreditGrants(user2Id);
      
      expect(org1Grants).toHaveLength(1);
      expect(org1Grants[0].organizationId).toBe(org1Id);
      
      expect(org2Grants).toHaveLength(1);
      expect(org2Grants[0].organizationId).toBe(org2Id);
    });
  });

  describe('Platform Settings', () => {
    it('should provide default emails and allow updates', async () => {
      const originalSettings = await storage.getPlatformSettings();

      expect(originalSettings.feedbackEmail).toBeDefined();
      expect(originalSettings.supportEmail).toBeDefined();

      const updated = await storage.updatePlatformSettings({
        feedbackEmail: "feedback+test@heyteam.ai",
        supportEmail: "support+test@heyteam.ai",
      });

      expect(updated.feedbackEmail).toBe("feedback+test@heyteam.ai");
      expect(updated.supportEmail).toBe("support+test@heyteam.ai");

      const persisted = await storage.getPlatformSettings();
      expect(persisted.feedbackEmail).toBe("feedback+test@heyteam.ai");
      expect(persisted.supportEmail).toBe("support+test@heyteam.ai");

      await storage.updatePlatformSettings({
        feedbackEmail: originalSettings.feedbackEmail,
        supportEmail: originalSettings.supportEmail,
      });
    });
  });
});

// Helper function to run the test
export async function runOrganizationIsolationTest() {
  console.log('🧪 Running Organization Data Isolation Tests...');
  
  try {
    // This would typically be run with a test runner like Jest
    console.log('✅ All organization isolation tests would be run here');
    console.log('📋 Tests verify:');
    console.log('   - Contacts are isolated by organization');
    console.log('   - Jobs are isolated by organization');
    console.log('   - Messages are isolated by organization');
    console.log('   - Subscriptions are isolated by organization');
    console.log('   - Templates are isolated by organization');
    console.log('   - Credits are isolated by organization');
    console.log('   - Cross-organization access is prevented');
    
    return true;
  } catch (error) {
    console.error('❌ Organization isolation test failed:', error);
    return false;
  }
}
