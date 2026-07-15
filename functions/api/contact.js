const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_PRODUCT_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_OPTIONAL_FIELD_LENGTH = 160;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_ERROR = "Unable to send your inquiry right now. Please try again.";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * 处理询盘表单提交。
 * 入参：Cloudflare Pages Function 上下文，包含 request 和 env。
 * 出参：JSON Response，成功时返回 ok=true，失败时返回明确错误信息。
 */
export async function onRequestPost(context) {
  try {
    const requestBody = await readJsonBody(context.request);
    const contactMessage = validateContactMessage(requestBody);
    validateEmailEnvironment(context.env);

    const resendResponse = await sendContactEmail(context.env, contactMessage);

    if (!resendResponse.ok) {
      throw new PublicError(DELIVERY_ERROR, "DELIVERY_FAILED", 500);
    }

    return Response.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return Response.json(
      {
        ok: false,
        code: getErrorCode(error),
        message: error.message,
      },
      {
        status: statusCode,
        headers: jsonHeaders,
      },
    );
  }
}

class PublicError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * 处理浏览器预检请求。
 * 入参：无业务入参。
 * 出参：允许 POST 的空响应。
 */
export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }

  return request.json();
}

function validateContactMessage(body) {
  const contactMessage = {
    name: normalizeRequiredText(body.name, "Name", MAX_NAME_LENGTH),
    email: normalizeRequiredText(body.email, "Email", MAX_EMAIL_LENGTH),
    company: normalizeOptionalText(body.company, MAX_OPTIONAL_FIELD_LENGTH),
    phone: normalizeOptionalText(body.phone, MAX_OPTIONAL_FIELD_LENGTH),
    country: normalizeOptionalText(body.country, MAX_OPTIONAL_FIELD_LENGTH),
    product: normalizeRequiredText(body.product, "Product interest", MAX_PRODUCT_LENGTH),
    wasteType: normalizeOptionalText(body.wasteType, MAX_OPTIONAL_FIELD_LENGTH),
    capacity: normalizeOptionalText(body.capacity, MAX_OPTIONAL_FIELD_LENGTH),
    siteArea: normalizeOptionalText(body.siteArea, MAX_OPTIONAL_FIELD_LENGTH),
    message: normalizeRequiredText(body.message, "Project details", MAX_MESSAGE_LENGTH),
  };

  if (!EMAIL_PATTERN.test(contactMessage.email)) {
    throw new Error("Email format is invalid");
  }

  return contactMessage;
}

function normalizeOptionalText(value, maxLength) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error("Optional field format is invalid");
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    throw new Error("Optional field is too long");
  }

  return normalizedValue;
}

function normalizeRequiredText(value, fieldName, maxLength) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }

  return normalizedValue;
}

function validateEmailEnvironment(env) {
  const requiredKeys = [
    "RESEND_API_KEY",
    "CONTACT_TO_EMAIL",
    "CONTACT_FROM_EMAIL",
  ];

  for (const requiredKey of requiredKeys) {
    if (!env[requiredKey]) {
      throw new Error(`Missing Cloudflare environment variable: ${requiredKey}`);
    }
  }
}

function sendContactEmail(env, contactMessage) {
  const emailPayload = {
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    reply_to: contactMessage.email,
    subject: `WEI LAN website inquiry - ${contactMessage.product}`,
    html: buildHtmlEmail(contactMessage),
    text: buildPlainTextEmail(contactMessage),
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

function buildHtmlEmail(contactMessage) {
  return [
    "<strong>New WEI LAN website inquiry</strong><br>",
    `<strong>Name:</strong> ${escapeHtml(contactMessage.name)}<br>`,
    `<strong>Email:</strong> ${escapeHtml(contactMessage.email)}<br>`,
    formatOptionalHtmlLine("Company", contactMessage.company),
    formatOptionalHtmlLine("Phone", contactMessage.phone),
    formatOptionalHtmlLine("Country / Region", contactMessage.country),
    `<strong>Product interest:</strong> ${escapeHtml(contactMessage.product)}<br><br>`,
    formatOptionalHtmlLine("Waste type", contactMessage.wasteType),
    formatOptionalHtmlLine("Target capacity", contactMessage.capacity),
    formatOptionalHtmlLine("Available site area", contactMessage.siteArea),
    "<strong>Project details:</strong><br>",
    escapeHtml(contactMessage.message).replace(/\n/g, "<br>"),
  ].join("");
}

function buildPlainTextEmail(contactMessage) {
  const lines = [
    "New WEI LAN website inquiry",
    "",
    `Name: ${contactMessage.name}`,
    `Email: ${contactMessage.email}`,
    formatOptionalPlainLine("Company", contactMessage.company),
    formatOptionalPlainLine("Phone", contactMessage.phone),
    formatOptionalPlainLine("Country / Region", contactMessage.country),
    `Product interest: ${contactMessage.product}`,
    formatOptionalPlainLine("Waste type", contactMessage.wasteType),
    formatOptionalPlainLine("Target capacity", contactMessage.capacity),
    formatOptionalPlainLine("Available site area", contactMessage.siteArea),
    "",
    "Project details:",
    contactMessage.message,
  ].filter(Boolean);

  return lines.join("\n");
}

function getErrorStatusCode(error) {
  if (error instanceof PublicError) return error.status;
  const validationMessages = [
    "Content-Type must be application/json",
    "Name is required",
    "Email is required",
    "Product interest is required",
    "Project details is required",
    "Email format is invalid",
    "Optional field format is invalid",
  ];

  if (validationMessages.includes(error.message) || error.message.endsWith("is too long")) {
    return 400;
  }

  return 500;
}

function getErrorCode(error) {
  if (error instanceof PublicError) return error.code;

  const codes = new Map([
    ["Content-Type must be application/json", "INVALID_REQUEST"],
    ["Name is required", "NAME_REQUIRED"],
    ["Email is required", "EMAIL_REQUIRED"],
    ["Email format is invalid", "EMAIL_INVALID"],
    ["Product interest is required", "PRODUCT_REQUIRED"],
    ["Project details is required", "MESSAGE_REQUIRED"],
    ["Optional field format is invalid", "INVALID_REQUEST"],
  ]);

  if (codes.has(error.message)) return codes.get(error.message);
  if (error.message.endsWith("is too long")) return "FIELD_TOO_LONG";
  if (error.message.startsWith("Missing Cloudflare environment variable:")) return "INTERNAL_ERROR";
  return "INTERNAL_ERROR";
}

function formatOptionalHtmlLine(label, value) {
  if (!value) {
    return "";
  }

  return `<strong>${label}:</strong> ${escapeHtml(value)}<br>`;
}

function formatOptionalPlainLine(label, value) {
  if (!value) {
    return "";
  }

  return `${label}: ${value}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
