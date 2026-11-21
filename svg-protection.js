function blockSvgImageActions(event) {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(".upi-code")) return;

  const image = target.closest("img");
  const isSvgImage = image && /\.svg(?:[?#]|$)/i.test(image.currentSrc || image.src);
  if (isSvgImage || target.closest("svg, .preview-image, .support-section")) {
    event.preventDefault();
  }
}

for (const eventType of ["contextmenu", "copy", "dragstart"]) {
  document.addEventListener(eventType, blockSvgImageActions, { capture: true });
}
