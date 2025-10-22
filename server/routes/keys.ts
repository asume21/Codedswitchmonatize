import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { generateActivationKey, generateActivationKeys, validateKeyFormat } from "../services/keyGenerator";

const activateKeySchema = z.object({
  activationKey: z.string().min(1, "Activation key is required"),
});

export function createKeyRoutes(storage: IStorage) {
  const router = Router();

  // Activate a key (no auth needed - anyone can activate)
  router.post("/activate", async (req: Request, res: Response) => {
    try {
      const parsed = activateKeySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.errors 
        });
      }

      const { activationKey } = parsed.data;

      // Check if it's the owner key
      const ownerKey = process.env.OWNER_KEY || 'codedswitch-owner-2024';
      if (activationKey === ownerKey) {
        // Create or get owner user
        let ownerUser = await storage.getUser('owner-user');
        if (!ownerUser) {
          ownerUser = await storage.createUser({
            email: 'owner@codedswitch.local',
            password: 'owner-key-auth',
            username: 'CodedSwitch Owner'
          });
        }

        // Create session
        if (req.session) {
          req.session.userId = ownerUser.id;
        }

        const { password: _, ...userWithoutPassword } = ownerUser;
        return res.json({ 
          message: "Owner access activated",
          user: userWithoutPassword,
          tier: 'owner',
          isOwner: true
        });
      }

      // TODO: Check against database of valid activation keys
      // For now, return error for non-owner keys
      return res.status(401).json({ message: "Invalid activation key" });

    } catch (error) {
      console.error("Key activation error:", error);
      res.status(500).json({ message: "Failed to activate key" });
    }
  });

  // Get current key status (requires auth)
  router.get("/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isOwner = req.userId === 'owner-user';
      
      res.json({
        userId: user.id,
        email: user.email,
        username: user.username,
        tier: isOwner ? 'owner' : (user.subscriptionTier || 'free'),
        isOwner: isOwner,
        subscriptionStatus: user.subscriptionStatus || 'inactive'
      });
    } catch (error) {
      console.error("Get key status error:", error);
      res.status(500).json({ message: "Failed to get key status" });
    }
  });

  // Generate new activation keys (owner only)
  router.post("/generate", requireAuth(), async (req: Request, res: Response) => {
    try {
      // Only owner can generate keys
      if (req.userId !== 'owner-user') {
        return res.status(403).json({ message: "Only owner can generate keys" });
      }

      const schema = z.object({
        tier: z.enum(['pro', 'basic', 'trial']),
        count: z.number().min(1).max(100).optional().default(1)
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: parsed.error.errors 
        });
      }

      const { tier, count } = parsed.data;
      const keys = generateActivationKeys(count, tier);

      console.log(`🔑 Generated ${count} ${tier} activation keys`);

      res.json({
        message: `Generated ${count} activation key(s)`,
        tier: tier.toUpperCase(),
        count,
        keys,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Key generation error:", error);
      res.status(500).json({ message: "Failed to generate keys" });
    }
  });

  // Validate a key format (no auth needed)
  router.post("/validate", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        key: z.string().min(1)
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { key } = parsed.data;
      const validation = validateKeyFormat(key);

      res.json({
        key,
        ...validation
      });
    } catch (error) {
      console.error("Key validation error:", error);
      res.status(500).json({ message: "Failed to validate key" });
    }
  });

  return router;
}
