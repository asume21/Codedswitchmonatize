declare namespace Express {
  interface Request {
    userId?: string;

    user?: { id: string; email?: string };
    session?: any;
  }
}
