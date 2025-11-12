import type { IStorage } from "./storage";

let guestUserIdPromise: Promise<string> | null = null;

/**
 * Ensures a guest user exists in the database and returns its ID.
 * This is memoized so the lookup/creation only happens once per server instance.
 */
export async function ensureGuestUser(storage: IStorage): Promise<string> {
  if (!guestUserIdPromise) {
    guestUserIdPromise = (async () => {
      const GUEST_EMAIL = 'guest@codedswitch.local';
      const GUEST_USERNAME = 'guest';
      
      try {
        // Try to find existing guest user
        const existingUser = await storage.getUserByEmail(GUEST_EMAIL);
        if (existingUser) {
          console.log('✅ Found existing guest user:', existingUser.id);
          return existingUser.id;
        }
      } catch (error) {
        // User doesn't exist, will create below
      }
      
      // Create guest user
      try {
        const guestUser = await storage.createUser({
          username: GUEST_USERNAME,
          email: GUEST_EMAIL,
          password: '', // Not used for guest
        });
        console.log('✅ Created guest user:', guestUser.id);
        return guestUser.id;
      } catch (error) {
        // If creation fails (e.g., race condition), try to fetch again
        const user = await storage.getUserByEmail(GUEST_EMAIL);
        if (user) {
          console.log('✅ Guest user created by another process:', user.id);
          return user.id;
        }
        throw new Error('Failed to ensure guest user exists');
      }
    })();
  }
  
  return guestUserIdPromise;
}

/**
 * Get the guest user ID (call this in routes for anonymous uploads)
 */
export async function getGuestUserId(storage: IStorage): Promise<string> {
  return ensureGuestUser(storage);
}
