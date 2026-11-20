const navLinks = document.querySelector(".nav-links");
const menuToggle = document.querySelector(".menu-toggle");
const dropdowns = [...navLinks.querySelectorAll("details")];

function closeDropdowns(except) {
  dropdowns.forEach((dropdown) => {
    if (dropdown !== except) dropdown.open = false;
  });
}

function setMobileMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  navLinks.classList.toggle("is-open", open);
  if (!open) closeDropdowns();
}

menuToggle.addEventListener("click", () => {
  setMobileMenu(!navLinks.classList.contains("is-open"));
});

dropdowns.forEach((dropdown) => {
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) closeDropdowns(dropdown);
  });
});

navLinks.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMobileMenu(false);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) setMobileMenu(false);
  else if (!event.target.closest(".nav-dropdown")) closeDropdowns();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;

  const expandedDropdown = dropdowns.find((dropdown) => dropdown.open);
  if (expandedDropdown) {
    expandedDropdown.open = false;
    expandedDropdown.querySelector("summary").focus();
  } else if (navLinks.classList.contains("is-open")) {
    setMobileMenu(false);
    menuToggle.focus();
  }
});

document.querySelectorAll("[data-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.dialog).showModal();
  });
});

const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("[data-preview]").forEach((preview) => {
  const surface = preview.querySelector("[data-surface]");
  const layers = [...surface.querySelectorAll("[data-animation]")];
  const button = preview.querySelector("[data-play]");
  const label = button.querySelector("[data-play-label]");
  const playLabel = label?.textContent;
  let hovering = false;
  let animation = [];

  function updateControl(playing) {
    preview.toggleAttribute("data-playing", playing);
    button.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${button.dataset.play}`);
    if (label) label.textContent = playing ? "Pause preview" : playLabel;
  }

  function updatePlayback() {
    if (!hovering && !preview.hasAttribute("data-play-requested")) {
      animation.forEach((image) => image.remove());
      animation = [];
      updateControl(false);
      return;
    }
    if (animation.length) return;

    const images = layers.map((layer) => {
      const image = new Image();
      image.className = "animation";
      image.alt = "";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      image.src = layer.dataset.animation;
      layer.append(image);
      return image;
    });
    animation = images;

    Promise.all(images.map((image) => image.decode())).then(() => {
      if (animation === images) updateControl(true);
    }).catch(() => {
      if (animation !== images) return;
      hovering = false;
      preview.removeAttribute("data-play-requested");
      updatePlayback();
    });
  }

  surface.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse" || motionPreference.matches) return;
    hovering = true;
    updatePlayback();
  });

  surface.addEventListener("pointerleave", () => {
    hovering = false;
    updatePlayback();
  });

  button.addEventListener("click", () => {
    preview.toggleAttribute("data-play-requested", !animation.length);
    hovering = false;
    updatePlayback();
  });

  motionPreference.addEventListener("change", () => {
    hovering = false;
    updatePlayback();
  });
});

const comparison = document.querySelector(".comparison-control");
comparison.addEventListener("input", () => {
  comparison.parentElement.style.setProperty("--split", `${comparison.value}%`);
});

const launchDock = document.querySelector(".launch-dock");
const features = document.getElementById("features");
let dockFrame;

function scheduleDockUpdate() {
  if (dockFrame !== undefined) return;

  dockFrame = requestAnimationFrame(() => {
    dockFrame = undefined;
    const visible = window.scrollY > 0 && features.getBoundingClientRect().top < window.innerHeight;
    launchDock.toggleAttribute("data-visible", visible);
    launchDock.inert = !visible;
  });
}

window.addEventListener("scroll", scheduleDockUpdate, { passive: true });
window.addEventListener("resize", scheduleDockUpdate);
window.addEventListener("pageshow", scheduleDockUpdate);
scheduleDockUpdate();

const track = document.getElementById("project-gallery");
const carousel = track.parentElement;
const previous = carousel.querySelector(".carousel-previous");
const next = carousel.querySelector(".carousel-next");
const rotation = document.querySelector(".carousel-toggle");
const rotationLabel = rotation.querySelector("[data-rotation-label]");
const cards = [...track.children];
const snapTolerance = 2;
const advanceDelay = 2300;
const supportsScrollEnd = "onscrollend" in track;
let carouselVisible = false;
let carouselHovered = false;
let rotationPaused = false;
let touchPointer;
let advanceTimer;
let settleTimer;
let autoDirection = 1;
let bumpDirection = 0;

function maxGalleryOffset() {
  return track.scrollWidth - track.clientWidth;
}

function updateArrows() {
  previous.setAttribute("aria-disabled", String(track.scrollLeft <= snapTolerance));
  next.setAttribute("aria-disabled", String(track.scrollLeft >= maxGalleryOffset() - snapTolerance));
}

function slideGallery(direction, automatic = false) {
  const offset = track.scrollLeft;
  const max = maxGalleryOffset();
  const stops = cards.map((card) => Math.min(card.offsetLeft, max));
  const target = direction > 0
    ? stops.find((position) => position > offset + snapTolerance)
    : stops.reverse().find((position) => position < offset - snapTolerance);
  if (target === undefined) return false;

  bumpDirection = automatic ? direction : 0;
  track.scrollTo({ left: target, behavior: motionPreference.matches ? "auto" : "smooth" });
  return true;
}

function settleGallery() {
  const direction = bumpDirection;
  bumpDirection = 0;
  if (!direction || motionPreference.matches) return;

  track.animate([
    { translate: "0", offset: 0 },
    { translate: `${-3 * direction}px`, offset: 0.25 },
    { translate: `${direction}px`, offset: 0.6 },
    { translate: "0", offset: 1 },
  ], { duration: 240, easing: "ease-out" });
}

function hasVisibleRequestedPlayback() {
  const start = track.scrollLeft;
  const end = start + track.clientWidth;
  return cards.some((card) => card.hasAttribute("data-play-requested") &&
    card.offsetLeft < end - snapTolerance &&
    card.offsetLeft + card.offsetWidth > start + snapTolerance);
}

function scheduleAdvance() {
  clearTimeout(advanceTimer);
  if (!carouselVisible || document.hidden || rotationPaused || motionPreference.matches ||
      carouselHovered || touchPointer !== undefined || carousel.querySelector(":focus-visible") ||
      maxGalleryOffset() <= snapTolerance || hasVisibleRequestedPlayback()) return;

  advanceTimer = setTimeout(() => {
    if (!slideGallery(autoDirection, true)) {
      autoDirection *= -1;
      slideGallery(autoDirection, true);
    }
  }, advanceDelay);
}

previous.hidden = false;
next.hidden = false;
rotation.hidden = motionPreference.matches;
updateArrows();
previous.addEventListener("click", () => slideGallery(-1));
next.addEventListener("click", () => slideGallery(1));
rotation.addEventListener("click", () => {
  rotationPaused = !rotationPaused;
  rotation.toggleAttribute("data-paused", rotationPaused);
  rotationLabel.textContent = rotationPaused ? "Resume auto-scroll" : "Pause auto-scroll";
  scheduleAdvance();
});

track.addEventListener("keydown", (event) => {
  if (event.target !== track || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  slideGallery(event.key === "ArrowLeft" ? -1 : 1);
});
track.addEventListener("scroll", () => {
  updateArrows();
  scheduleAdvance();
  if (!supportsScrollEnd && bumpDirection) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settleGallery, 100);
  }
}, { passive: true });
track.addEventListener("scrollend", settleGallery);

function updateCarouselHover(event) {
  if (event.pointerType === "touch") return;
  const target = event.type === "pointerout" ? event.relatedTarget : event.target;
  const hovering = target instanceof Element && carousel.contains(target) && !target.closest("[data-play]");
  if (carouselHovered === hovering) return;
  carouselHovered = hovering;
  scheduleAdvance();
}
carousel.addEventListener("pointerover", updateCarouselHover);
carousel.addEventListener("pointerout", updateCarouselHover);
track.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  touchPointer = event.pointerId;
  bumpDirection = 0;
  scheduleAdvance();
}, { passive: true });
function endGalleryTouch(event) {
  if (touchPointer !== event.pointerId) return;
  touchPointer = undefined;
  scheduleAdvance();
}
window.addEventListener("pointerup", endGalleryTouch);
window.addEventListener("pointercancel", endGalleryTouch);
carousel.addEventListener("focusin", scheduleAdvance);
carousel.addEventListener("focusout", () => queueMicrotask(scheduleAdvance));
new MutationObserver(scheduleAdvance).observe(track, {
  attributes: true,
  attributeFilter: ["data-play-requested"],
  subtree: true,
});
document.addEventListener("visibilitychange", scheduleAdvance);
motionPreference.addEventListener("change", () => {
  rotation.hidden = motionPreference.matches;
  scheduleAdvance();
});
new ResizeObserver(() => {
  updateArrows();
  scheduleAdvance();
}).observe(track);
new IntersectionObserver(([entry]) => {
  carouselVisible = entry.intersectionRatio >= 0.25;
  scheduleAdvance();
}, { threshold: 0.25 }).observe(carousel);
