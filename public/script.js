const siteHeader = document.querySelector("[data-header]");
const contactForm = document.querySelector("[data-contact-form]");
const contactStatus = document.querySelector("[data-contact-status]");
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

let selectedWasteTypes = [];
let customWasteTypeOptions = [];

function updateHeaderBackground() {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
}

updateHeaderBackground();
window.addEventListener("scroll", updateHeaderBackground, { passive: true });

function normalizeWasteType(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getWasteTypeOptions() {
  const selectedProduct = productValue ? productValue.value : "";
  const productOptions = !selectedProduct
    ? DEFAULT_WASTE_TYPE_OPTIONS
    : WASTE_TYPE_OPTIONS_BY_PRODUCT[selectedProduct] || DEFAULT_WASTE_TYPE_OPTIONS;

  return [...productOptions, ...customWasteTypeOptions].filter((option, index, options) => {
    return options.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index;
  });
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
  productLabel.textContent = normalizedValue || "Choose product line";
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
    optionText.textContent = option;

    optionButton.append(checkMark, optionText);
    wasteTypeOptions.append(optionButton);
  });

  if (!wasteTypeOptions.children.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "waste-type-empty";
    emptyMessage.textContent = "Select a product line to view waste type suggestions.";
    wasteTypeOptions.append(emptyMessage);
  }
}

function renderWasteTypePicker() {
  renderWasteTypeOptions();

  if (wasteTypePicker && wasteTypePicker.classList.contains("is-open")) {
    refreshWasteTypeMenuLayout();
  }
}

function commitWasteTypeSelection() {
  const wasteTypeSummary = getWasteTypeSummary();

  updateWasteTypeValue();

  if (wasteTypeLabel && wasteTypeControl) {
    wasteTypeLabel.textContent = wasteTypeSummary || "Select waste types";
    wasteTypeControl.classList.toggle("is-placeholder", !wasteTypeSummary);
  }

  closeWasteTypePicker();
}

function toggleWasteType(value) {
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
    wasteTypeLabel.textContent = "Select waste types";
    wasteTypeControl.classList.add("is-placeholder");
  }

  if (wasteTypeCustomInput) {
    wasteTypeCustomInput.value = "";
    updateCustomWasteTypeClearState();
  }

  updateWasteTypeValue();
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
    contactStatus.textContent = "Please choose a product line.";
    return;
  }

  commitWasteTypeSelection();

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
    clearWasteTypeSelection();
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
