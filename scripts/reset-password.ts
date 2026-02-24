import postgres from "postgres";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log("Usage: npx tsx scripts/reset-password.ts <email> <new-password>");
  console.log("Example: npx tsx scripts/reset-password.ts servicehelp@codedswitch.com MyNewPass123");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.log("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.log("No DATABASE_URL set.");
  process.exit(1);
}

const sql = postgres(url);

async function run() {
  try {
    // Check user exists
    const users = await sql`SELECT id, email, username FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      console.log(`No user found with email: ${email}`);
      return;
    }

    const user = users[0];
    console.log(`Found user: ${user.username} (${user.email})`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;
    console.log(`Password updated successfully for ${user.email}`);
    console.log("You can now log in with your new password.");
  } catch (e: any) {
    console.log("Error:", e.message);
  } finally {
    await sql.end();
  }
}

run();
