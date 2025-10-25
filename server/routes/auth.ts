import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { IStorage } from "../storage";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function createAuthRoutes(storage: IStorage) {
  const router = Router();

  // Register new user
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.errors 
        });
      }

      const { email, password, username } = parsed.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        username: username || email.split('@')[0],
      });

      // Create session
      if (req.session) {
        req.session.userId = user.id;
        await new Promise<void>((resolve, reject) => {
          req.session!.save((err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ 
        message: "Account created successfully",
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.errors 
        });
      }

      const { email, password } = parsed.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      if (req.session) {
        req.session.userId = user.id;
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        message: "Login successful",
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout
  router.post("/logout", (req: Request, res: Response) => {
    if (req.session) {
      req.session.destroy((err: Error | null) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } else {
      res.json({ message: "No active session" });
    }
  });

  // Owner/Demo access - special login for app owner
  router.post("/owner-login", async (req: Request, res: Response) => {
    try {
      const { ownerKey } = req.body;
      
      // Owner key is set via environment variable
      const validOwnerKey = process.env.OWNER_KEY || 'codedswitch-owner-2024';
      
      if (ownerKey !== validOwnerKey) {
        return res.status(401).json({ message: "Invalid owner key" });
      }

      // Create or get owner user
      const ownerEmail = 'owner@codedswitch.local';
      let ownerUser = await storage.getUser('owner-user');
      
      if (!ownerUser) {
        // Create owner user if it doesn't exist
        const hashedPassword = await bcrypt.hash(validOwnerKey, 10);
        ownerUser = await storage.createUser({
          email: ownerEmail,
          password: hashedPassword,
          username: 'CodedSwitch Owner'
        });
      }

      // Create session
      if (req.session) {
        req.session.userId = ownerUser.id;
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = ownerUser;
      res.json({ 
        message: "Login successful",
        user: userWithoutPassword,
        isOwner: false
      });
    } catch (error) {
      console.error("Special access login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  router.get("/me", async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  return router;
}
