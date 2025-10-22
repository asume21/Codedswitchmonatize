import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";

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

  return router;
}
