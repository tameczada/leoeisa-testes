import { Router, Request, Response } from "express";
import crypto from "crypto";
import { buildAuthUrl, exchangeCode, fetchTwitchUser, upsertUser } from "../lib/twitch";

const router = Router();

// GET /auth/twitch — redirect to Twitch
router.get("/twitch", (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  res.redirect(buildAuthUrl(state));
});

// GET /auth/twitch/callback — Twitch redirects here
router.get("/twitch/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.redirect("/?error=twitch_denied");

  if (!state || state !== req.session.oauthState) {
    return res.redirect("/?error=invalid_state");
  }
  delete req.session.oauthState;

  try {
    const token = await exchangeCode(code);
    const twitchUser = await fetchTwitchUser(token);
    const user = await upsertUser(twitchUser);

    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.username = user.username;
    req.session.displayName = user.displayName;
    req.session.profileImage = user.profileImage ?? undefined;

    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=oauth_failed");
  }
});

// POST /auth/logout
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

export default router;
