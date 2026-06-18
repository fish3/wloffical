const siteHeader = document.querySelector("[data-header]");

function updateHeaderBackground() {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
}

updateHeaderBackground();
window.addEventListener("scroll", updateHeaderBackground, { passive: true });
