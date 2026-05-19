import { prisma } from "./prisma";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI!;

export const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
export const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
export const TWITCH_USER_URL = "https://api.twitch.tv/helix/users";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: "code",
    scope: "user:read:email",
    state,
  });
  return `${TWITCH_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: TWITCH_REDIRECT_URI,
  });

  const res = await fetch(`${TWITCH_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
  });

  const data = await res.json();

  console.log("TWITCH TOKEN RESPONSE:", data);

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export async function fetchTwitchUser(token: string): Promise<TwitchUser> {
  const res = await fetch(TWITCH_USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch Twitch user");
  const data = (await res.json()) as { data: TwitchUser[] };
  return data.data[0];
}

export async function upsertUser(twitchUser: TwitchUser) {
  return prisma.user.upsert({
    where: { twitchId: twitchUser.id },
    update: {
      username: twitchUser.login,
      displayName: twitchUser.display_name,
      profileImage: twitchUser.profile_image_url,
    },
    create: {
      twitchId: twitchUser.id,
      username: twitchUser.login,
      displayName: twitchUser.display_name,
      profileImage: twitchUser.profile_image_url,
    },
  });
}
