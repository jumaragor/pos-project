import { createPrivateKey, createPublicKey, createSign, createVerify, JsonWebKey, X509Certificate } from "node:crypto";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { forbidden, ok, unauthorized } from "@/lib/http";

export const runtime = "nodejs";

function normalizePem(value: string | undefined) {
  return value?.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim() ?? "";
}

function qzLog(message: string, details?: Record<string, unknown>) {
  console.info("[qz-sign]", message, details ?? {});
}

function qzError(message: string, details?: Record<string, unknown>) {
  console.error("[qz-sign]", message, details ?? {});
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

function getCertificateValue() {
  const isProduction = process.env.NODE_ENV === "production";
  const certificate = isProduction
    ? normalizePem(process.env.NEXT_PUBLIC_QZ_CERTIFICATE || process.env.QZ_CERTIFICATE)
    : normalizePem(process.env.NEXT_PUBLIC_QZ_DEV_CERTIFICATE) ||
      normalizePem(process.env.NEXT_PUBLIC_QZ_CERTIFICATE || process.env.QZ_CERTIFICATE);

  if (!certificate) {
    throw new Error(
      isProduction
        ? "NEXT_PUBLIC_QZ_CERTIFICATE is not configured."
        : "NEXT_PUBLIC_QZ_DEV_CERTIFICATE is not configured."
    );
  }

  return certificate;
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

function validateCertificatePair(certificatePem: string, privateKey: ReturnType<typeof createPrivateKey>) {
  try {
    const certificate = new X509Certificate(certificatePem);
    const publicKey = createPublicKey(certificate.publicKey);
    const probe = "qz-signature-validation";

    const signer = createSign("RSA-SHA1");
    signer.update(probe, "utf8");
    signer.end();
    const signature = signer.sign(privateKey);

    const verifier = createVerify("RSA-SHA1");
    verifier.update(probe, "utf8");
    verifier.end();

    if (!verifier.verify(publicKey, signature)) {
      throw new Error("QZ certificate does not match QZ private key.");
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `QZ certificate/private key validation failed: ${error.message}`
        : "QZ certificate/private key validation failed."
    );
  }
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
    qzError("missing-payload");
    return Response.json({ error: "Missing QZ payload to sign." }, { status: 400 });
  }

  try {
    const certificatePem = getCertificateValue();
    const privateKey = getSigningKey();
    validateCertificatePair(certificatePem, privateKey);

    const signer = createSign("RSA-SHA1");
    signer.update(payload, "utf8");
    signer.end();

    qzLog("signature-generated", {
      payloadLength: payload.length,
      mode: process.env.NODE_ENV
    });

    return ok({
      signature: signer.sign(privateKey, "base64")
    });
  } catch (error) {
    qzError("signature-generation-failed", {
      error: error instanceof Error ? error.message : "Unknown signing error",
      hasPrivateKey: Boolean(
        process.env.NODE_ENV === "production"
          ? process.env.QZ_PRIVATE_KEY
          : process.env.QZ_DEV_PRIVATE_KEY || process.env.QZ_PRIVATE_KEY
      ),
      hasCertificate: Boolean(
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_QZ_CERTIFICATE || process.env.QZ_CERTIFICATE
          : process.env.NEXT_PUBLIC_QZ_DEV_CERTIFICATE ||
              process.env.NEXT_PUBLIC_QZ_CERTIFICATE ||
              process.env.QZ_CERTIFICATE
      )
    });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sign QZ request."
      },
      { status: 500 }
    );
  }
}
