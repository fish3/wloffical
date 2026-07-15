const navHeader = document.querySelector(".site-header");
const siteHeader = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const languageSwitcher = document.querySelector("[data-language-switcher]");
const languageTrigger = document.querySelector("[data-language-trigger]");
const languageMenu = document.querySelector("[data-language-menu]");
const languageOptions = languageMenu ? [...languageMenu.querySelectorAll("a")] : [];
const resourceGate = document.querySelector("[data-resource-gate]");
const resourceUnlockForm = document.querySelector("[data-resource-unlock-form]");
const resourceUnlockStatus = document.querySelector("[data-resource-unlock-status]");
const resourceGatedContent = document.querySelector("[data-resource-gated-content]");
const resourceUnlockedHeading = document.querySelector("[data-resource-unlocked-heading]");
const RESOURCE_UNLOCK_KEY = "weilan_resources_unlocked_v1";
const contactForm = document.querySelector("[data-contact-form]");
const contactStatus = document.querySelector("[data-contact-status]");
const contactFeedbackElement = document.querySelector("#contact-feedback");
const productPicker = contactForm ? contactForm.querySelector("[data-product-picker]") : null;
const productControl = contactForm ? contactForm.querySelector("[data-product-control]") : null;
const productLabel = contactForm ? contactForm.querySelector("[data-product-label]") : null;
const productMenu = contactForm ? contactForm.querySelector("[data-product-menu]") : null;
const productOptions = contactForm ? contactForm.querySelectorAll("[data-product-option]") : [];
const productValue = contactForm ? contactForm.querySelector("[data-product-value]") : null;
const wasteTypeField = contactForm ? contactForm.querySelector("[data-waste-type-field]") : null;
const wasteTypePicker = contactForm ? contactForm.querySelector("[data-waste-picker]") : null;
const wasteTypeMenu = contactForm ? contactForm.querySelector("[data-waste-menu]") : null;
const wasteTypeControl = contactForm ? contactForm.querySelector("[data-waste-control]") : null;
const wasteTypeLabel = contactForm ? contactForm.querySelector("[data-waste-label]") : null;
const wasteTypeCustomInput = contactForm ? contactForm.querySelector("[data-waste-custom]") : null;
const wasteTypeOptions = contactForm ? contactForm.querySelector("[data-waste-options]") : null;
const wasteTypeValue = contactForm ? contactForm.querySelector("[data-waste-type-value]") : null;
const wasteTypeCustomClearButton = contactForm ? contactForm.querySelector("[data-waste-custom-clear]") : null;
const wasteTypeClearButton = contactForm ? contactForm.querySelector("[data-waste-clear]") : null;
const wasteTypeDoneButton = contactForm ? contactForm.querySelector("[data-waste-done]") : null;

let contactFeedback = {};
try {
  contactFeedback = JSON.parse(contactFeedbackElement?.textContent || "{}");
} catch {
  contactFeedback = {};
}
const resourceFeedback = contactFeedback.resourceUnlock || {};

class ResourceUnlockResponseError extends Error {}

const WASTE_TYPE_OPTIONS_BY_PRODUCT = {
  "AI optical sorting center": [
    "PET bottles",
    "HDPE bottles",
    "PP plastics",
    "Mixed recyclable plastics",
    "Plastic film",
    "Color-separated plastics",
  ],
  "Construction and bulky waste recycling line": [
    "Construction waste",
    "Decoration waste",
    "Demolition waste",
    "Bulky waste",
    "Light mixed waste",
    "Recycled aggregate feed",
  ],
  "Both systems": [
    "PET bottles",
    "HDPE bottles",
    "PP plastics",
    "Mixed recyclable plastics",
    "Plastic film",
    "Color-separated plastics",
    "Construction waste",
    "Decoration waste",
    "Demolition waste",
    "Bulky waste",
    "Light mixed waste",
    "Recycled aggregate feed",
  ],
};

const DEFAULT_WASTE_TYPE_OPTIONS = [
  "PET bottles",
  "HDPE bottles",
  "Construction waste",
  "Bulky waste",
];

const WASTE_TYPE_DISABLED_LABEL = contactFeedback.wasteDisabled || "Select product line first";
const WASTE_TYPE_PLACEHOLDER_LABEL = contactFeedback.wastePlaceholder || "Select waste types";

let selectedWasteTypes = [];
let customWasteTypeOptions = [];
let resourceUnlockSubmitting = false;

function updateHeaderBackground() {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
}

updateHeaderBackground();
window.addEventListener("scroll", updateHeaderBackground, { passive: true });

function setMobileNavOpen(isOpen) {
  if (!navHeader || !navToggle || !mobileNav) {
    return;
  }

  mobileNav.hidden = !isOpen;
  navHeader.classList.toggle("is-nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? navToggle.dataset.closeLabel : navToggle.dataset.openLabel);

  if (isOpen) {
    setLanguageMenuOpen(false);
  }
}

function closeMobileNav() {
  setMobileNavOpen(false);
}

if (navHeader && navToggle && mobileNav) {
  navToggle.addEventListener("click", () => {
    setMobileNavOpen(mobileNav.hidden);
  });

  mobileNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMobileNav();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (mobileNav.hidden || !(event.target instanceof Node)) {
      return;
    }

    if (!navHeader.contains(event.target)) {
      closeMobileNav();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 921px)").matches) {
      closeMobileNav();
    }
  });
}

function setLanguageMenuOpen(isOpen, focusTarget = null) {
  if (!languageSwitcher || !languageTrigger || !languageMenu) {
    return;
  }

  languageMenu.hidden = !isOpen;
  languageSwitcher.classList.toggle("is-open", isOpen);
  languageTrigger.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    closeMobileNav();
    if (focusTarget === "first") languageOptions[0]?.focus();
    if (focusTarget === "last") languageOptions.at(-1)?.focus();
  }
}

function closeLanguageMenu({ returnFocus = false } = {}) {
  setLanguageMenuOpen(false);
  if (returnFocus) languageTrigger?.focus();
}

if (languageSwitcher && languageTrigger && languageMenu) {
  languageTrigger.addEventListener("click", () => {
    setLanguageMenuOpen(languageMenu.hidden);
  });

  languageTrigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setLanguageMenuOpen(true, event.key === "ArrowDown" ? "first" : "last");
    }
  });

  languageMenu.addEventListener("keydown", (event) => {
    const currentIndex = languageOptions.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % languageOptions.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + languageOptions.length) % languageOptions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = languageOptions.length - 1;

    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      languageOptions[nextIndex]?.focus();
    }
  });

  languageMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeLanguageMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !languageMenu.hidden) {
      event.preventDefault();
      closeLanguageMenu({ returnFocus: true });
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!languageMenu.hidden && event.target instanceof Node && !languageSwitcher.contains(event.target)) {
      closeLanguageMenu();
    }
  });
}

function unlockResourceGate({ moveFocus = false } = {}) {
  if (!resourceGate || !resourceGatedContent) return;

  resourceGate.dataset.resourceState = "unlocked";
  resourceGatedContent.removeAttribute("inert");
  resourceGatedContent.setAttribute("aria-hidden", "false");
  document.documentElement.dataset.resourcesUnlocked = "true";
  if (moveFocus) resourceUnlockedHeading?.focus();
}

if (resourceGate && resourceUnlockForm && resourceGatedContent) {
  try {
    if (localStorage.getItem(RESOURCE_UNLOCK_KEY) === "true") unlockResourceGate();
  } catch {
    // The form still unlocks the current page if browser storage is unavailable.
  }

  resourceUnlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (resourceUnlockSubmitting || !resourceUnlockForm.reportValidity()) return;

    const submitButton = resourceUnlockForm.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(resourceUnlockForm).entries());

    resourceUnlockSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    if (resourceUnlockStatus) {
      resourceUnlockStatus.textContent = resourceFeedback.sending || "Unlocking resources...";
    }

    try {
      const response = await fetch(resourceUnlockForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new ResourceUnlockResponseError(
          resourceFeedback.errors?.[result.code]
          || resourceFeedback.generic
          || result.message
          || "Unable to unlock resources right now. Please try again.",
        );
      }

      try {
        localStorage.setItem(RESOURCE_UNLOCK_KEY, "true");
      } catch {
        // The unlocked state still applies to the current page.
      }
      unlockResourceGate({ moveFocus: true });
    } catch (error) {
      if (resourceUnlockStatus) {
        resourceUnlockStatus.textContent = error instanceof ResourceUnlockResponseError
          ? error.message
          : (resourceFeedback.generic || "Unable to unlock resources right now. Please try again.");
      }
    } finally {
      resourceUnlockSubmitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function normalizeWasteType(value) {
  return value.replace(/\s+/g, " ").trim();
}

function hasSelectedProductInterest() {
  return Boolean(productValue && productValue.value.trim());
}

function getWasteTypeOptions() {
  const selectedProduct = productValue ? productValue.value.trim() : "";

  if (!selectedProduct) {
    return [];
  }

  const productOptions = WASTE_TYPE_OPTIONS_BY_PRODUCT[selectedProduct] || DEFAULT_WASTE_TYPE_OPTIONS;

  return [...productOptions, ...customWasteTypeOptions].filter((option, index, options) => {
    return options.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index;
  });
}

function updateWasteTypeControlAvailability() {
  if (!wasteTypeControl) {
    return;
  }

  const isEnabled = hasSelectedProductInterest();
  wasteTypeControl.disabled = !isEnabled;
  wasteTypeControl.setAttribute("aria-disabled", String(!isEnabled));

  if (wasteTypeCustomInput) {
    wasteTypeCustomInput.disabled = !isEnabled;
  }

  if (wasteTypeClearButton) {
    wasteTypeClearButton.disabled = !isEnabled;
  }

  if (wasteTypeDoneButton) {
    wasteTypeDoneButton.disabled = !isEnabled;
  }

  if (!isEnabled) {
    if (wasteTypeLabel) {
      wasteTypeLabel.textContent = WASTE_TYPE_DISABLED_LABEL;
    }

    if (wasteTypeControl) {
      wasteTypeControl.classList.add("is-placeholder");
    }

    closeWasteTypePicker();
  }
}

function updateWasteTypeActionLabel() {
  if (!wasteTypeClearButton) {
    return;
  }

  wasteTypeClearButton.textContent = selectedWasteTypes.length
    ? (contactFeedback.clear || "Clear")
    : (contactFeedback.all || "All");
}

function openProductPicker() {
  if (!productPicker || !productControl) {
    return;
  }

  productPicker.classList.add("is-open");
  productControl.setAttribute("aria-expanded", "true");
}

function closeProductPicker() {
  if (!productPicker || !productControl) {
    return;
  }

  productPicker.classList.remove("is-open");
  productControl.setAttribute("aria-expanded", "false");
}

function setProductInterest(value) {
  const normalizedValue = value.trim();

  if (!productValue || !productLabel || !productControl) {
    return;
  }

  productValue.value = normalizedValue;
  const selectedOption = [...productOptions].find((option) => option.dataset.productOption === normalizedValue);
  productLabel.textContent = normalizedValue
    ? (selectedOption?.textContent.trim() || normalizedValue)
    : (contactFeedback.chooseProduct || "Choose product line");
  productControl.classList.toggle("is-placeholder", !normalizedValue);
  productControl.classList.remove("has-error");

  productOptions.forEach((optionButton) => {
    const isSelected = optionButton.dataset.productOption === normalizedValue;
    optionButton.setAttribute("aria-selected", String(isSelected));
  });
}

function validateProductInterest() {
  if (!productValue || !productControl) {
    return true;
  }

  const hasProduct = Boolean(productValue.value);
  productControl.classList.toggle("has-error", !hasProduct);

  if (!hasProduct) {
    productControl.focus();
    openProductPicker();
  }

  return hasProduct;
}

function isWasteTypeSelected(value) {
  const normalizedValue = normalizeWasteType(value).toLowerCase();
  return selectedWasteTypes.some((selectedValue) => selectedValue.toLowerCase() === normalizedValue);
}

function getWasteTypeSummary() {
  return selectedWasteTypes.join(", ");
}

function updateWasteTypeValue() {
  if (!wasteTypeValue) {
    return;
  }

  wasteTypeValue.value = getWasteTypeSummary();
}

function updateCustomWasteTypeClearState() {
  if (!wasteTypeCustomClearButton || !wasteTypeCustomInput) {
    return;
  }

  wasteTypeCustomClearButton.hidden = !wasteTypeCustomInput.value.trim();
}

function renderWasteTypeOptions() {
  if (!wasteTypeOptions) {
    return;
  }

  wasteTypeOptions.innerHTML = "";

  getWasteTypeOptions().forEach((option) => {
    const isSelected = isWasteTypeSelected(option);
    const optionButton = document.createElement("button");
    optionButton.className = "waste-type-option";
    optionButton.type = "button";
    optionButton.dataset.wasteOption = option;
    optionButton.setAttribute("role", "option");
    optionButton.setAttribute("aria-checked", String(isSelected));

    const checkMark = document.createElement("span");
    checkMark.className = "waste-type-check";
    checkMark.setAttribute("aria-hidden", "true");
    checkMark.textContent = isSelected ? "✓" : "";

    const optionText = document.createElement("span");
    optionText.textContent = contactFeedback.wasteTypes?.[option] || option;

    optionButton.append(checkMark, optionText);
    wasteTypeOptions.append(optionButton);
  });

  if (!wasteTypeOptions.children.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "waste-type-empty";
    emptyMessage.textContent = contactFeedback.empty || "Select a product line to view waste type suggestions.";
    wasteTypeOptions.append(emptyMessage);
  }
}

function renderWasteTypePicker() {
  renderWasteTypeOptions();
  updateWasteTypeActionLabel();

  if (wasteTypePicker && wasteTypePicker.classList.contains("is-open")) {
    refreshWasteTypeMenuLayout();
  }
}

function commitWasteTypeSelection() {
  const wasteTypeSummary = getWasteTypeSummary();
  const visibleWasteTypeSummary = selectedWasteTypes
    .map((value) => contactFeedback.wasteTypes?.[value] || value)
    .join(", ");

  updateWasteTypeValue();

  if (wasteTypeLabel && wasteTypeControl) {
    wasteTypeLabel.textContent = visibleWasteTypeSummary || WASTE_TYPE_PLACEHOLDER_LABEL;
    wasteTypeControl.classList.toggle("is-placeholder", !wasteTypeSummary);
  }

  closeWasteTypePicker();
}

function toggleWasteType(value) {
  if (!hasSelectedProductInterest()) {
    return;
  }

  const normalizedValue = normalizeWasteType(value);

  if (!normalizedValue) {
    return;
  }

  if (isWasteTypeSelected(normalizedValue)) {
    selectedWasteTypes = selectedWasteTypes.filter((selectedValue) => selectedValue.toLowerCase() !== normalizedValue.toLowerCase());
  } else {
    selectedWasteTypes = [...selectedWasteTypes, normalizedValue];
  }

  renderWasteTypePicker();
}

function addCustomWasteType(value) {
  if (!hasSelectedProductInterest()) {
    return;
  }

  const normalizedValue = normalizeWasteType(value);

  if (!normalizedValue) {
    return;
  }

  if (!getWasteTypeOptions().some((option) => option.toLowerCase() === normalizedValue.toLowerCase())) {
    customWasteTypeOptions = [...customWasteTypeOptions, normalizedValue];
  }

  if (!isWasteTypeSelected(normalizedValue)) {
    selectedWasteTypes = [...selectedWasteTypes, normalizedValue];
  }

  if (wasteTypeCustomInput) {
    wasteTypeCustomInput.value = "";
    updateCustomWasteTypeClearState();
  }

  renderWasteTypePicker();
}

function openWasteTypePicker() {
  if (!hasSelectedProductInterest() || !wasteTypePicker) {
    return;
  }

  if (wasteTypePicker) {
    wasteTypePicker.classList.add("is-open");
    if (wasteTypeControl) {
      wasteTypeControl.setAttribute("aria-expanded", "true");
    }
    refreshWasteTypeMenuLayout();
    window.requestAnimationFrame(() => {
      refreshWasteTypeMenuLayout();
    });
  }
}

function closeWasteTypePicker() {
  if (wasteTypePicker) {
    wasteTypePicker.classList.remove("is-open");
    wasteTypePicker.classList.remove("opens-up");
    wasteTypePicker.style.removeProperty("--waste-menu-max-height");
    if (wasteTypeControl) {
      wasteTypeControl.setAttribute("aria-expanded", "false");
    }
  }
}

function refreshWasteTypeMenuLayout() {
  if (!wasteTypePicker || !wasteTypeMenu) {
    return;
  }

  const pickerRect = wasteTypePicker.getBoundingClientRect();
  const menuHeight = wasteTypeMenu.scrollHeight;
  const spaceBelow = window.innerHeight - pickerRect.bottom - 16;
  const spaceAbove = pickerRect.top - 16;
  const openUp = menuHeight > spaceBelow && spaceAbove >= Math.min(menuHeight, 220);
  const availableSpace = Math.max(220, openUp ? spaceAbove : spaceBelow);

  wasteTypePicker.classList.toggle("opens-up", openUp);
  wasteTypePicker.style.setProperty("--waste-menu-max-height", `${Math.floor(availableSpace)}px`);
}

function resetWasteTypePicker() {
  selectedWasteTypes = [];
  customWasteTypeOptions = [];

  if (wasteTypeLabel && wasteTypeControl) {
    wasteTypeLabel.textContent = hasSelectedProductInterest() ? WASTE_TYPE_PLACEHOLDER_LABEL : WASTE_TYPE_DISABLED_LABEL;
    wasteTypeControl.classList.add("is-placeholder");
  }

  if (wasteTypeCustomInput) {
    wasteTypeCustomInput.value = "";
    updateCustomWasteTypeClearState();
  }

  updateWasteTypeValue();
  updateWasteTypeControlAvailability();
  renderWasteTypePicker();
}

function resetProductPicker() {
  setProductInterest("");
  closeProductPicker();
}

function clearWasteTypeSelection() {
  selectedWasteTypes = [];
  renderWasteTypePicker();
}

function selectAllWasteTypes() {
  const availableOptions = getWasteTypeOptions();

  if (!availableOptions.length) {
    return;
  }

  selectedWasteTypes = [...availableOptions];
  renderWasteTypePicker();
}

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

  if (!validateProductInterest()) {
    contactStatus.textContent = contactFeedback.PRODUCT_REQUIRED || "Please choose a product line.";
    return;
  }

  commitWasteTypeSelection();

  const formData = new FormData(contactForm);
  const payload = Object.fromEntries(formData.entries());

  contactStatus.textContent = contactFeedback.sending || "Sending your inquiry...";
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
      throw new Error(contactFeedback[errorData.code] || contactFeedback.generic || errorData.message || "Inquiry submission failed");
    }

    contactForm.reset();
    contactStatus.textContent = contactFeedback.success || "Inquiry sent. Our sales team will contact you soon.";
  } catch (error) {
    contactStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

function prefillResourceRequest() {
  if (!contactForm) return;

  const params = new URLSearchParams(window.location.search);
  const isResourceRequest = params.get("source") === "resources"
    && params.get("request") === "more-resources";

  if (!isResourceRequest) return;

  const messageField = contactForm.querySelector("textarea[name='message']");

  if (messageField && !messageField.value.trim()) {
    messageField.value = resourceFeedback.prefill
      || "I would like to receive more WEI LAN resource materials.";
  }
}

if (contactForm) {
  prefillResourceRequest();
  contactForm.addEventListener("submit", submitContactForm);
  contactForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      resetProductPicker();
      resetWasteTypePicker();
    }, 0);
  });
}

if (productControl) {
  productControl.addEventListener("click", (event) => {
    event.stopPropagation();

    if (productPicker && productPicker.classList.contains("is-open")) {
      closeProductPicker();
    } else {
      openProductPicker();
    }
  });
}

if (productMenu) {
  productMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    const optionButton = event.target.closest("[data-product-option]");

    if (!optionButton) {
      return;
    }

    setProductInterest(optionButton.dataset.productOption || "");
    resetWasteTypePicker();
    closeProductPicker();
    openWasteTypePicker();
  });
}

if (wasteTypeControl) {
  wasteTypeControl.addEventListener("click", (event) => {
    event.stopPropagation();
    renderWasteTypePicker();

    if (wasteTypePicker && wasteTypePicker.classList.contains("is-open")) {
      closeWasteTypePicker();
    } else {
      openWasteTypePicker();
    }
  });
}

if (wasteTypeCustomClearButton) {
  wasteTypeCustomClearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (wasteTypeCustomInput) {
      wasteTypeCustomInput.value = "";
      wasteTypeCustomInput.focus();
    }
    updateCustomWasteTypeClearState();
    openWasteTypePicker();
  });
}

if (wasteTypeClearButton) {
  wasteTypeClearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (selectedWasteTypes.length) {
      clearWasteTypeSelection();
    } else {
      selectAllWasteTypes();
    }
    openWasteTypePicker();
  });
}

if (wasteTypeDoneButton) {
  wasteTypeDoneButton.addEventListener("click", (event) => {
    event.stopPropagation();
    commitWasteTypeSelection();
  });
}

if (wasteTypeOptions) {
  wasteTypeOptions.addEventListener("click", (event) => {
    event.stopPropagation();
    const optionButton = event.target.closest("[data-waste-option]");

    if (!optionButton) {
      return;
    }

    toggleWasteType(optionButton.dataset.wasteOption || "");
    openWasteTypePicker();
  });
}

if (wasteTypeCustomInput) {
  wasteTypeCustomInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  wasteTypeCustomInput.addEventListener("input", updateCustomWasteTypeClearState);

  wasteTypeCustomInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addCustomWasteType(wasteTypeCustomInput.value);
    openWasteTypePicker();
  });

  updateCustomWasteTypeClearState();
}

if (wasteTypeField) {
  document.addEventListener("click", (event) => {
    if (productPicker && !productPicker.contains(event.target)) {
      closeProductPicker();
    }

    if (!wasteTypeField.contains(event.target)) {
      commitWasteTypeSelection();
    }
  });

  renderWasteTypePicker();
}

window.addEventListener("resize", () => {
  if (wasteTypePicker && wasteTypePicker.classList.contains("is-open")) {
    refreshWasteTypeMenuLayout();
  }
}, { passive: true });

setProductInterest(productValue ? productValue.value : "");
updateWasteTypeControlAvailability();
