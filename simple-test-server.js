import express from "express";
import { registerRoutes } from "./server/routes";
import { MemStorage } from "./server/storage";
import { currentUser } from "./server/middleware/auth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Attach current user middleware (dev falls back to default user)
const storage = new MemStorage();
app.use(currentUser(storage));

// Register routes
await registerRoutes(app, storage);

// ALWAYS serve the app on the port specified in the environment variable PORT
// Other ports are firewalled. Default to 5000 if not specified.
const port = parseInt(process.env.PORT || '5000', 10);
app.listen(port, "localhost", () => {
  console.log(`Simple test server listening on http://localhost:${port}`);
});
