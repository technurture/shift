import { storage } from "../server/storage";
import { connectToDatabase } from "../server/db";
import bcrypt from "bcryptjs";
import type { InsertUser } from "../shared/schema";

async function seedTestUser() {
  try {
    await connectToDatabase();
    
    const testEmail = "test@mailsift.com";
    const testPassword = "test123";
    
    const existingUser = await storage.getUserByEmail(testEmail);
    if (existingUser) {
      console.log("Test user already exists:");
      console.log("  Email: test@mailsift.com");
      console.log("  Password: test123");
      process.exit(0);
      return;
    }
    
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const userData: InsertUser = {
      email: testEmail,
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
    };
    
    const user = await storage.createUser(userData);
    
    console.log("Test user created successfully!");
    console.log("  ID: " + user.id);
    console.log("  Email: test@mailsift.com");
    console.log("  Password: test123");
    console.log("  Plan: " + user.plan);
    
  } catch (error) {
    console.error("Failed to seed test user:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedTestUser();
