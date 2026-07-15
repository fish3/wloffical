const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_COMPANY_LENGTH = 160;
const MAX_RESOURCE_LENGTH = 120;
const MAX_SOURCE_PATH_LENGTH = 240;
const DELIVERY_ERROR = "Unable to unlock resources right now. Please try again.";
const ALLOWED_RESOURCES = new Map([
  ["Project Inquiry Checklist", "/resources/project-inquiry-checklist"],
]);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

class PublicError extends Error {
  constructor(message, code = "INVALID_REQUEST", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function onRequestPost(context) {
  try {
    validateRequestOrigin(context.request);
    const requestBody = await readJsonBody(context.request);
    const resourceLead = validateResourceLead(requestBody);
    validateEmailEnvironment(context.env);

    const resendResponse = await sendResourceLead(context.env, resourceLead);

    if (!resendResponse.ok) {
      throw new PublicError(DELIVERY_ERROR, "DELIVERY_FAILED", 500);
    }

    return Response.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof PublicError ? error.status : 500;
    const message = error instanceof PublicError ? error.message : DELIVERY_ERROR;
    const code = error instanceof PublicError ? error.code : "DELIVERY_FAILED";

    return Response.json(
      { ok: false, code, message },
      { status, headers: jsonHeaders },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function validateRequestOrigin(request) {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return;
  }

  let normalizedOrigin;
  try {
    normalizedOrigin = new URL(requestOrigin).origin;
  } catch {
    throw new PublicError("Request origin is not allowed", "INVALID_ORIGIN", 403);
  }

  if (normalizedOrigin !== new URL(request.url).origin) {
    throw new PublicError("Request origin is not allowed", "INVALID_ORIGIN", 403);
  }
}

async function readJsonBody(request) {
  const contentType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new PublicError("Content-Type must be application/json", "INVALID_REQUEST");
  }

  try {
    return await request.json();
  } catch {
    throw new PublicError("Request body must be valid JSON", "INVALID_REQUEST");
  }
}

function validateResourceLead(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicError("Request body must be a JSON object", "INVALID_REQUEST");
  }

  const resourceLead = {
    name: normalizeRequiredText(body.name, "Name", "NAME_REQUIRED", MAX_NAME_LENGTH),
    email: normalizeRequiredText(body.email, "Email", "EMAIL_REQUIRED", MAX_EMAIL_LENGTH),
    company: normalizeRequiredText(body.company, "Company", "COMPANY_REQUIRED", MAX_COMPANY_LENGTH),
    resource: normalizeRequiredText(body.resource, "Resource", "INVALID_RESOURCE", MAX_RESOURCE_LENGTH),
    sourcePath: normalizeRequiredText(body.sourcePath, "Source path", "INVALID_RESOURCE", MAX_SOURCE_PATH_LENGTH),
  };

  if (!EMAIL_PATTERN.test(resourceLead.email)) {
    throw new PublicError("Email format is invalid", "EMAIL_INVALID");
  }

  if (ALLOWED_RESOURCES.get(resourceLead.resource) !== resourceLead.sourcePath) {
    throw new PublicError("Resource selection is invalid", "INVALID_RESOURCE");
  }

  return resourceLead;
}

function normalizeRequiredText(value, fieldName, requiredCode, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicError(`${fieldName} is required`, requiredCode);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new PublicError(`${fieldName} is too long`, "FIELD_TOO_LONG");
  }

  return normalizedValue;
}

function validateEmailEnvironment(env) {
  for (const key of ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) {
    if (!env[key]) {
      throw new PublicError(DELIVERY_ERROR, "DELIVERY_FAILED", 500);
    }
  }
}

function sendResourceLead(env, resourceLead) {
  const emailPayload = {
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    reply_to: resourceLead.email,
    subject: `WEI LAN resource unlock - ${resourceLead.resource}`,
    html: buildHtmlEmail(resourceLead),
    text: buildPlainTextEmail(resourceLead),
  };

  return fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });
}

function buildHtmlEmail(resourceLead) {
  return [
    "<strong>New WEI LAN resource unlock lead</strong><br>",
    `<strong>Name:</strong> ${escapeHtml(resourceLead.name)}<br>`,
    `<strong>Work email:</strong> ${escapeHtml(resourceLead.email)}<br>`,
    `<strong>Company:</strong> ${escapeHtml(resourceLead.company)}<br>`,
    `<strong>Resource:</strong> ${escapeHtml(resourceLead.resource)}<br>`,
    `<strong>Source page:</strong> ${escapeHtml(resourceLead.sourcePath)}<br>`,
  ].join("");
}

function buildPlainTextEmail(resourceLead) {
  return [
    "New WEI LAN resource unlock lead",
    "",
    `Name: ${resourceLead.name}`,
    `Work email: ${resourceLead.email}`,
    `Company: ${resourceLead.company}`,
    `Resource: ${resourceLead.resource}`,
    `Source page: ${resourceLead.sourcePath}`,
  ].join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
