const siteHeader = document.querySelector("[data-header]");
const contactForm = document.querySelector("[data-contact-form]");
const contactStatus = document.querySelector("[data-contact-status]");

function updateHeaderBackground() {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
}

updateHeaderBackground();
window.addEventListener("scroll", updateHeaderBackground, { passive: true });

/**
 * 提交 Cloudflare Pages 询盘接口。
 * 入参：浏览器表单提交事件。
 * 出参：无返回值，页面展示提交状态。
 */
async function submitContactForm(event) {
  event.preventDefault();

  if (!contactForm || !contactStatus) {
    return;
  }

  const submitButton = contactForm.querySelector("button[type='submit']");
  const formData = new FormData(contactForm);
  const payload = Object.fromEntries(formData.entries());

  contactStatus.textContent = "Sending your inquiry...";
  submitButton.disabled = true;

  try {
    const response = await fetch(contactForm.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Inquiry submission failed");
    }

    contactForm.reset();
    contactStatus.textContent = "Inquiry sent. Our sales team will contact you soon.";
  } catch (error) {
    contactStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

if (contactForm) {
  contactForm.addEventListener("submit", submitContactForm);
}
