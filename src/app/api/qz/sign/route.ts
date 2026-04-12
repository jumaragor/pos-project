import { createPrivateKey, createSign, JsonWebKey } from "node:crypto";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { forbidden, ok, unauthorized } from "@/lib/http";

export const runtime = "nodejs";

function normalizePem(value: string | undefined) {
  return value?.replace(/\\n/g, "\n").trim() ?? "";
}

function parseKeyValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed) as JsonWebKey;
  } catch {
    throw new Error("QZ signing key is not valid JSON.");
  }
}

function getSigningKey() {
  const isProduction = process.env.NODE_ENV === "production";
  const privateKey = isProduction
    ? process.env.QZ_PRIVATE_KEY?.trim() ?? ""
    : process.env.QZ_DEV_PRIVATE_KEY?.trim() || process.env.QZ_PRIVATE_KEY?.trim() || "";
  const passphrase = isProduction
    ? process.env.QZ_PRIVATE_KEY_PASSPHRASE
    : process.env.QZ_DEV_PRIVATE_KEY_PASSPHRASE ?? process.env.QZ_PRIVATE_KEY_PASSPHRASE;

  if (!privateKey) {
    throw new Error(
      isProduction
        ? "QZ_PRIVATE_KEY is not configured."
        : "QZ_DEV_PRIVATE_KEY is not configured."
    );
  }

  const parsedKey = parseKeyValue(privateKey);

  if (typeof parsedKey === "string") {
    return createPrivateKey(
      passphrase
        ? {
            key: normalizePem(parsedKey),
            passphrase
          }
        : normalizePem(parsedKey)
    );
  }

  return createPrivateKey({
    key: parsedKey,
    format: "jwk"
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return unauthorized();
  }
  if (!["OWNER", "MANAGER", "CASHIER"].includes(user.role)) {
    return forbidden();
  }

  const body = (await request.json().catch(() => null)) as { payload?: unknown } | null;
  const payload = typeof body?.payload === "string" ? body.payload : "";

  if (!payload) {
    return Response.json({ error: "Missing QZ payload to sign." }, { status: 400 });
  }

  try {
    const signer = createSign("RSA-SHA1");
    signer.update(payload, "utf8");
    signer.end();

    return ok({
      signature: signer.sign(getSigningKey(), "base64")
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to sign QZ request."
      },
      { status: 500 }
    );
  }
}
