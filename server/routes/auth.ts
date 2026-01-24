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
        user: userWithoutPassword,
        userId: user.id,
        token: `Bearer ${user.id}`
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
        user: userWithoutPassword,
        userId: user.id,
        token: `Bearer ${user.id}` // Frontend should send this in Authorization header
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
      
      // Owner key MUST be set via environment variable - no fallback for security
      const validOwnerKey = process.env.OWNER_KEY;
      
      if (!validOwnerKey) {
        console.error('🚨 SECURITY: OWNER_KEY not set in environment');
        return res.status(500).json({ message: "Server configuration error" });
      }
      
      if (ownerKey !== validOwnerKey) {
        return res.status(401).json({ message: "Invalid owner key" });
      }

      // Create or get owner user
      const ownerEmail = 'owner@codedswitch.local';
      const ownerUsername = 'codedswitch-owner';
      let ownerUser = await storage.getUserByEmail(ownerEmail);

      if (!ownerUser) {
        // Create owner user if it doesn't exist
        const hashedPassword = await bcrypt.hash(validOwnerKey, 10);
        try {
          ownerUser = await storage.createUser({
            email: ownerEmail,
            password: hashedPassword,
            username: ownerUsername
          });
        } catch (creationError: unknown) {
          const message = creationError instanceof Error ? creationError.message : String(creationError);

          // If another process already created the owner (unique constraint), fetch it now.
          if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
            ownerUser = await storage.getUserByEmail(ownerEmail);
          } else {
            throw creationError;
          }
        }
      }

      if (!ownerUser) {
        throw new Error("Owner user could not be created or loaded");
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
        isOwner: true
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
        return res.status(401).json({ message: "Not authenticated" });
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
