export function encodeRawEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): string {
  const lines = [
    ...(opts.from ? [`From: ${opts.from}`] : []),
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    opts.body,
  ];
  const message = lines.join("\r\n");
  const base64 = Buffer.from(message, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

export type EmailBodyMimeType = "text/plain" | "text/html";

export type ExtractedEmailBody = {
  body: string;
  bodyMimeType: EmailBodyMimeType;
};

export function looksLikeHtml(value: string): boolean {
  return /<\/?(?:a|blockquote|br|div|h[1-6]|li|ol|p|span|strong|table|td|th|tr|ul)\b/i.test(
    value,
  );
}

function collectBodyParts(
  payload: GmailPart | undefined,
  bodies: { plain: string[]; html: string[]; other: string[] },
) {
  if (!payload) return;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    bodies.plain.push(decodeBase64Url(payload.body.data));
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    bodies.html.push(decodeBase64Url(payload.body.data));
  } else if (payload.body?.data) {
    bodies.other.push(decodeBase64Url(payload.body.data));
  }

  for (const part of payload.parts ?? []) {
    collectBodyParts(part, bodies);
  }
}

export function extractBodyFromPayload(
  payload?: GmailPart,
): ExtractedEmailBody {
  const bodies = {
    plain: [] as string[],
    html: [] as string[],
    other: [] as string[],
  };
  collectBodyParts(payload, bodies);

  const html = bodies.html.find(Boolean);
  if (html) {
    return {
      body: html,
      bodyMimeType: "text/html",
    };
  }

  const plain = bodies.plain.find(Boolean) ?? bodies.other.find(Boolean) ?? "";
  const bodyMimeType = looksLikeHtml(plain) ? "text/html" : "text/plain";

  return {
    body: plain,
    bodyMimeType,
  };
}

export function getHeader(
  headers: { name?: string; value?: string }[] | undefined,
  name: string,
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}
