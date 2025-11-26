declare namespace Express {
  interface Request {
    userId?: string;
    isOwner?: boolean;
    creditCost?: number;
    creditService?: any;
    creditInfinite?: boolean;

    user?: { id: string; email?: string };
    session?: any;
  }
}
