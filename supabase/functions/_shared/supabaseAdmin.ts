import { createClient } from "npm:@supabase/supabase-js@2";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}

export function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function getAuthenticatedUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Authenticated user not found.");
  }

  return data.user;
}
