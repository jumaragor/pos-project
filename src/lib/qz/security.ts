const DEV_MODE = process.env.NODE_ENV !== "production";

function normalizePem(value: string | undefined) {
  return value?.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim() ?? "";
}

export function getQzCertificate() {
  const certificate = DEV_MODE
    ? normalizePem(process.env.NEXT_PUBLIC_QZ_DEV_CERTIFICATE) ||
      normalizePem(process.env.NEXT_PUBLIC_QZ_CERTIFICATE)
    : normalizePem(process.env.NEXT_PUBLIC_QZ_CERTIFICATE);

  if (!certificate) {
    throw new Error(
      DEV_MODE
        ? "QZ certificate is not configured. Set NEXT_PUBLIC_QZ_DEV_CERTIFICATE."
        : "QZ certificate is not configured. Set NEXT_PUBLIC_QZ_CERTIFICATE."
    );
  }

  return certificate;
}

export async function requestQzSignature(payload: string) {
  const response = await fetch("/api/qz/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload })
  });

  const responseText = await response.text();
  const body = (responseText ? JSON.parse(responseText) : {}) as Record<string, unknown>;
  const bodyError = typeof body.error === "string" ? body.error : undefined;
  const signature = typeof body.signature === "string" ? body.signature : undefined;

  if (!response.ok) {
    const errorMessage =
      bodyError
        ? bodyError
        : responseText || `Failed to sign QZ request (HTTP ${response.status}).`;
    throw new Error(errorMessage);
  }

  if (!signature) {
    throw new Error("QZ signing route returned no signature.");
  }

  return signature;
}

export function applyQzSecurity(qz: {
  security?: {
    setCertificatePromise?: (factory: (...args: unknown[]) => unknown) => void;
    setSignaturePromise?: (factory: (...args: unknown[]) => unknown) => void;
  };
}) {
  if (!qz.security) {
    throw new Error("QZ security API is unavailable.");
  }

  qz.security.setCertificatePromise?.(
    ((resolve: (value?: string) => void, reject: (reason?: unknown) => void) => {
      try {
        resolve(getQzCertificate());
      } catch (error) {
        reject(error);
      }
    }) as (...args: unknown[]) => unknown
  );

  qz.security.setSignaturePromise?.(
    ((toSign: string) => {
      return async (
        resolve: (value?: string) => void,
        reject: (reason?: unknown) => void
      ) => {
        try {
          const signature = await requestQzSignature(toSign);
          resolve(signature);
        } catch (error) {
          reject(error);
        }
      };
    }) as (...args: unknown[]) => unknown
  );
}
