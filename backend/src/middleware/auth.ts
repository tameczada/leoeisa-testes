import { Request, Response, NextFunction } from "express";

function isApiRequest(req: Request): boolean {
  return (
    req.headers.accept?.includes("application/json") ||
    req.headers["content-type"]?.includes("application/json") ||
    req.xhr ||
    req.path.startsWith("/api/")
  ) as boolean;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    if (isApiRequest(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.redirect("/?error=auth");
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.isAdmin) {
    if (isApiRequest(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.redirect("/?error=forbidden");
  }
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  next();
}
