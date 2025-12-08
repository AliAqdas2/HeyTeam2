import type { IStorage } from "../storage";
import type { InsertCreditGrant } from "@shared/schema";

export class CreditService {
  constructor(private storage: IStorage) {}

  /**
   * Grant credits to a user from a specific source (trial, subscription, bundle)
   */
  async grantCredits(
    userId: string,
    sourceType: "trial" | "subscription" | "bundle",
    creditsGranted: number,
    sourceRef: string | null = null,
    expiresAt: Date | null = null
  ) {
    const organizationId = await this.getUserOrganizationId(userId);
    const grant: InsertCreditGrant = {
      userId,
      organizationId,
      sourceType,
      sourceRef,
      creditsGranted,
      creditsConsumed: 0,
      creditsRemaining: creditsGranted,
      expiresAt,
    };

    return await this.storage.createCreditGrant(userId, grant);
  }

  /**
   * Consume credits using FIFO (First In, First Out) by expiry date
   * Credits expiring soonest are used first, then non-expiring credits
   * Returns the credit transactions created
   * This operation is atomic and transaction-safe
   */
  async consumeCredits(
    userId: string,
    amount: number,
    reason: string,
    messageId: string | null = null
  ) {
    return await this.storage.consumeCreditsAtomic(userId, amount, reason, messageId);
  }

  /**
   * Refund credits back to their original grant
   * This reverses a previous consumption
   * This operation is atomic and transaction-safe
   */
  async refundCredits(
    userId: string,
    transactionIds: string[],
    reason: string
  ) {
    return await this.storage.refundCreditsAtomic(userId, transactionIds, reason);
  }

  /**
   * Get the total available credits for a user
   * Excludes expired grants
   */
  async getAvailableCredits(userId: string) {
    const grants = await this.storage.getCreditGrants(userId);
    
    const now = new Date();
    const activeGrants = grants.filter(g => {
      if (g.creditsRemaining <= 0) return false;
      if (g.expiresAt && g.expiresAt <= now) return false;
      return true;
    });

    return activeGrants.reduce((total, g) => total + g.creditsRemaining, 0);
  }

  async getAvailableCreditsForOrganization(organizationId: string) {
    const grants = await this.storage.getCreditGrantsByOrganization(organizationId);
    const now = new Date();
    const activeGrants = grants.filter((g) => {
      if (g.creditsRemaining <= 0) return false;
      if (g.expiresAt && g.expiresAt <= now) return false;
      return true;
    });

    return activeGrants.reduce((total, g) => total + g.creditsRemaining, 0);
  }

  /**
   * Get a detailed breakdown of credits by source
   */
  async getCreditBreakdown(userId: string) {
    const grants = await this.storage.getCreditGrants(userId);
    const now = new Date();

    const breakdown = {
      total: 0,
      trial: 0,
      subscription: 0,
      bundle: 0,
      expired: 0,
    };

    for (const grant of grants) {
      const isExpired = grant.expiresAt && grant.expiresAt <= now;
      
      if (isExpired) {
        breakdown.expired += grant.creditsRemaining;
      } else {
        breakdown.total += grant.creditsRemaining;
        
        switch (grant.sourceType) {
          case "trial":
            breakdown.trial += grant.creditsRemaining;
            break;
          case "subscription":
            breakdown.subscription += grant.creditsRemaining;
            break;
          case "bundle":
            breakdown.bundle += grant.creditsRemaining;
            break;
        }
      }
    }

    return breakdown;
  }

  private async getUserOrganizationId(userId: string): Promise<string> {
    const user = await this.storage.getUser(userId);
    if (!user?.organizationId) {
      throw new Error("User not associated with an organization");
    }
    return user.organizationId;
  }

  async consumeCreditsForOrganization(
    organizationId: string,
    amount: number,
    reason: string,
    messageId: string | null = null
  ) {
    return await this.storage.consumeCreditsAtomicByOrganization(
      organizationId,
      amount,
      reason,
      messageId
    );
  }
}
