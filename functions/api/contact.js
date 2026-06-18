const POSTMARK_API_URL = "https://api.postmarkapp.com/email";
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_PRODUCT_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 3000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const postmarkResponse = await sendContactEmail(context.env, contactMessage);

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      throw new Error(`Postmark email delivery failed: ${errorText}`);
    }

    return Response.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    return Response.json(
      {
        ok: false,
        message: error.message,
      },
      {
        status: statusCode,
        headers: jsonHeaders,
      },
    );
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
    product: normalizeRequiredText(body.product, "Product interest", MAX_PRODUCT_LENGTH),
    message: normalizeRequiredText(body.message, "Project details", MAX_MESSAGE_LENGTH),
  };

  if (!EMAIL_PATTERN.test(contactMessage.email)) {
    throw new Error("Email format is invalid");
  }

  return contactMessage;
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
    "POSTMARK_SERVER_TOKEN",
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
    From: env.CONTACT_FROM_EMAIL,
    To: env.CONTACT_TO_EMAIL,
    Subject: `WEI LAN website inquiry - ${contactMessage.product}`,
    HtmlBody: buildHtmlEmail(contactMessage),
    TextBody: buildPlainTextEmail(contactMessage),
    MessageStream: env.POSTMARK_MESSAGE_STREAM || "website-contact-inquiries",
  };

  return fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify(emailPayload),
  });
}

function buildHtmlEmail(contactMessage) {
  return [
    "<strong>New WEI LAN website inquiry</strong><br>",
    `<strong>Name:</strong> ${escapeHtml(contactMessage.name)}<br>`,
    `<strong>Email:</strong> ${escapeHtml(contactMessage.email)}<br>`,
    `<strong>Product interest:</strong> ${escapeHtml(contactMessage.product)}<br><br>`,
    "<strong>Project details:</strong><br>",
    escapeHtml(contactMessage.message).replace(/\n/g, "<br>"),
  ].join("");
}

function buildPlainTextEmail(contactMessage) {
  return [
    "New WEI LAN website inquiry",
    "",
    `Name: ${contactMessage.name}`,
    `Email: ${contactMessage.email}`,
    `Product interest: ${contactMessage.product}`,
    "",
    "Project details:",
    contactMessage.message,
  ].join("\n");
}

function getErrorStatusCode(error) {
  const validationMessages = [
    "Content-Type must be application/json",
    "Name is required",
    "Email is required",
    "Product interest is required",
    "Project details is required",
    "Email format is invalid",
  ];

  if (validationMessages.includes(error.message) || error.message.endsWith("is too long")) {
    return 400;
  }

  return 500;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
