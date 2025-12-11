import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../db";

async function createTestUser() {
  const { users } = await connectToDatabase();
  
  const email = "test@milkthelink.com";
  const password = "test123";
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const existingUser = await users.findOne({ email });
  if (existingUser) {
    await users.updateOne(
      { email },
      { 
        $set: { 
          password: hashedPassword,
          plan: "premium",
          isEmailVerified: true,
          firstName: "Test",
          lastName: "User",
          emailsExtracted: 0,
          linksScanned: 0,
          shopifyStoresUsedToday: 0
        } 
      }
    );
    console.log("Test user updated with new password and premium plan");
  } else {
    const id = new ObjectId().toString();
    const now = new Date();
    
    await users.insertOne({
      _id: id,
      email,
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      plan: "premium",
      emailsExtracted: 0,
      linksScanned: 0,
      shopifyStoresUsedToday: 0,
      isEmailVerified: true,
      createdAt: now,
    });
    console.log("Test user created with premium plan");
  }
  
  console.log("Email: test@milkthelink.com");
  console.log("Password: test123");
  console.log("Plan: Premium");
  
  process.exit(0);
}

createTestUser().catch(console.error);
