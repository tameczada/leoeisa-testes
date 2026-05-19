import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
    username: string;
    displayName: string;
    profileImage?: string;
    oauthState?: string;
  }
}
