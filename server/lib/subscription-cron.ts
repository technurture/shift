import { storage } from "../storage";
import { getDaysUntilExpiry } from "./paystack";
import {
  sendSubscriptionReminderEmail,
  sendPlanExpiredEmail,
} from "./email";

const REMINDER_DAYS = 10;
const CHECK_INTERVAL_HOURS = 6;

async function sendReminders() {
  try {
    console.log("[Cron] Checking for expiring subscriptions...");
    
    const usersWithExpiringPlans = await storage.getUsersWithExpiringPlans(REMINDER_DAYS);
    
    for (const user of usersWithExpiringPlans) {
      if (!user.planExpiresAt) continue;
      
      const daysRemaining = getDaysUntilExpiry(new Date(user.planExpiresAt));
      
      const lastReminder = user.lastReminderSentAt ? new Date(user.lastReminderSentAt) : null;
      const now = new Date();
      
      const shouldSendReminder = !lastReminder || 
        (now.getTime() - lastReminder.getTime()) > 24 * 60 * 60 * 1000;
      
      if (shouldSendReminder && daysRemaining <= REMINDER_DAYS && daysRemaining > 0) {
        console.log(`[Cron] Sending reminder to ${user.email}, ${daysRemaining} days remaining`);
        
        await sendSubscriptionReminderEmail(
          user.email,
          user.firstName,
          user.plan,
          daysRemaining
        );
        
        await storage.createNotification({
          userId: user.id,
          type: "subscription_reminder",
          title: "Subscription Expiring Soon",
          message: `Your ${user.plan} plan expires in ${daysRemaining} days. Renew now to keep your premium features.`,
        });
        
        await storage.updateSubscription(user.id, {
          plan: user.plan,
          lastReminderSentAt: now,
        });
      }
    }
    
    console.log(`[Cron] Sent reminders to ${usersWithExpiringPlans.length} users`);
  } catch (error) {
    console.error("[Cron] Error sending reminders:", error);
  }
}

async function processExpiredSubscriptions() {
  try {
    console.log("[Cron] Checking for expired subscriptions...");
    
    const expiredUsers = await storage.getUsersWithExpiredPlans();
    
    for (const user of expiredUsers) {
      console.log(`[Cron] Downgrading ${user.email} from ${user.plan} to free`);
      
      const previousPlan = user.plan;
      
      await storage.updateSubscription(user.id, {
        plan: "free",
        planStatus: "expired",
        monthlyEmailsUsed: 0,
        monthlyLinksScanned: 0,
      });
      
      await sendPlanExpiredEmail(user.email, user.firstName, previousPlan);
      
      await storage.createNotification({
        userId: user.id,
        type: "plan_expired",
        title: "Plan Expired",
        message: `Your ${previousPlan} plan has expired. You've been downgraded to the free Starter plan. Resubscribe to restore your premium features.`,
      });
    }
    
    console.log(`[Cron] Processed ${expiredUsers.length} expired subscriptions`);
  } catch (error) {
    console.error("[Cron] Error processing expired subscriptions:", error);
  }
}

export function startSubscriptionCron() {
  console.log("[Cron] Starting subscription cron jobs...");
  
  sendReminders();
  processExpiredSubscriptions();
  
  setInterval(() => {
    sendReminders();
    processExpiredSubscriptions();
  }, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
  
  console.log(`[Cron] Subscription checks scheduled every ${CHECK_INTERVAL_HOURS} hours`);
}
