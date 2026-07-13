(function () {
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const parts = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) {
    return;
  }

  const route = parts[0].toLowerCase();
  const collectionInquiryUrl = "https://tally.so/r/ob1ABN";
  if (route === "contact") {
    window.location.replace(collectionInquiryUrl);
    return;
  }

  const knownPlaceholderRoutes = new Set(["buylist", "bulk", "events", "about"]);
  const main = document.getElementById("main");
  if (!main) {
    return;
  }

  function detailRow(label, value) {
    return `<dt>${label}</dt><dd>${value}</dd>`;
  }

  function renderQrView(title, subtitle, rows) {
    main.innerHTML = `
      <section class="qr-view wrap" aria-labelledby="qr-title">
        <article class="qr-card">
          <p class="eyebrow">CardVector QR</p>
          <h1 id="qr-title">${title}</h1>
          <p class="hero-lede">${subtitle}</p>
          <dl>${rows}</dl>
          <p class="qr-note">This public page is the permanent CardVector QR destination. Inventory details will expand as CardVector Mobile grows.</p>
        </article>
      </section>`;
  }

  if (route === "etb" && parts[1]) {
    const etbId = parts[1].toUpperCase();
    renderQrView(
      etbId,
      "Putnam Collectibles inventory location check.",
      detailRow("Type", "Storage Label") +
        detailRow("ETB ID", etbId) +
        detailRow("Inventory Details", "Private") +
        detailRow("Owner", "Putnam Collectibles") +
        detailRow("Powered By", "CardVector")
    );
    document.title = `${etbId} | Putnam Collectibles`;
    return;
  }

  if (route === "location" && parts[1] && parts[2]) {
    const etbId = parts[1].toUpperCase();
    const location = parts[2].toUpperCase();
    renderQrView(
      `Location ${location}`,
      "Putnam Collectibles inventory location check.",
      detailRow("Type", "Location Label") +
        detailRow("ETB ID", etbId) +
        detailRow("Location", location) +
        detailRow("Inventory Details", "Private") +
        detailRow("Owner", "Putnam Collectibles") +
        detailRow("Powered By", "CardVector")
    );
    document.title = `${etbId} Location ${location} | Putnam Collectibles`;
    return;
  }

  if (route === "lot" && parts[1]) {
    const lotId = parts[1].toUpperCase();
    renderQrView(
      lotId,
      "Putnam Collectibles acquisition lot.",
      detailRow("Type", "Acquisition Lot") + detailRow("Lot ID", lotId) + detailRow("Powered By", "CardVector")
    );
    document.title = `${lotId} | Putnam Collectibles`;
    return;
  }

  if (knownPlaceholderRoutes.has(route)) {
    renderQrView(
      `${route.charAt(0).toUpperCase()}${route.slice(1)} Coming Soon`,
      "This Putnam Collectibles page is planned but not published yet.",
      detailRow("Status", "Placeholder") + detailRow("Home", '<a href="/">Return to Putnam Collectibles</a>')
    );
    document.title = `${route} | Putnam Collectibles`;
  }
})();
