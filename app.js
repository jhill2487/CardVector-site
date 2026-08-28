(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CardVectorCaptureMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function positiveDimension(value, name) {
    const dimension = Number(value);
    if (!Number.isFinite(dimension) || dimension <= 0) {
      throw new Error(`${name} must be greater than zero.`);
    }
    return dimension;
  }

  // Match a centered CSS object-fit: cover preview without distorting the frame.
  function calculateCoverCrop(sourceWidth, sourceHeight, previewWidth, previewHeight) {
    const sw = positiveDimension(sourceWidth, "sourceWidth");
    const sh = positiveDimension(sourceHeight, "sourceHeight");
    const pw = positiveDimension(previewWidth, "previewWidth");
    const ph = positiveDimension(previewHeight, "previewHeight");
    const scale = Math.max(pw / sw, ph / sh);
    const visibleSourceWidth = Math.min(sw, pw / scale);
    const visibleSourceHeight = Math.min(sh, ph / scale);
    const sourceX = Math.max(0, Math.min(sw - visibleSourceWidth, (sw - visibleSourceWidth) / 2));
    const sourceY = Math.max(0, Math.min(sh - visibleSourceHeight, (sh - visibleSourceHeight) / 2));

    return {
      sourceX,
      sourceY,
      sourceWidth: visibleSourceWidth,
      sourceHeight: visibleSourceHeight,
      previewWidth: pw,
      previewHeight: ph,
      scale
    };
  }

  function calculateCaptureOutputSize(crop, maxEdge = 1800) {
    const width = positiveDimension(crop && crop.sourceWidth, "crop.sourceWidth");
    const height = positiveDimension(crop && crop.sourceHeight, "crop.sourceHeight");
    const edge = positiveDimension(maxEdge, "maxEdge");
    const scale = Math.min(1, edge / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  const locationCodes = Object.freeze(Array.from("ABCDEFGHIJ"));

  function normalizeEtbId(value) {
    const etbId = String(value || "").trim().toUpperCase();
    if (!/^ETB-[0-9]{3}$/.test(etbId)) {
      throw new Error("ETB ID must use ETB-### format.");
    }
    return etbId;
  }

  function normalizeLocationCode(value) {
    const code = String(value || "").trim().toUpperCase();
    if (!locationCodes.includes(code)) {
      throw new Error("Location code must be A-J.");
    }
    return code;
  }

  function canonicalLocationId(etbId, locationCode) {
    return `${normalizeEtbId(etbId)}-${normalizeLocationCode(locationCode)}`;
  }

  function nextAvailableLocationCode(locations) {
    const existing = new Set();
    for (const item of locations || []) {
      const value = typeof item === "string" ? item : item && item.location_code;
      try {
        existing.add(normalizeLocationCode(value));
      } catch (_exc) {
        // Invalid cloud rows are ignored and never become capture destinations.
      }
    }
    return locationCodes.find((code) => !existing.has(code)) || "";
  }

  return {
    calculateCoverCrop,
    calculateCaptureOutputSize,
    locationCodes,
    normalizeEtbId,
    normalizeLocationCode,
    canonicalLocationId,
    nextAvailableLocationCode
  };
});

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const navigationMenu = document.querySelector(".nav-menu");
  const mobileNavigation = window.matchMedia("(max-width: 900px)");
  function syncNavigationMode() {
    if (!navigationMenu) {
      return;
    }
    navigationMenu.toggleAttribute("open", !mobileNavigation.matches);
  }
  syncNavigationMode();
  if (typeof mobileNavigation.addEventListener === "function") {
    mobileNavigation.addEventListener("change", syncNavigationMode);
  }
  if (navigationMenu) {
    navigationMenu.addEventListener("click", (event) => {
      if (mobileNavigation.matches && event.target.closest("a")) {
        navigationMenu.removeAttribute("open");
      }
    });
  }

  const mobileHashRoutes = new Set([
    "mobile",
    "mobile-capture",
    "operator",
    "operator-dashboard",
    "registry",
    "location-registry",
    "batches",
    "batch-workflow",
    "listings",
    "listing-reconciliation",
    "existing-listing-review",
    "repricing",
    "price-review"
  ]);
  function currentHashRoute() {
    return window.location.hash.replace(/^#\/?/, "").toLowerCase();
  }
  window.addEventListener("hashchange", () => {
    if (mobileHashRoutes.has(currentHashRoute())) {
      window.location.reload();
    }
  });

  const directStoreCartStorageKey = "cardvector.directStoreCart.v1";
  const directStoreReservationsStorageKey = "cardvector.directStoreReservations.v1";
  const directStoreFiltersStorageKey = "cardvector.directStoreFilters.v1";
  function readDirectStoreCartCount() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(directStoreCartStorageKey) || "{}");
      const items = parsed && parsed.items && typeof parsed.items === "object" ? Object.values(parsed.items) : [];
      return items.reduce((total, item) => total + Math.max(0, Number(item && item.quantity) || 0), 0);
    } catch (_exc) {
      return 0;
    }
  }

  function refreshDirectStoreCartLabels() {
    const count = readDirectStoreCartCount();
    document.querySelectorAll("[data-cart-count-label]").forEach((node) => {
      node.textContent = count ? `Cart (${count})` : "Cart";
    });
  }
  refreshDirectStoreCartLabels();
  window.addEventListener("storage", (event) => {
    if (event.key === directStoreCartStorageKey) {
      refreshDirectStoreCartLabels();
    }
  });

  const parts = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const hashRoute = currentHashRoute();
  if (!parts.length && !mobileHashRoutes.has(hashRoute)) {
    return;
  }

  const route = mobileHashRoutes.has(hashRoute)
    ? hashRoute
    : parts[0].toLowerCase();
  const siteLinks = Object.freeze({
    EBAY_STORE_URL: "https://www.ebay.com/str/jhilltcg?mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339178316&customid=&toolid=10001&mkevt=1",
    TCGPLAYER_STORE_URL: "https://www.tcgplayer.com/sellers/Putnam-Collectibles/747c057d",
    WHATNOT_REFERRAL_URL: "https://whatnot.com/invite/putnam_collectibles",
    COLLECTION_INQUIRY_URL: "https://tally.so/r/ob1ABN",
    CONTACT_EMAIL: "Putnam.collects@gmail.com",
    CONTACT_EMAIL_URL: "https://mail.google.com/mail/?view=cm&fs=1&to=Putnam.collects%40gmail.com&su=Putnam%20Collectibles%20Inquiry",
    CHECKOUT_FUNCTION_URL: "https://iqdpfgpkagjxzedfxrvn.supabase.co/functions/v1/create-checkout-session"
  });
  const egressSafeMode = true;
  const egressSafeCacheMs = 5 * 60 * 1000;
  const egressSafeLimits = Object.freeze({
    registryLocations: 250,
    registrySessions: 25,
    registryBatches: 120,
    listingSnapshots: 1200,
    allocationLedger: 1200,
    listingBatchReferences: 250,
    captureMaxEdge: 1400,
    captureJpegQuality: 0.82
  });
  const sellRoutes = new Set(["sell", "bulk", "buylist"]);
  const marketBriefRoutes = new Set(["market-briefs", "pokemon-market-briefs", "market"]);
  const knownPlaceholderRoutes = new Set(["events", "about"]);
  const main = document.getElementById("main");
  if (!main) {
    return;
  }

  const captureStatuses = new Set([
    "DRAFT",
    "UPLOADING",
    "PENDING_CONVERSION",
    "PROCESSING",
    "CONVERTED",
    "FAILED",
    "CANCELLED"
  ]);
  const captureTypeConfig = {
    NEW_CAPTURE: {
      title: "New Inventory Capture",
      label: "New Inventory Capture",
      slug: "new-inventory",
      shortLabel: "New Inventory"
    },
    PHYSICAL_INVENTORY: {
      title: "Physical Inventory Conversion",
      label: "Physical Inventory Conversion",
      slug: "physical-inventory",
      shortLabel: "Physical Inventory"
    }
  };
  const captureLayoutConfig = {
    FRONT_ONLY: {
      label: "Front only",
      shortLabel: "Front only",
      slug: "front-only",
      description: "Capture one front image for each card."
    },
    FRONT_BACK: {
      label: "Front + back",
      shortLabel: "Front + back",
      slug: "front-back",
      description: "Capture the front, then the back, for each card."
    }
  };
  const captureDbName = "cardvector-mobile-capture";
  const captureStoreName = "images";
  const mobileCore = window.CardVectorCaptureMath;
  let cameraController = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function detailRow(label, value) {
    return `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`;
  }

  function renderQrView(title, subtitle, rows, extra = "") {
    main.innerHTML = `
      <section class="qr-view wrap" aria-labelledby="qr-title">
        <article class="qr-card">
          <p class="eyebrow">CardVector QR</p>
          <h1 id="qr-title">${escapeHtml(title)}</h1>
          <p class="hero-lede">${escapeHtml(subtitle)}</p>
          <dl>${rows}</dl>
          ${extra}
          <p class="qr-note">This public page is the permanent CardVector QR destination. Inventory details expand through authenticated CardVector Mobile workflows.</p>
        </article>
      </section>`;
  }

  function renderSellCollectionPage() {
    main.innerHTML = `
      <section class="qr-view wrap" aria-labelledby="sell-route-title">
        <article class="qr-card sell-route-card">
          <p class="eyebrow">Putnam Collectibles</p>
          <h1 id="sell-route-title">Sell Your Collection</h1>
          <p class="hero-lede">Selling a collection or Near Mint English bulk? Tell us what you have and we&rsquo;ll review it.</p>
          <div class="sell-options" aria-label="Items Putnam Collectibles currently reviews">
            <div>
              <strong>Full or Partial Collections</strong>
              <span>Share the size, games, highlights, and condition.</span>
            </div>
            <div>
              <strong>Near Mint English Bulk</strong>
              <span>Holo and reverse-holo bulk inquiries are welcome.</span>
            </div>
          </div>
          <div class="entry-actions sell-route-actions">
            <a class="button primary button-large" href="${siteLinks.COLLECTION_INQUIRY_URL}" target="_blank" rel="noopener noreferrer" aria-label="Submit a collection or bulk card inquiry to Putnam Collectibles">Submit Collection Inquiry</a>
            <a class="button secondary" href="/">Return Home</a>
          </div>
          <p class="qr-note">Near Mint English cards only at this time.</p>
        </article>
      </section>`;
    document.title = "Sell Your Collection | Putnam Collectibles";
  }

  function renderContactPage() {
    main.innerHTML = `
      <section class="qr-view wrap" aria-labelledby="contact-route-title">
        <article class="qr-card contact-route-card">
          <p class="eyebrow">Direct contact</p>
          <h1 id="contact-route-title">Contact Putnam Collectibles</h1>
          <p class="hero-lede">Use the direct form or email ${escapeHtml(siteLinks.CONTACT_EMAIL)} for collection offers, general questions, card availability, or local inquiries.</p>
          <div class="contact-route-notes" aria-label="Contact guidance">
            <div>
              <strong>General inquiries</strong>
              <span>Ask about cards, availability, collection sales, or bulk offers.</span>
            </div>
            <div>
              <strong>Marketplace orders</strong>
              <span>For an existing marketplace order or listing-specific transaction, keep order messages and payment inside that marketplace.</span>
            </div>
          </div>
          <div class="entry-actions sell-route-actions">
            <a class="button primary button-large" href="${siteLinks.COLLECTION_INQUIRY_URL}" target="_blank" rel="noopener noreferrer" aria-label="Send a direct message to Putnam Collectibles">Send Direct Message</a>
            <a class="button secondary button-large" href="${siteLinks.CONTACT_EMAIL_URL}" target="_blank" rel="noopener noreferrer" aria-label="Email Putnam Collectibles directly">Email Putnam Collectibles</a>
            <a class="button secondary" href="/">Return Home</a>
          </div>
        </article>
      </section>`;
    document.title = "Contact Putnam Collectibles";
  }

  const directStoreInventoryUrl = "/content/shop/direct-inventory.json";
  const directStoreCheckoutTimeoutMs = 20000;
  const directStoreFallbackCatalog = Object.freeze({
    schema_version: "1.1",
    checkout_mode: "hybrid_static_browse_live_availability_pending",
    currency: "USD",
    generated_at: "",
    source: "cardvector_direct_store_feed",
    source_file: "",
    availability: {
      mode: "static_browse_feed",
      supabase_enabled: false,
      live_checkout_required: true
    },
    summary: {
      published_items: 0,
      published_quantity: 0,
      games: {}
    },
    items: []
  });
  const directStoreDisplayLimit = 96;

  function directStoreMoney(value, currency = "USD") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return "$0.00";
    }
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function normalizeDirectStoreItem(item) {
    const id = String(item && (item.id || item.sku || item.marketplace_listing_id) || "").trim();
    const title = String(item && (item.title || item.listing_title) || "").trim();
    const price = Number(item && (item.price || item.current_price || item.direct_price));
    const available = Math.max(0, Math.floor(Number(item && (item.quantity_available ?? item.available ?? item.quantity)) || 0));
    if (!id || !title || !Number.isFinite(price) || price <= 0 || available <= 0) {
      return null;
    }
    return {
      id,
      title,
      game: String(item.game || item.card_game || "Trading Card").trim(),
      condition: String(item.condition || "Near Mint").trim(),
      variant: String(item.variant || "").trim(),
      set_name: String(item.set_name || item.set || "").trim(),
      card_number: String(item.card_number || item.number || "").trim(),
      rarity: String(item.rarity || "").trim(),
      price,
      quantity_available: available,
      image_url: String(item.image_url || item.image || "").trim(),
      source: String(item.source || "CardUploader inventory mirror").trim(),
      source_listing_id: String(item.source_listing_id || item.marketplace_listing_id || "").trim(),
      inventory_reference: String(item.inventory_reference || item.user_sku || "").trim(),
      status: String(item.status || "available").trim(),
      updated_at: String(item.updated_at || "").trim()
    };
  }

  function directStoreCheckoutFunctionUrl() {
    const url = String(siteLinks.CHECKOUT_FUNCTION_URL || "").trim();
    return url.startsWith("https://") ? url : "";
  }

  async function loadDirectStoreCatalog() {
    try {
      const response = await fetch(directStoreInventoryUrl, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Direct inventory returned ${response.status}`);
      }
      const payload = await response.json();
      const items = Array.isArray(payload && payload.items)
        ? payload.items.map(normalizeDirectStoreItem).filter(Boolean)
        : [];
      return {
        schema_version: String(payload.schema_version || "1.0"),
        checkout_mode: String(payload.checkout_mode || "reservation_pilot"),
        currency: String(payload.currency || "USD"),
        generated_at: String(payload.generated_at || ""),
        source: String(payload.source || ""),
        source_file: String(payload.source_file || ""),
        availability: payload.availability && typeof payload.availability === "object"
          ? payload.availability
          : directStoreFallbackCatalog.availability,
        summary: payload.summary && typeof payload.summary === "object"
          ? payload.summary
          : directStoreFallbackCatalog.summary,
        items
      };
    } catch (_exc) {
      return { ...directStoreFallbackCatalog, items: [] };
    }
  }

  function readDirectStoreFilters() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(directStoreFiltersStorageKey) || "{}");
      return {
        search: String(parsed.search || "").trim(),
        game: String(parsed.game || "all").trim() || "all"
      };
    } catch (_exc) {
      return { search: "", game: "all" };
    }
  }

  function writeDirectStoreFilters(filters) {
    const normalized = {
      search: String(filters && filters.search || "").trim(),
      game: String(filters && filters.game || "all").trim() || "all"
    };
    window.localStorage.setItem(directStoreFiltersStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  function directStoreGameOptions(catalog) {
    return Array.from(new Set(catalog.items.map((item) => item.game).filter(Boolean))).sort();
  }

  function filterDirectStoreItems(catalog, filters) {
    const query = String(filters.search || "").toLowerCase();
    const game = String(filters.game || "all");
    return catalog.items.filter((item) => {
      if (game !== "all" && item.game !== game) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        item.title,
        item.game,
        item.set_name,
        item.card_number,
        item.rarity,
        item.condition,
        item.variant
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function directStoreFeedLabel(catalog) {
    const generated = catalog.generated_at
      ? new Date(catalog.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "not generated yet";
    return `Static CardUploader snapshot - ${catalog.summary.published_items || catalog.items.length} items - updated ${generated}`;
  }

  function readDirectStoreCart() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(directStoreCartStorageKey) || "{}");
      return {
        items: parsed && parsed.items && typeof parsed.items === "object" ? parsed.items : {}
      };
    } catch (_exc) {
      return { items: {} };
    }
  }

  function writeDirectStoreCart(cart) {
    const normalized = { items: {} };
    Object.entries(cart && cart.items || {}).forEach(([id, line]) => {
      const quantity = Math.max(0, Math.floor(Number(line && line.quantity) || 0));
      if (id && quantity > 0) {
        normalized.items[id] = { quantity };
      }
    });
    window.localStorage.setItem(directStoreCartStorageKey, JSON.stringify(normalized));
    refreshDirectStoreCartLabels();
    return normalized;
  }

  function directStoreCartQuantity(cart, itemId) {
    return Math.max(0, Math.floor(Number(cart && cart.items && cart.items[itemId] && cart.items[itemId].quantity) || 0));
  }

  function setDirectStoreCartQuantity(cart, itemId, quantity, catalog) {
    const item = catalog.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return writeDirectStoreCart(cart);
    }
    const nextQuantity = Math.max(0, Math.min(item.quantity_available, Math.floor(Number(quantity) || 0)));
    const nextCart = { items: { ...(cart.items || {}) } };
    if (nextQuantity > 0) {
      nextCart.items[itemId] = { quantity: nextQuantity };
    } else {
      delete nextCart.items[itemId];
    }
    return writeDirectStoreCart(nextCart);
  }

  function directStoreCartLines(cart, catalog) {
    return Object.entries(cart && cart.items || {})
      .map(([id, line]) => {
        const item = catalog.items.find((candidate) => candidate.id === id);
        if (!item) {
          return null;
        }
        const quantity = Math.max(0, Math.floor(Number(line && line.quantity) || 0));
        if (!quantity) {
          return null;
        }
        return {
          item,
          quantity,
          line_total: Number((item.price * quantity).toFixed(2)),
          available: quantity <= item.quantity_available
        };
      })
      .filter(Boolean);
  }

  function directStoreCartSummary(cart, catalog) {
    const lines = directStoreCartLines(cart, catalog);
    return {
      lines,
      quantity: lines.reduce((total, line) => total + line.quantity, 0),
      subtotal: Number(lines.reduce((total, line) => total + line.line_total, 0).toFixed(2)),
      unavailable: lines.filter((line) => !line.available)
    };
  }

  function directStoreReservations() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(directStoreReservationsStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_exc) {
      return [];
    }
  }

  function writeDirectStoreReservation(reservation) {
    const reservations = directStoreReservations();
    reservations.unshift(reservation);
    window.localStorage.setItem(directStoreReservationsStorageKey, JSON.stringify(reservations.slice(0, 20)));
    return reservation;
  }

  function createDirectStoreReservation(catalog, cart, customer) {
    const summary = directStoreCartSummary(cart, catalog);
    if (!summary.lines.length) {
      return { ok: false, message: "Add at least one available card to your cart before checkout." };
    }
    if (summary.unavailable.length) {
      return { ok: false, message: "One or more cart quantities exceed current availability. Adjust the cart and try again." };
    }
    const email = String(customer && customer.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "Enter a valid email address for checkout updates." };
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const reservation = {
      id: `CVR-${now.getTime().toString(36).toUpperCase()}`,
      status: "checkout_ready_for_payment_integration",
      payment_status: "not_configured",
      marketplace_release_status: "not_configured",
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      customer: {
        name: String(customer.name || "").trim(),
        email,
        postal_code: String(customer.postal_code || "").trim()
      },
      currency: catalog.currency,
      subtotal: summary.subtotal,
      quantity: summary.quantity,
      lines: summary.lines.map((line) => ({
        item_id: line.item.id,
        title: line.item.title,
        quantity: line.quantity,
        unit_price: line.item.price,
        line_total: line.line_total,
        source: line.item.source,
        source_listing_id: line.item.source_listing_id
      }))
    };
    return { ok: true, reservation: writeDirectStoreReservation(reservation) };
  }

  async function createDirectStoreCheckoutSession(catalog, cart) {
    const summary = directStoreCartSummary(cart, catalog);
    if (!summary.lines.length) {
      return { ok: false, message: "Add at least one available card to your cart before checkout." };
    }
    if (summary.unavailable.length) {
      return { ok: false, message: "One or more cart quantities exceed current availability. Adjust the cart and try again." };
    }
    const endpoint = directStoreCheckoutFunctionUrl();
    if (!endpoint) {
      return { ok: false, message: "Secure checkout is not configured yet." };
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), directStoreCheckoutTimeoutMs);
    try {
      const payload = {
        cart: {
          items: Object.fromEntries(summary.lines.map((line) => [
            line.item.id,
            { quantity: line.quantity }
          ]))
        }
      };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result || !result.checkout_url) {
        return {
          ok: false,
          message: String(result && result.error || result && result.message || "Secure checkout could not be started.")
        };
      }
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        message: error && error.name === "AbortError"
          ? "Secure checkout timed out. Please try again."
          : "Secure checkout could not be reached. Please try again."
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function directStoreItemArt(item) {
    if (item.image_url && /^https?:\/\//.test(item.image_url)) {
      return `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`;
    }
    return `<div class="direct-card-placeholder" aria-hidden="true">${escapeHtml(item.game.slice(0, 3).toUpperCase())}</div>`;
  }

  function renderDirectStoreItem(item, cart, currency) {
    const quantity = directStoreCartQuantity(cart, item.id);
    const detailLine = [
      item.set_name,
      item.card_number ? `#${item.card_number}` : "",
      item.rarity
    ].filter(Boolean).join(" / ");
    return `
      <article class="direct-store-item">
        <div class="direct-store-art">${directStoreItemArt(item)}</div>
        <div class="direct-store-copy">
          <span class="marketplace-label">${escapeHtml(item.game)}</span>
          <h2>${escapeHtml(item.title)}</h2>
          ${detailLine ? `<p class="direct-store-detail">${escapeHtml(detailLine)}</p>` : ""}
          <p>${escapeHtml([item.condition, item.variant].filter(Boolean).join(" / "))}</p>
          <div class="direct-store-meta">
            <strong>${directStoreMoney(item.price, currency)}</strong>
            <span>${escapeHtml(item.quantity_available)} available</span>
          </div>
        </div>
        <div class="direct-store-actions">
          <button class="button primary" type="button" data-direct-add="${escapeHtml(item.id)}">Add to cart</button>
          ${quantity ? `<span class="cart-line-note">In cart: ${escapeHtml(quantity)}</span>` : ""}
        </div>
      </article>`;
  }

  function renderDirectStoreCartLines(summary, currency) {
    if (!summary.lines.length) {
      return '<p class="operator-empty">Your cart is empty.</p>';
    }
    return summary.lines.map((line) => `
      <article class="direct-cart-line">
        <div>
          <strong>${escapeHtml(line.item.title)}</strong>
          <span>${escapeHtml(line.item.game)} &middot; ${escapeHtml(line.item.condition)}</span>
          ${line.available ? "" : '<span class="cart-line-warning">Quantity exceeds current availability.</span>'}
        </div>
        <div class="direct-cart-controls" aria-label="Cart quantity controls">
          <button type="button" data-cart-dec="${escapeHtml(line.item.id)}" aria-label="Decrease quantity">-</button>
          <span>${escapeHtml(line.quantity)}</span>
          <button type="button" data-cart-inc="${escapeHtml(line.item.id)}" aria-label="Increase quantity">+</button>
          <button type="button" data-cart-remove="${escapeHtml(line.item.id)}">Remove</button>
        </div>
        <strong>${directStoreMoney(line.line_total, currency)}</strong>
      </article>`).join("");
  }

  function renderDirectStoreShell(catalog, cart, options = {}) {
    const summary = directStoreCartSummary(cart, catalog);
    const filters = options.filters || readDirectStoreFilters();
    const filteredItems = filterDirectStoreItems(catalog, filters);
    const visibleItems = filteredItems.slice(0, directStoreDisplayLimit);
    const gameOptions = directStoreGameOptions(catalog);
    const list = visibleItems.length
      ? visibleItems.map((item) => renderDirectStoreItem(item, cart, catalog.currency)).join("")
      : `<article class="direct-store-empty">
          <p class="eyebrow">Inventory feed pending</p>
          <h2>No cards match the current view.</h2>
          <p>Try clearing the search or changing the game filter. The direct shop uses a static CardUploader snapshot for browsing.</p>
        </article>`;
    main.innerHTML = `
      <section class="direct-store-shell wrap" aria-labelledby="direct-store-title">
        <div class="direct-store-hero">
          <div>
            <p class="eyebrow">Direct storefront pilot</p>
            <h1 id="direct-store-title">Shop Putnam Collectibles Direct</h1>
            <p>Browse a lightweight CardUploader inventory snapshot without pulling original capture images from Supabase. Checkout re-checks availability before Stripe collects payment.</p>
          </div>
          <a class="button secondary" href="/cart/">View Cart (${escapeHtml(summary.quantity)})</a>
        </div>
        <aside class="direct-store-safety">
          <strong>Oversell safety first</strong>
          <p>Adding to cart does not reserve inventory. Secure checkout re-validates current feed availability before payment. Paid orders queue CardUploader/eBay release jobs for the private fulfillment helper.</p>
        </aside>
        <div class="direct-store-feed-bar">
          <div>
            <strong>${escapeHtml(directStoreFeedLabel(catalog))}</strong>
            <span>${escapeHtml(catalog.availability && catalog.availability.mode || "static_browse_feed")} / ${escapeHtml(catalog.source_file || "inventory feed")}</span>
          </div>
          <div class="direct-store-feed-counts">
            <span>${escapeHtml(filteredItems.length)} matching</span>
            <span>${escapeHtml(catalog.summary.published_quantity || 0)} total available</span>
          </div>
        </div>
        <form class="direct-store-filters" id="direct-store-filters">
          <label>Search cards
            <input name="search" value="${escapeHtml(filters.search)}" placeholder="Name, set, number, rarity">
          </label>
          <label>Game
            <select name="game">
              <option value="all"${filters.game === "all" ? " selected" : ""}>All games</option>
              ${gameOptions.map((game) => `<option value="${escapeHtml(game)}"${filters.game === game ? " selected" : ""}>${escapeHtml(game)}</option>`).join("")}
            </select>
          </label>
        </form>
        <div class="direct-store-layout">
          <section class="direct-store-list" aria-label="Direct store cards">
            ${filteredItems.length > visibleItems.length ? `<p class="direct-store-showing">Showing ${escapeHtml(visibleItems.length)} of ${escapeHtml(filteredItems.length)} matching cards. Use search or game filters to narrow the list.</p>` : ""}
            ${list}
          </section>
          <aside class="direct-cart-panel" aria-labelledby="direct-cart-title">
            <h2 id="direct-cart-title">Cart</h2>
            <div id="direct-cart-lines">${renderDirectStoreCartLines(summary, catalog.currency)}</div>
            <div class="direct-cart-total">
              <span>Subtotal</span>
              <strong>${directStoreMoney(summary.subtotal, catalog.currency)}</strong>
            </div>
            <a class="button primary" href="/cart/"${summary.quantity ? "" : " aria-disabled=\"true\""}>Checkout</a>
            <p class="operator-note">Checkout uses Stripe for email, shipping address, and payment. Promotional email consent is optional.</p>
          </aside>
        </div>
        ${options.status ? `<div class="direct-store-status" role="status">${escapeHtml(options.status)}</div>` : ""}
      </section>`;
    document.title = "Shop Direct | Putnam Collectibles";
    bindDirectStoreEvents(catalog);
    const filterForm = document.getElementById("direct-store-filters");
    if (filterForm) {
      filterForm.addEventListener("input", () => {
        const data = new FormData(filterForm);
        const nextFilters = writeDirectStoreFilters({
          search: data.get("search"),
          game: data.get("game")
        });
        renderDirectStoreShell(catalog, readDirectStoreCart(), { filters: nextFilters });
      });
    }
  }

  function renderDirectStoreCartShell(catalog, cart, status = "") {
    const summary = directStoreCartSummary(cart, catalog);
    const query = new URLSearchParams(window.location.search);
    let routeNotice = "";
    if (query.get("checkout") === "success") {
      routeNotice = "Payment completed. Order and shipping/tracking messages are sent as transactional updates for this purchase.";
    } else if (query.get("checkout") === "cancelled") {
      routeNotice = "Checkout was cancelled. Your browser cart is still available if you want to try again.";
    }
    const statusMessage = status || routeNotice;
    main.innerHTML = `
      <section class="direct-store-shell wrap" aria-labelledby="direct-cart-page-title">
        <div class="direct-store-hero">
          <div>
            <p class="eyebrow">Secure checkout foundation</p>
            <h1 id="direct-cart-page-title">CardVector Cart</h1>
            <p>Review your cart and continue to Stripe Checkout. Stripe collects email, shipping address, and payment details securely.</p>
          </div>
          <a class="button secondary" href="/shop/">Continue Shopping</a>
        </div>
        <div class="direct-cart-page">
          <section class="direct-cart-panel direct-cart-page-panel" aria-labelledby="cart-review-title">
            <h2 id="cart-review-title">Cart Review</h2>
            <div id="direct-cart-lines">${renderDirectStoreCartLines(summary, catalog.currency)}</div>
            <div class="direct-cart-total">
              <span>Subtotal</span>
              <strong>${directStoreMoney(summary.subtotal, catalog.currency)}</strong>
            </div>
          </section>
          <form class="direct-checkout-form" id="direct-checkout-form">
            <h2>Secure Checkout</h2>
            <p>Stripe will collect the buyer email, shipping address, and payment information. Shipping and tracking messages are transactional order updates and do not require marketing opt-in.</p>
            <p class="operator-note">Promotional email opt-in will be enabled after Stripe Checkout marketing consent is approved. Paid orders queue private CardUploader/eBay release jobs after Stripe confirms payment.</p>
            <button class="button primary" type="submit"${summary.quantity ? "" : " disabled"}>Continue to Secure Checkout</button>
          </form>
        </div>
        ${statusMessage ? `<div class="direct-store-status" role="status">${escapeHtml(statusMessage)}</div>` : ""}
      </section>`;
    document.title = "Cart | Putnam Collectibles";
    bindDirectStoreEvents(catalog);
    const form = document.getElementById("direct-checkout-form");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type=\"submit\"]");
        if (button) {
          button.disabled = true;
          button.textContent = "Starting secure checkout...";
        }
        const latestCatalog = await loadDirectStoreCatalog();
        const result = await createDirectStoreCheckoutSession(latestCatalog, readDirectStoreCart());
        if (!result.ok) {
          renderDirectStoreCartShell(latestCatalog, readDirectStoreCart(), result.message);
          return;
        }
        window.location.assign(result.checkout_url);
      });
    }
  }

  function bindDirectStoreEvents(catalog) {
    document.querySelectorAll("[data-direct-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.getAttribute("data-direct-add");
        const cart = readDirectStoreCart();
        setDirectStoreCartQuantity(cart, itemId, directStoreCartQuantity(cart, itemId) + 1, catalog);
        renderDirectStoreShell(catalog, readDirectStoreCart(), { status: "Added to cart." });
      });
    });
    document.querySelectorAll("[data-cart-inc]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.getAttribute("data-cart-inc");
        const cart = readDirectStoreCart();
        setDirectStoreCartQuantity(cart, itemId, directStoreCartQuantity(cart, itemId) + 1, catalog);
        renderDirectStoreCartShell(catalog, readDirectStoreCart());
      });
    });
    document.querySelectorAll("[data-cart-dec]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.getAttribute("data-cart-dec");
        const cart = readDirectStoreCart();
        setDirectStoreCartQuantity(cart, itemId, directStoreCartQuantity(cart, itemId) - 1, catalog);
        renderDirectStoreCartShell(catalog, readDirectStoreCart());
      });
    });
    document.querySelectorAll("[data-cart-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.getAttribute("data-cart-remove");
        setDirectStoreCartQuantity(readDirectStoreCart(), itemId, 0, catalog);
        renderDirectStoreCartShell(catalog, readDirectStoreCart());
      });
    });
  }

  async function renderDirectStorePage() {
    const catalog = await loadDirectStoreCatalog();
    renderDirectStoreShell(catalog, readDirectStoreCart());
  }

  async function renderDirectStoreCartPage() {
    const catalog = await loadDirectStoreCatalog();
    renderDirectStoreCartShell(catalog, readDirectStoreCart());
  }

  const fallbackMarketBriefPosts = Object.freeze([
    {
      slug: "pokemon-market-brief",
      label: "Market Brief",
      title: "Putnam Collectibles Pokemon Market Brief",
      date: "2026-08-03",
      dateLabel: "Latest brief",
      summary: "A concise Pokemon market update covering recent movement, collector demand, notable products, and marketplace signals.",
      status: "published",
      sections: [
        {
          heading: "What moved",
          body: "A short summary of products, eras, or card categories showing meaningful activity."
        },
        {
          heading: "Why it matters",
          body: "Context for sellers and collectors, including demand signals, supply pressure, and pricing risk."
        },
        {
          heading: "What Putnam Collectibles is watching",
          body: "A practical watchlist for pricing review, inventory sourcing, and marketplace listing decisions."
        }
      ]
    }
  ]);
  let marketBriefPostsCache = null;

  function dateLabelForBrief(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Latest brief";
    const parsed = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function normalizeMarketBriefSection(section) {
    return {
      heading: String(section && section.heading || "Brief").trim(),
      body: String(section && section.body || "").trim()
    };
  }

  function defaultMarketBriefAffiliateLinks() {
    return [
      {
        label: "Shop Putnam Collectibles on eBay",
        url: siteLinks.EBAY_STORE_URL
      }
    ];
  }

  function normalizeMarketBriefAffiliateLink(link) {
    if (!link) {
      return null;
    }
    const label = String(link.label || "Shop related cards on eBay").trim();
    const url = String(link.url || "").trim();
    if (!label || !url.startsWith("https://")) {
      return null;
    }
    return { label, url };
  }

  function normalizeMarketBriefAffiliateLinks(post) {
    const rawLinks = Array.isArray(post && post.affiliateLinks) ? post.affiliateLinks : [];
    const links = rawLinks.map(normalizeMarketBriefAffiliateLink).filter(Boolean);
    return links.length ? links : defaultMarketBriefAffiliateLinks();
  }

  function normalizeMarketBriefPost(post) {
    const normalized = {
      slug: String(post && post.slug || "").trim(),
      label: String(post && post.label || "Market Brief").trim(),
      title: String(post && post.title || "Pokemon Market Brief").trim(),
      seoTitle: String(post && post.seoTitle || post && post.title || "Pokemon Market Brief").trim(),
      date: String(post && post.date || "").trim(),
      dateLabel: String(post && post.dateLabel || "").trim(),
      summary: String(post && post.summary || "").trim(),
      description: String(post && (post.description || post.summary) || "").trim(),
      searchIntent: String(post && post.searchIntent || "").trim(),
      status: String(post && post.status || "published").trim(),
      targetKeywords: Array.isArray(post && post.targetKeywords) ? post.targetKeywords.map((item) => String(item || "").trim()).filter(Boolean) : [],
      sections: Array.isArray(post && post.sections) ? post.sections.map(normalizeMarketBriefSection).filter((section) => section.body) : [],
      affiliateLinks: normalizeMarketBriefAffiliateLinks(post)
    };
    normalized.dateLabel = normalized.dateLabel || dateLabelForBrief(normalized.date);
    return normalized;
  }

  async function loadMarketBriefPosts() {
    if (marketBriefPostsCache) return marketBriefPostsCache;
    try {
      const response = await fetch("/content/market-briefs/index.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Market brief index returned ${response.status}`);
      const payload = await response.json();
      const posts = Array.isArray(payload && payload.posts)
        ? payload.posts.map(normalizeMarketBriefPost).filter((post) => post.slug && post.title)
        : [];
      marketBriefPostsCache = posts.length ? posts : fallbackMarketBriefPosts.map(normalizeMarketBriefPost);
    } catch (_exc) {
      marketBriefPostsCache = fallbackMarketBriefPosts.map(normalizeMarketBriefPost);
    }
    return marketBriefPostsCache;
  }

  function renderMarketBriefCard(post) {
    return `
      <article class="brief-card">
        <span class="brief-kicker">${escapeHtml(post.label)}</span>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.summary)}</p>
        <div class="brief-card-footer">
          <span>${escapeHtml(post.dateLabel)}</span>
          <a class="button secondary" href="/market-briefs/${escapeHtml(post.slug)}/">Open Brief</a>
        </div>
      </article>`;
  }

  async function renderMarketBriefsPage() {
    const posts = await loadMarketBriefPosts();
    main.innerHTML = `
      <section class="blog-shell wrap" aria-labelledby="market-briefs-page-title">
        <div class="blog-hero">
          <p class="eyebrow">Pokemon market updates for sellers</p>
          <h1 id="market-briefs-page-title">Pokemon Market Briefs for Card Sellers</h1>
          <p>Seller-focused notes on Pokemon card prices, collector demand, eBay and TCGplayer marketplace signals, inventory age, and practical pricing strategy.</p>
        </div>
        <div class="brief-seo-summary" aria-label="What Pokemon market briefs cover">
          <article>
            <h2>What these briefs cover</h2>
            <p>Each brief is written for small trading card sellers who need clear market context before pricing, repricing, or organizing inventory.</p>
          </article>
          <article>
            <h2>How to use them</h2>
            <p>Use these notes as a starting point for checking recent sold listings, stale inventory, card condition, and listing quality before making price changes.</p>
          </article>
        </div>
        <div class="brief-grid">
          ${posts.map(renderMarketBriefCard).join("")}
        </div>
        <nav class="brief-internal-links" aria-label="Related Putnam Collectibles pages">
          <a href="/tools/carduploader/">CardUploader workflow</a>
          <a href="/sell/">Sell Pokemon cards</a>
          <a href="${siteLinks.EBAY_STORE_URL}" target="_blank" rel="noopener noreferrer">Shop Pokemon cards on eBay</a>
          <a href="${siteLinks.TCGPLAYER_STORE_URL}" target="_blank" rel="noopener noreferrer">Shop Pokemon cards on TCGplayer</a>
        </nav>
        <aside class="brief-disclosure">
          <strong>Editorial note</strong>
          <p>Market briefs are informational commentary, not financial advice. Prices and demand can change quickly; verify current marketplace data before buying, selling, or repricing.</p>
        </aside>
      </section>`;
    document.title = "Pokemon Market Briefs for Card Sellers | Putnam Collectibles";
  }

  function renderBriefBody(body) {
    return String(body || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join("");
  }

  function renderAffiliateLinkPanel(post) {
    const links = Array.isArray(post && post.affiliateLinks) ? post.affiliateLinks : defaultMarketBriefAffiliateLinks();
    return `
      <aside class="brief-affiliate-panel" aria-label="Related affiliate links">
        <span class="brief-kicker">Shop related picks</span>
        <h2>Explore current listings</h2>
        <div class="brief-affiliate-links">
          ${links.map((link) => `
            <a class="button primary" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("")}
        </div>
        <p class="marketplace-disclosure">Marketplace links may be affiliate links. Putnam Collectibles may earn a commission from qualifying purchases.</p>
      </aside>`;
  }

  async function renderMarketBriefPost(slug) {
    const posts = await loadMarketBriefPosts();
    const post = posts.find((item) => item.slug === slug) || posts[0];
    main.innerHTML = `
      <article class="blog-shell blog-post wrap" aria-labelledby="market-brief-post-title">
        <a class="operator-inline-link" href="/market-briefs/">Back to Market Briefs</a>
        <p class="eyebrow">${escapeHtml(post.label)}</p>
        <h1 id="market-brief-post-title">${escapeHtml(post.title)}</h1>
        <p class="blog-meta">${escapeHtml(post.dateLabel)} &middot; ${escapeHtml(post.status)}</p>
        <p class="hero-lede">${escapeHtml(post.description || post.summary)}</p>
        <aside class="brief-answer-box">
          <strong>Quick answer</strong>
          <p>${escapeHtml(post.searchIntent || "Use this brief to understand the market signals behind Pokemon card price changes before buying, selling, or repricing inventory.")}</p>
        </aside>
        <div class="brief-post-layout">
          ${post.sections.map((section) => `
            <section class="brief-post-section">
              <h2>${escapeHtml(section.heading)}</h2>
              ${renderBriefBody(section.body)}
            </section>`).join("")}
        </div>
        ${renderAffiliateLinkPanel(post)}
        <nav class="brief-internal-links" aria-label="Related Putnam Collectibles pages">
          <a href="/market-briefs/">More Pokemon market briefs</a>
          <a href="/tools/carduploader/">CardUploader seller workflow</a>
          <a href="/sell/">Sell a Pokemon card collection</a>
        </nav>
        <aside class="brief-disclosure">
          <strong>How this brief is prepared</strong>
          <p>Putnam Collectibles uses ChatGPT-assisted research to identify possible market updates, then reviews each brief before publication. Future posts should include dated sources and current marketplace checks.</p>
        </aside>
      </article>`;
    document.title = `${post.seoTitle || post.title} | Putnam Collectibles`;
  }

  function captureConfig() {
    const cfg = window.CARDVECTOR_MOBILE_CAPTURE_CONFIG || {};
    return {
      supabaseUrl: String(cfg.supabaseUrl || "").trim(),
      supabaseAnonKey: String(cfg.supabaseAnonKey || "").trim(),
      originalImageBucket: String(cfg.originalImageBucket || "mobile-capture-originals").trim(),
      requireCanonicalRegistry: Boolean(cfg.requireCanonicalRegistry)
    };
  }

  function configuredSupabase() {
    const cfg = captureConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
      return null;
    }
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  function authStateLabel(user) {
    if (!user) {
      return "not signed in";
    }
    return user.email ? `signed in as ${user.email}` : "signed in";
  }

  function sanitizeErrorMessage(value) {
    return String(value || "Unknown error")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]")
      .replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi, "[supabase-url]");
  }

  function supabaseErrorDetails(operation, error, user) {
    const code = String(error && (error.code || error.status || error.statusCode || error.name) || "none");
    const message = sanitizeErrorMessage(error && (error.message || error.error_description || error.details) || error);
    return `${operation} failed. Code: ${code}. ${message}. Auth: ${authStateLabel(user)}.`;
  }

  function authTokenStateLabel(session) {
    return session && session.access_token ? "user bearer token present" : "user bearer token missing";
  }

  function storageErrorDetails(operation, response, body, user, session) {
    const status = response ? `${response.status} ${response.statusText || ""}`.trim() : "none";
    const code = body && (body.error || body.error_code || body.code || body.statusCode || body.status) || status;
    const message = body && (body.message || body.error_description || body.details) || body || "Unknown storage error";
    return `${operation} failed. Code: ${sanitizeErrorMessage(code)}. ${sanitizeErrorMessage(message)}. Auth: ${authStateLabel(user)}; ${authTokenStateLabel(session)}.`;
  }

  function normalizeCaptureType(value) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[-\s]+/g, "_");
    if (["NEW", "NEW_CAPTURE", "NEW_INVENTORY", "NEW_INVENTORY_CAPTURE"].includes(normalized)) {
      return "NEW_CAPTURE";
    }
    return "PHYSICAL_INVENTORY";
  }

  function captureTypeFromSlug(value) {
    const slug = String(value || "").trim().toLowerCase();
    if (["new", "new-capture", "new-inventory", "new-inventory-capture"].includes(slug)) {
      return "NEW_CAPTURE";
    }
    return "PHYSICAL_INVENTORY";
  }

  function normalizeCaptureLayout(value) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[-+\s]+/g, "_");
    if (["FRONT_BACK", "FRONT_AND_BACK", "BOTH", "PAIRED"].includes(normalized)) {
      return "FRONT_BACK";
    }
    return "FRONT_ONLY";
  }

  function captureLayoutFromSlug(value) {
    const slug = String(value || "").trim().toLowerCase();
    if (["front-back", "front-and-back", "both", "paired"].includes(slug)) {
      return "FRONT_BACK";
    }
    if (["front", "front-only"].includes(slug)) {
      return "FRONT_ONLY";
    }
    return "";
  }

  function capturePositionForOrder(order, captureLayout) {
    const sequence = Math.max(1, Number(order) || 1);
    if (normalizeCaptureLayout(captureLayout) === "FRONT_BACK") {
      return {
        cardNumber: Math.floor((sequence - 1) / 2) + 1,
        side: sequence % 2 === 1 ? "front" : "back"
      };
    }
    return { cardNumber: sequence, side: "front" };
  }

  function imageCapturePosition(image, index, captureLayout) {
    const cardNumber = Number(image && image.cardNumber);
    const side = String(image && image.side || "").toLowerCase();
    if (cardNumber > 0 && ["front", "back"].includes(side)) {
      return { cardNumber, side };
    }
    return capturePositionForOrder(index + 1, captureLayout);
  }

  function orderedCaptureImages(images, captureLayout) {
    return Array.from(images || [])
      .map((image, index) => ({ image, position: imageCapturePosition(image, index, captureLayout), index }))
      .sort((left, right) => {
        const cardDifference = left.position.cardNumber - right.position.cardNumber;
        if (cardDifference) {
          return cardDifference;
        }
        const sideDifference = (left.position.side === "front" ? 0 : 1) - (right.position.side === "front" ? 0 : 1);
        return sideDifference || left.index - right.index;
      })
      .map((item) => item.image);
  }

  function nextCapturePosition(images, captureLayout) {
    const normalizedLayout = normalizeCaptureLayout(captureLayout);
    const occupied = new Map();
    Array.from(images || []).forEach((image, index) => {
      const position = imageCapturePosition(image, index, normalizedLayout);
      if (!occupied.has(position.cardNumber)) {
        occupied.set(position.cardNumber, new Set());
      }
      occupied.get(position.cardNumber).add(position.side);
    });
    let cardNumber = 1;
    while (occupied.has(cardNumber)) {
      const sides = occupied.get(cardNumber);
      if (!sides.has("front")) {
        return { cardNumber, side: "front" };
      }
      if (normalizedLayout === "FRONT_BACK" && !sides.has("back")) {
        return { cardNumber, side: "back" };
      }
      cardNumber += 1;
    }
    return { cardNumber, side: "front" };
  }

  function captureLayoutIsComplete(images, captureLayout) {
    if (!images.length) {
      return false;
    }
    if (normalizeCaptureLayout(captureLayout) === "FRONT_ONLY") {
      return true;
    }
    const cards = new Map();
    Array.from(images || []).forEach((image, index) => {
      const position = imageCapturePosition(image, index, captureLayout);
      if (!cards.has(position.cardNumber)) {
        cards.set(position.cardNumber, new Set());
      }
      cards.get(position.cardNumber).add(position.side);
    });
    return Array.from(cards.values()).every((sides) => sides.has("front") && sides.has("back"));
  }

  function captureCardCount(images, captureLayout) {
    const cards = new Set();
    Array.from(images || []).forEach((image, index) => {
      cards.add(imageCapturePosition(image, index, captureLayout).cardNumber);
    });
    return cards.size;
  }

  function legacySessionKey(etbId, location, captureType) {
    return `cardvector.mobileCapture.${normalizeCaptureType(captureType)}.${etbId}.${location}`;
  }

  function sessionKey(etbId, location, captureType, captureLayout) {
    return `${legacySessionKey(etbId, location, captureType)}.${normalizeCaptureLayout(captureLayout)}`;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getStoredSession(etbId, location, captureType, captureLayout) {
    try {
      const stored = localStorage.getItem(sessionKey(etbId, location, captureType, captureLayout))
        || localStorage.getItem(legacySessionKey(etbId, location, captureType));
      const session = JSON.parse(stored || "null");
      if (session) {
        session.capture_type = normalizeCaptureType(session.capture_type || captureType);
        session.capture_layout = normalizeCaptureLayout(
          session.capture_layout
          || (session.device && session.device.capture_layout)
          || captureLayout
        );
        session.device = {
          ...(session.device || {}),
          capture_type: session.capture_type,
          capture_layout: session.capture_layout
        };
      }
      return session;
    } catch (_exc) {
      return null;
    }
  }

  function saveStoredSession(etbId, location, session) {
    const captureType = normalizeCaptureType(session && session.capture_type);
    const captureLayout = normalizeCaptureLayout(session && session.capture_layout);
    localStorage.setItem(sessionKey(etbId, location, captureType, captureLayout), JSON.stringify(session));
    localStorage.removeItem(legacySessionKey(etbId, location, captureType));
  }

  function newDraft(etbId, location, captureType, captureLayout) {
    const createdAt = new Date().toISOString();
    const normalizedType = normalizeCaptureType(captureType);
    const normalizedLayout = normalizeCaptureLayout(captureLayout);
    return {
      capture_session_id: uuid(),
      etb_location: `${etbId}-${location}`,
      capture_type: normalizedType,
      capture_layout: normalizedLayout,
      created_at: createdAt,
      submitted_at: null,
      status: "DRAFT",
      source: "MOBILE_WEB",
      operator: "",
      operator_id: "",
      device: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform || "",
        capture_type: normalizedType,
        capture_layout: normalizedLayout
      },
      image_count: 0,
      original_image_locations: [],
      conversion_status: "",
      conversion_workstation: ""
    };
  }

  function openCaptureDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(captureDbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(captureStoreName)) {
          const store = db.createObjectStore(captureStoreName, { keyPath: "id" });
          store.createIndex("sessionId", "sessionId", { unique: false });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function saveDraftImages(sessionId, files, captureLayout = "FRONT_ONLY") {
    const normalizedLayout = normalizeCaptureLayout(captureLayout);
    const existing = await loadDraftImages(sessionId);
    const virtualImages = [...existing];
    const db = await openCaptureDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readwrite");
      const store = tx.objectStore(captureStoreName);
      Array.from(files).forEach((file) => {
        const id = uuid();
        const position = nextCapturePosition(virtualImages, normalizedLayout);
        const row = {
          id,
          sessionId,
          file,
          name: file.name || `${id}.jpg`,
          type: file.type || "image/jpeg",
          size: file.size || 0,
          origin: "PHOTO_LIBRARY",
          captureLayout: normalizedLayout,
          cardNumber: position.cardNumber,
          side: position.side,
          createdAt: new Date().toISOString()
        };
        store.put(row);
        virtualImages.push(row);
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function saveDraftBlob(sessionId, blob, name, origin = "LIVE_CAMERA", captureLayout = "FRONT_ONLY") {
    const normalizedLayout = normalizeCaptureLayout(captureLayout);
    const existing = await loadDraftImages(sessionId);
    const position = nextCapturePosition(existing, normalizedLayout);
    const db = await openCaptureDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readwrite");
      const id = uuid();
      tx.objectStore(captureStoreName).put({
        id,
        sessionId,
        file: blob,
        name: name || `${id}.jpg`,
        type: blob.type || "image/jpeg",
        size: blob.size || 0,
        origin,
        captureLayout: normalizedLayout,
        cardNumber: position.cardNumber,
        side: position.side,
        createdAt: new Date().toISOString()
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function loadDraftImages(sessionId) {
    const db = await openCaptureDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readonly");
      const index = tx.objectStore(captureStoreName).index("sessionId");
      const request = index.getAll(sessionId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    db.close();
    return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async function removeDraftImage(imageId) {
    const db = await openCaptureDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readwrite");
      tx.objectStore(captureStoreName).delete(imageId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function clearDraftImages(sessionId) {
    const images = await loadDraftImages(sessionId);
    const db = await openCaptureDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readwrite");
      const store = tx.objectStore(captureStoreName);
      images.forEach((image) => store.delete(image.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function captureChoiceHtml(etbId, location) {
    return `
      <section class="mobile-capture capture-choice" aria-labelledby="capture-choice-title">
        <div class="capture-header">
          <div>
            <p class="eyebrow">Mobile Capture</p>
            <h2 id="capture-choice-title">Choose capture type</h2>
            <p>Scanning this QR opens the location check only. Start camera capture when you are ready.</p>
          </div>
        </div>
        <div class="capture-type-grid">
          <a class="capture-type-card" href="/capture/${encodeURIComponent(etbId)}/${encodeURIComponent(location)}/${captureTypeConfig.NEW_CAPTURE.slug}">
            <strong>New Inventory Capture</strong>
            <span>Use for new card intake sessions.</span>
          </a>
          <a class="capture-type-card" href="/capture/${encodeURIComponent(etbId)}/${encodeURIComponent(location)}/${captureTypeConfig.PHYSICAL_INVENTORY.slug}">
            <strong>Physical Inventory Conversion</strong>
            <span>Use for converting cards already stored in this location.</span>
          </a>
        </div>
      </section>`;
  }

  function captureLayoutChoiceHtml(etbId, location, captureType) {
    const type = captureTypeConfig[normalizeCaptureType(captureType)];
    return `
      <section class="mobile-capture capture-choice" aria-labelledby="capture-layout-title">
        <div class="capture-header">
          <div>
            <p class="eyebrow">${escapeHtml(type.shortLabel)}</p>
            <h2 id="capture-layout-title">Choose photo mode</h2>
            <p>Choose whether each card needs a front image only or a matched front-and-back pair.</p>
          </div>
        </div>
        <div class="capture-type-grid">
          ${Object.entries(captureLayoutConfig).map(([layout, config]) => `
            <a class="capture-type-card" href="${captureRoute(etbId, location, captureType, layout)}">
              <strong>${escapeHtml(config.label)}</strong>
              <span>${escapeHtml(config.description)}</span>
            </a>`).join("")}
        </div>
        <button class="entry-back" id="capture-layout-back" type="button">Back</button>
      </section>`;
  }

  function captureScreenHtml(etbId, location, captureType, captureLayout) {
    const type = captureTypeConfig[normalizeCaptureType(captureType)];
    const layout = captureLayoutConfig[normalizeCaptureLayout(captureLayout)];
    return `
      <section class="mobile-capture capture-screen" aria-labelledby="capture-title">
        <div class="capture-header">
          <div>
            <p class="eyebrow">Mobile Capture</p>
            <h2 id="capture-title">${escapeHtml(type.title)}</h2>
            <p>${escapeHtml(layout.description)} Use the rear camera when available.</p>
          </div>
          <span class="capture-status" id="capture-status">DRAFT</span>
        </div>
        <div class="capture-summary" aria-live="polite">
          <div><span>ETB Location</span><strong id="capture-location">${escapeHtml(etbId)}-${escapeHtml(location)}</strong></div>
          <div><span>Capture Type</span><strong id="capture-type-label">${escapeHtml(type.shortLabel)}</strong></div>
          <div><span>Photo Mode</span><strong id="capture-layout-label">${escapeHtml(layout.shortLabel)}</strong></div>
          <div><span>Next Photo</span><strong id="capture-next-photo">Card 1 Front</strong></div>
          <div><span>Session</span><strong id="capture-session-id">Not started</strong></div>
          <div><span>Images</span><strong id="capture-image-count">0</strong></div>
        </div>
        <div class="capture-operator" id="capture-operator" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth" id="capture-auth"></div>
        <div class="camera-controls" id="camera-controls" hidden>
          <label for="camera-device-select">Camera</label>
          <select id="camera-device-select" aria-label="Choose camera for capture"></select>
          <span id="camera-device-status" aria-live="polite">Camera selection appears after permission is granted.</span>
        </div>
        <div class="camera-shell">
          <video id="capture-video" playsinline muted autoplay></video>
          <canvas id="capture-canvas" hidden></canvas>
          <div class="camera-card-guide" aria-hidden="true"></div>
          <div class="camera-fallback" id="camera-fallback">Camera not started.</div>
        </div>
        <div class="capture-actions capture-actions-main">
          <button class="button primary capture-button shutter-button" id="camera-shutter" type="button">Capture Photo</button>
          <label class="button secondary capture-file-label" for="capture-files">Choose from Photo Library</label>
          <input id="capture-files" class="capture-file-input" type="file" accept="image/*" multiple>
          <button class="button primary capture-button" id="upload-capture" type="button">Finish Session</button>
        </div>
        <button class="entry-back" id="capture-back" type="button">Back</button>
        <div class="capture-progress" aria-live="polite">
          <progress id="capture-progress" max="100" value="0"></progress>
          <span id="capture-progress-text">Ready</span>
        </div>
        <div class="capture-thumbs" id="capture-thumbs" aria-label="Captured photo thumbnails"></div>
      </section>`;
  }

  function captureRoute(etbId, location, captureType, captureLayout = "") {
    const type = captureTypeConfig[normalizeCaptureType(captureType)];
    const base = `/capture/${encodeURIComponent(mobileCore.normalizeEtbId(etbId))}/${encodeURIComponent(mobileCore.normalizeLocationCode(location))}/${type.slug}`;
    if (!captureLayout) {
      return base;
    }
    return `${base}/${captureLayoutConfig[normalizeCaptureLayout(captureLayout)].slug}`;
  }

  function captureEntryShellHtml(title = "Start Mobile Capture") {
    return `
      <section class="mobile-capture capture-entry" aria-labelledby="mobile-entry-title">
        <div class="capture-header">
          <div>
            <p class="eyebrow">CardVector Mobile</p>
            <h2 id="mobile-entry-title">${escapeHtml(title)}</h2>
            <p>Choose the workflow and destination before starting the camera.</p>
          </div>
        </div>
        <div class="capture-operator" id="mobile-entry-operator" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth" id="mobile-entry-auth"></div>
        <div id="mobile-draft-resume"></div>
        <div id="mobile-entry-body" aria-live="polite"></div>
      </section>`;
  }

  function entrySummaryHtml(state) {
    const type = state.captureType ? captureTypeConfig[normalizeCaptureType(state.captureType)].shortLabel : "Not selected";
    const layout = state.captureLayout ? captureLayoutConfig[normalizeCaptureLayout(state.captureLayout)].shortLabel : "Not selected";
    return `
      <div class="entry-summary">
        <div><span>Capture Type</span><strong>${escapeHtml(type)}</strong></div>
        <div><span>Photo Mode</span><strong>${escapeHtml(layout)}</strong></div>
        <div><span>ETB</span><strong>${escapeHtml(state.etbId || "Not selected")}</strong></div>
        <div><span>Location</span><strong>${escapeHtml(state.location || "Not selected")}</strong></div>
      </div>`;
  }

  async function requireLocationAuthorization(client, user) {
    const result = await client
      .from("cardvector_location_operators")
      .select("user_id,can_manage_locations")
      .eq("user_id", user.id)
      .limit(1);
    if (result.error) {
      throw new Error(supabaseErrorDetails("Check location authorization", result.error, user));
    }
    if (!result.data || !result.data.length || !result.data[0].can_manage_locations) {
      throw new Error("This signed-in operator is not authorized for location management.");
    }
  }

  function isMissingCanonicalRegistry(error) {
    const text = `${error && (error.code || error.status || error.statusCode || error.message || error.details) || error}`.toLowerCase();
    return text.includes("404")
      || text.includes("42p01")
      || text.includes("not found")
      || text.includes("could not find")
      || text.includes("schema cache")
      || text.includes("does not exist");
  }

  function canonicalStatusFromLegacy(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[-_]+/g, " ");
    if (normalized === "location complete") return "location_complete";
    if (normalized === "needs review") return "needs_review";
    if (normalized === "full") return "full";
    if (normalized === "empty") return "empty";
    if (normalized === "mobile capture staged") return "staged";
    return "active";
  }

  async function listCanonicalEtbs(client, user) {
    const result = await client
      .from("cardvector_storage_locations")
      .select("id,name,display_code,status,capacity,metadata,updated_at")
      .eq("location_type", "etb")
      .is("archived_at", null)
      .order("display_code", { ascending: true });
    if (result.error) {
      throw result.error;
    }
    return (result.data || []).map((item) => ({
      canonical_location_uuid: item.id,
      etb_id: item.display_code || item.name,
      status: item.status,
      capacity: item.capacity || 400,
      active_location_code: item.metadata && (item.metadata.current_active_location || item.metadata.active_location) || "",
      updated_at: item.updated_at
    })).filter((item) => {
      try {
        mobileCore.normalizeEtbId(item.etb_id);
        return true;
      } catch (_exc) {
        return false;
      }
    });
  }

  async function listCloudEtbs(client, user) {
    try {
      const canonical = await listCanonicalEtbs(client, user);
      if (canonical.length) {
        return canonical;
      }
    } catch (error) {
      if (!isMissingCanonicalRegistry(error)) {
        throw new Error(supabaseErrorDetails("Load canonical ETBs", error, user));
      }
    }
    const result = await client
      .from("cardvector_etbs")
      .select("etb_id,status,capacity,active_location_code,updated_at")
      .order("etb_id", { ascending: true });
    if (result.error) {
      throw new Error(supabaseErrorDetails("Load ETBs", result.error, user));
    }
    return (result.data || []).filter((item) => {
      try {
        mobileCore.normalizeEtbId(item.etb_id);
        return true;
      } catch (_exc) {
        return false;
      }
    });
  }

  async function findCanonicalEtb(client, etbId) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
    const result = await client
      .from("cardvector_storage_locations")
      .select("id,display_code")
      .eq("location_type", "etb")
      .eq("display_code", canonicalEtb)
      .is("archived_at", null)
      .limit(1);
    if (result.error) {
      throw result.error;
    }
    return result.data && result.data.length ? result.data[0] : null;
  }

  async function listCanonicalLocations(client, user, etbId) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
    const etb = await findCanonicalEtb(client, canonicalEtb);
    if (!etb) {
      return [];
    }
    const result = await client
      .from("cardvector_storage_locations")
      .select("id,display_code,legacy_etb_id,legacy_location_code,status,capacity,stored_count,metadata,updated_at")
      .eq("parent_location_id", etb.id)
      .eq("location_type", "slot")
      .is("archived_at", null)
      .order("legacy_location_code", { ascending: true });
    if (result.error) {
      throw result.error;
    }
    return (result.data || []).map((item) => ({
      canonical_location_uuid: item.id,
      location_id: item.display_code || mobileCore.canonicalLocationId(canonicalEtb, item.legacy_location_code),
      etb_id: canonicalEtb,
      location_code: item.legacy_location_code,
      status: item.status,
      capacity: item.capacity || 40,
      stored_count: item.stored_count || 0,
      assigned_batch: item.metadata && item.metadata.assigned_batch || "",
      updated_at: item.updated_at
    })).filter((item) => {
      try {
        return item.location_id === mobileCore.canonicalLocationId(item.etb_id, item.location_code);
      } catch (_exc) {
        return false;
      }
    });
  }

  async function listCloudLocations(client, user, etbId) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
    try {
      const canonical = await listCanonicalLocations(client, user, canonicalEtb);
      if (canonical.length) {
        return canonical;
      }
    } catch (error) {
      if (!isMissingCanonicalRegistry(error)) {
        throw new Error(supabaseErrorDetails("Load canonical locations", error, user));
      }
    }
    const result = await client
      .from("cardvector_locations")
      .select("location_id,etb_id,location_code,status,capacity,stored_count,assigned_batch,updated_at")
      .eq("etb_id", canonicalEtb)
      .order("location_code", { ascending: true });
    if (result.error) {
      throw new Error(supabaseErrorDetails("Load locations", result.error, user));
    }
    return (result.data || []).filter((item) => {
      try {
        return item.location_id === mobileCore.canonicalLocationId(item.etb_id, item.location_code);
      } catch (_exc) {
        return false;
      }
    });
  }

  function locationStoredLabel(location) {
    const stored = Number(location && location.stored_count || 0);
    return stored === 1 ? "1 card" : `${stored} cards`;
  }

  function compactStatusLabel(value) {
    const label = String(value || "unknown").replace(/[_-]+/g, " ").trim();
    return label ? label.replace(/\b\w/g, (match) => match.toUpperCase()) : "Unknown";
  }

  function safeDateLabel(value) {
    if (!value) {
      return "Not available";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function locationDisplayCode(location) {
    return location && (location.display_code || location.location_id || location.legacy_id || location.name) || "";
  }

  function captureSessionLocationKey(session) {
    const metadata = session && session.migration_metadata || {};
    const legacy = session && (session.legacy_etb_location_id || metadata.legacy_etb_location_id || metadata.etb_location_id);
    return legacy || "";
  }

  function egressCacheKey(name, user) {
    return `cardvector.egressSafe.${name}.${user && user.id || "anonymous"}`;
  }

  function readEgressCache(name, user) {
    if (!egressSafeMode) return null;
    try {
      const payload = JSON.parse(localStorage.getItem(egressCacheKey(name, user)) || "null");
      if (!payload || !payload.cachedAt || Date.now() - payload.cachedAt > egressSafeCacheMs) {
        return null;
      }
      return payload;
    } catch (_exc) {
      return null;
    }
  }

  function writeEgressCache(name, user, data) {
    if (!egressSafeMode) return;
    try {
      localStorage.setItem(egressCacheKey(name, user), JSON.stringify({
        cachedAt: Date.now(),
        data
      }));
    } catch (_exc) {
      // Cache pressure should not block the operator workflow.
    }
  }

  function cacheFreshnessLabel(value) {
    if (!value) return "Live Supabase read";
    return `Cached ${safeDateLabel(value)}`;
  }

  async function queryOptionalTable(client, table, select, applyQuery) {
    let query = client.from(table).select(select);
    if (typeof applyQuery === "function") {
      query = applyQuery(query);
    }
    const result = await query;
    if (result.error) {
      if (isMissingCanonicalRegistry(result.error)) {
        return { data: [], missing: true };
      }
      throw result.error;
    }
    return { data: result.data || [], missing: false };
  }

  async function loadOperatorRegistry(client, user, options = {}) {
    await requireLocationAuthorization(client, user);
    const cached = !options.forceRefresh ? readEgressCache("operatorRegistry", user) : null;
    if (cached) {
      return { ...cached.data, cache: { cached: true, cachedAt: cached.cachedAt } };
    }
    const locationsResult = await queryOptionalTable(
      client,
      "cardvector_storage_locations",
      "id,name,display_code,parent_location_id,location_type,status,capacity,stored_count,sync_state,legacy_id,legacy_etb_id,legacy_location_code,updated_at,archived_at",
      (query) => query.is("archived_at", null).order("display_code", { ascending: true }).limit(egressSafeLimits.registryLocations)
    );
    const sessionsResult = await queryOptionalTable(
      client,
      "cardvector_capture_sessions",
      "id,legacy_session_id,legacy_etb_location_id,location_id,status,source_application,photo_count,processed_count,recognized_count,failed_count,sync_state,created_at,updated_at,completed_at,archived_at",
      (query) => query.is("archived_at", null).order("updated_at", { ascending: false }).limit(egressSafeLimits.registrySessions)
    );
    const batchesResult = await queryOptionalTable(
      client,
      "cardvector_location_carduploader_batches_v",
      "id,location_id,canonical_location_display_code,location_display_code,etb_display_code,carduploader_batch_id,carduploader_batch_url,carduploader_batch_name,batch_label,event_type,card_count,batch_date,updated_at",
      (query) => query.order("batch_date", { ascending: false }).limit(egressSafeLimits.registryBatches)
    );
    const data = {
      locations: locationsResult.data,
      sessions: sessionsResult.data,
      batches: batchesResult.data,
      missing: {
        locations: locationsResult.missing,
        sessions: sessionsResult.missing,
        batches: batchesResult.missing
      },
      cache: { cached: false, cachedAt: Date.now() }
    };
    writeEgressCache("operatorRegistry", user, data);
    return data;
  }

  function renderOperatorDashboard() {
    main.innerHTML = `
      <section class="operator-shell wrap" aria-labelledby="operator-title">
        <div class="operator-hero">
          <p class="eyebrow">CardVector workspace</p>
          <h1 id="operator-title">Operator Dashboard</h1>
          <p>Use CardVector.app as the primary operating surface for CardUploader batch references and controlled repricing review.</p>
        </div>
        <div class="operator-grid" aria-label="Operator workflows">
          <a class="operator-card" href="/operator/batches">
            <span>Batch</span>
            <strong>Batch References</strong>
            <p>Review CardUploader batch-history names and linked ETB locations.</p>
          </a>
          <a class="operator-card" href="/operator/repricing" aria-label="Open repricing review">
            <span>Pricing</span>
            <strong>Repricing Review</strong>
            <p>Review CardUploader automatic-inventory price recommendations, approve safe rows, and download the reviewed plan without live marketplace writes.</p>
          </a>
        </div>
      </section>`;
    document.title = "Operator Dashboard | CardVector";
  }

  function registryWarningHtml(registry) {
    const warnings = [];
    if (registry.missing.locations) {
      warnings.push("Canonical storage-location table is not available yet.");
    }
    if (registry.missing.sessions) {
      warnings.push("Canonical capture-session table is not available yet.");
    }
    if (registry.missing.batches) {
      warnings.push("CardUploader batch-event view is pending migration or not available.");
    }
    if (!warnings.length) {
      return "";
    }
    return `<div class="operator-warning" role="status">${warnings.map(escapeHtml).join(" ")}</div>`;
  }

  function renderSlot(slot, sessionCount, batchCount) {
    return `
      <article class="registry-slot">
        <div>
          <span>${escapeHtml(locationDisplayCode(slot))}</span>
          <strong>${escapeHtml(compactStatusLabel(slot.status))}</strong>
        </div>
        <dl>
          <div><dt>Cards</dt><dd>${escapeHtml(locationStoredLabel(slot))}</dd></div>
          <div><dt>Sync</dt><dd>${escapeHtml(compactStatusLabel(slot.sync_state))}</dd></div>
          <div><dt>Captures</dt><dd>${sessionCount}</dd></div>
          <div><dt>Batches</dt><dd>${batchCount}</dd></div>
        </dl>
        <p>Updated ${escapeHtml(safeDateLabel(slot.updated_at))}</p>
      </article>`;
  }

  function renderEtbCard(etb, slots, sessionsByLocation, batchesByLocation) {
    const etbCode = locationDisplayCode(etb);
    const slotHtml = slots.length
      ? slots.map((slot) => {
        const key = locationDisplayCode(slot);
        const sessionCount = (sessionsByLocation.get(slot.id) || sessionsByLocation.get(key) || []).length;
        const batchCount = (batchesByLocation.get(slot.id) || batchesByLocation.get(key) || []).length;
        return renderSlot(slot, sessionCount, batchCount);
      }).join("")
      : '<p class="operator-empty">No synchronized slots are available for this ETB.</p>';
    const stored = slots.reduce((total, slot) => total + Number(slot.stored_count || 0), 0);
    return `
      <section class="registry-etb-card" aria-labelledby="registry-${escapeHtml(etbCode)}">
        <header>
          <div>
            <span>ETB</span>
            <h2 id="registry-${escapeHtml(etbCode)}">${escapeHtml(etbCode)}</h2>
          </div>
          <span class="registry-state">${escapeHtml(compactStatusLabel(etb.status))}</span>
        </header>
        <div class="registry-metrics">
          <div><span>Cards</span><strong>${stored}</strong></div>
          <div><span>Slots</span><strong>${slots.length}</strong></div>
          <div><span>Sync</span><strong>${escapeHtml(compactStatusLabel(etb.sync_state))}</strong></div>
          <div><span>Updated</span><strong>${escapeHtml(safeDateLabel(etb.updated_at))}</strong></div>
        </div>
        <div class="registry-slot-grid">${slotHtml}</div>
      </section>`;
  }

  function renderRecentSessions(sessions) {
    if (!sessions.length) {
      return '<p class="operator-empty">No canonical capture sessions are available yet.</p>';
    }
    return sessions.slice(0, 8).map((session) => `
      <article class="operator-list-row">
        <div>
          <strong>${escapeHtml(session.legacy_session_id || session.id)}</strong>
          <span>${escapeHtml(session.source_application || "CardVector")} &middot; ${escapeHtml(captureSessionLocationKey(session) || "No location")}</span>
        </div>
        <div>
          <span>${Number(session.photo_count || 0)} photos</span>
          <strong>${escapeHtml(compactStatusLabel(session.status))}</strong>
        </div>
      </article>`).join("");
  }

  function batchLocationLabel(batch) {
    return batch && (
      batch.canonical_location_display_code ||
      batch.location_display_code ||
      batch.etb_display_code ||
      batch.location_id
    ) || "Unassigned";
  }

  function batchReferenceLabel(batch) {
    const location = batchLocationLabel(batch);
    const eventType = compactStatusLabel(batch && batch.event_type || "batch reference");
    const date = shortDateLabel(batch && (batch.batch_date || batch.updated_at));
    if (location && location !== "Unassigned") {
      return `${location} ${eventType}${date ? ` - ${date}` : ""}`;
    }
    return `CardUploader ${eventType}${date ? ` - ${date}` : ""}`;
  }

  function shortDateLabel(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function shortBatchId(value) {
    const id = String(value || "").trim();
    if (!id) {
      return "";
    }
    return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
  }

  function safeCardUploaderUrl(value) {
    const href = String(value || "").trim();
    if (/^https:\/\/(www\.)?carduploader\.com\//i.test(href)) {
      return href;
    }
    return "";
  }

  function safeCardUploaderBatchHistoryUrl(value) {
    const href = safeCardUploaderUrl(value);
    if (/^https:\/\/(www\.)?carduploader\.com\/dashboard\/history\//i.test(href)) {
      return href;
    }
    return "";
  }

  function batchHasCardUploaderHistoryEvidence(batch) {
    return Boolean(safeCardUploaderBatchHistoryUrl(batch && batch.carduploader_batch_url));
  }

  function batchHasSlotLocation(batch) {
    const location = batchLocationLabel(batch);
    return /^ETB-\d{3}-[A-Z]$/i.test(location);
  }

  function batchSortTimestamp(batch) {
    const value = batch && (batch.batch_date || batch.created_at || batch.updated_at || batch.source_updated_at);
    const timestamp = Date.parse(value || "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function sortedBatchReferences(batches) {
    return [...batches].sort((left, right) => {
      const leftLocation = batchLocationLabel(left);
      const rightLocation = batchLocationLabel(right);
      if (leftLocation !== rightLocation) {
        return leftLocation.localeCompare(rightLocation);
      }
      const dateDifference = batchSortTimestamp(left) - batchSortTimestamp(right);
      if (dateDifference) {
        return dateDifference;
      }
      return String(left.carduploader_batch_id || left.batch_label || "").localeCompare(String(right.carduploader_batch_id || right.batch_label || ""));
    });
  }

  function groupBatchReferencesByLocation(batches) {
    const groups = new Map();
    sortedBatchReferences(batches).forEach((batch) => {
      if (!batchHasSlotLocation(batch)) {
        return;
      }
      const location = batchLocationLabel(batch);
      if (!groups.has(location)) {
        groups.set(location, {
          location,
          batches: [],
          totalCards: 0,
          latestTimestamp: 0
        });
      }
      const group = groups.get(location);
      const sequence = group.batches.length + 1;
      group.batches.push({
        ...batch,
        sequence_label: `${location}.${sequence}`
      });
      group.totalCards += Number(batch.card_count || 0);
      group.latestTimestamp = Math.max(group.latestTimestamp, batchSortTimestamp(batch));
    });
    return [...groups.values()];
  }

  function batchReviewReason(batch) {
    const location = batchLocationLabel(batch);
    if (location === "Unassigned") {
      return "No ETB slot is linked yet.";
    }
    if (/^ETB-\d{3}$/i.test(location)) {
      return "Linked to an ETB, but not a specific A-J slot.";
    }
    return "Needs location review before it can be grouped.";
  }

  function renderBatchPill(batch) {
    const batchUrl = safeCardUploaderBatchHistoryUrl(batch.carduploader_batch_url);
    const date = shortDateLabel(batch.batch_date || batch.created_at || batch.updated_at);
    return `
      <li class="batch-pill">
        <strong>${escapeHtml(batch.sequence_label || batch.batch_label || batchReferenceLabel(batch))}</strong>
        <span>${Number(batch.card_count || 0)} cards${date ? ` - ${escapeHtml(date)}` : ""}</span>
        ${batch.carduploader_batch_id ? `<span class="batch-technical-id" title="${escapeHtml(batch.carduploader_batch_id)}">${escapeHtml(shortBatchId(batch.carduploader_batch_id))}</span>` : ""}
        ${batchUrl ? `<a class="operator-inline-link" href="${escapeHtml(batchUrl)}" target="_blank" rel="noopener noreferrer">Open batch</a>` : ""}
      </li>`;
  }

  function renderBatchLocationWorkboard(batches) {
    const groups = groupBatchReferencesByLocation(batches);
    if (!groups.length) {
      return '<p class="operator-empty">No CardUploader batches are linked to specific ETB slots yet.</p>';
    }
    return `
      <div class="batch-location-grid">
        ${groups.map((group) => `
          <article class="batch-location-card">
            <header>
              <div>
                <span>Location</span>
                <h3>${escapeHtml(group.location)}</h3>
              </div>
              <strong>${group.batches.length} ${group.batches.length === 1 ? "batch" : "batches"}</strong>
            </header>
            <dl>
              <div><dt>Cards</dt><dd>${group.totalCards}</dd></div>
              <div><dt>Latest</dt><dd>${escapeHtml(shortDateLabel(group.latestTimestamp))}</dd></div>
            </dl>
            <ul class="batch-pill-list">${group.batches.map(renderBatchPill).join("")}</ul>
          </article>`).join("")}
      </div>`;
  }

  function renderBatchReviewRows(batches) {
    const reviewBatches = sortedBatchReferences(batches).filter((batch) => !batchHasSlotLocation(batch));
    if (!reviewBatches.length) {
      return '<p class="operator-empty">No unassigned or broad ETB batch references need review.</p>';
    }
    return reviewBatches.slice(0, 20).map((batch) => `
      <article class="operator-list-row batch-reference-row">
        <div>
          <strong>${escapeHtml(batchReferenceLabel(batch))}</strong>
          <span>${escapeHtml(batchReviewReason(batch))}</span>
          ${batch.batch_label ? `<span>${escapeHtml(batch.batch_label)}</span>` : ""}
        </div>
        <div>
          <span>${Number(batch.card_count || 0)} cards</span>
          <strong>${escapeHtml(compactStatusLabel(batch.event_type || "batch reference"))}</strong>
        </div>
      </article>`).join("");
  }

  function renderBatchReferenceRows(batches) {
    if (!batches.length) {
      return '<p class="operator-empty">No CardUploader batch-history references are available yet.</p>';
    }
    return sortedBatchReferences(batches).slice(0, 80).map((batch) => {
      const batchUrl = safeCardUploaderBatchHistoryUrl(batch.carduploader_batch_url);
      return `
        <article class="operator-list-row batch-reference-row">
          <div>
            <strong>${escapeHtml(batchReferenceLabel(batch))}</strong>
            <span>${Number(batch.card_count || 0)} cards &middot; ${escapeHtml(batch.game || "CardUploader")}${batch.language ? ` &middot; ${escapeHtml(batch.language)}` : ""}</span>
            ${batch.batch_label ? `<span>${escapeHtml(batch.batch_label)}</span>` : ""}
            ${batch.carduploader_batch_id ? `<span class="batch-technical-id" title="${escapeHtml(batch.carduploader_batch_id)}">CardUploader ID: ${escapeHtml(shortBatchId(batch.carduploader_batch_id))}</span>` : ""}
            ${batchUrl ? `<a class="operator-inline-link" href="${escapeHtml(batchUrl)}" target="_blank" rel="noopener noreferrer">Open CardUploader batch</a>` : ""}
          </div>
          <div>
            <span>${escapeHtml(batchLocationLabel(batch))}</span>
            <strong>${escapeHtml(compactStatusLabel(batch.event_type || "batch reference"))}</strong>
          </div>
        </article>`;
    }).join("");
  }

  function renderOperatorBatchWorkflowView(registry, user) {
    const historyBatches = registry.batches.filter(batchHasCardUploaderHistoryEvidence);
    const linkedLocations = new Set(historyBatches.filter(batchHasSlotLocation).map(batchLocationLabel));
    const referencedCards = historyBatches.reduce((total, batch) => total + Number(batch.card_count || 0), 0);
    const latestTimestamp = historyBatches.reduce((latest, batch) => Math.max(latest, batchSortTimestamp(batch)), 0);
    main.innerHTML = `
      <section class="operator-shell wrap batch-shell" aria-labelledby="batch-workflow-title">
        <div class="operator-toolbar">
          <div>
            <p class="eyebrow">CardUploader history</p>
            <h1 id="batch-workflow-title">Batch References</h1>
            <p>Signed in as ${escapeHtml(authStateLabel(user))}. This page shows only batches with CardUploader batch-history links.</p>
          </div>
          <div class="operator-toolbar-actions">
            <a class="button secondary" href="/operator">Operator Dashboard</a>
            <a class="button primary" href="https://carduploader.com/dashboard/history" target="_blank" rel="noopener noreferrer">Open CardUploader Batches</a>
          </div>
        </div>
        ${registryWarningHtml(registry)}
        <div class="registry-summary batch-summary">
          <div><span>CardUploader Batches</span><strong>${historyBatches.length}</strong></div>
          <div><span>Linked Slots</span><strong>${linkedLocations.size}</strong></div>
          <div><span>Referenced Cards</span><strong>${referencedCards}</strong></div>
          <div><span>Latest Seen</span><strong>${escapeHtml(shortDateLabel(latestTimestamp) || "None")}</strong></div>
        </div>
        <section class="operator-side-panel operator-main-panel batch-workboard-title" aria-labelledby="batch-workboard-title">
          <h2 id="batch-workboard-title">Batches by ETB Slot</h2>
          <p class="operator-note">Grouped from CardUploader history records only. Refill labels such as ETB-001-A.2 identify later CardUploader batches for the same physical slot without changing CardUploader inventory truth.</p>
          ${renderBatchLocationWorkboard(historyBatches)}
        </section>
        <div class="registry-layout">
          <div class="registry-list">
            <section class="operator-side-panel operator-main-panel" aria-labelledby="batch-reference-title">
              <h2 id="batch-reference-title">CardUploader Batch History</h2>
              ${renderBatchReferenceRows(historyBatches)}
            </section>
          </div>
        </div>
      </section>`;
    document.title = "Batch References | CardVector";
  }

  const ebayListingColumns = Object.freeze({
    marketplace_listing_id: ["Item number", "Item Number", "Item ID", "ItemID", "ItemId"],
    sku: ["Custom label (SKU)", "Custom Label (SKU)", "Custom Label", "CustomLabel", "SKU"],
    listing_title: ["Title", "*Title", "Listing title", "Item title", "ItemTitle"],
    current_price: ["Current price", "Start price", "StartPrice", "Price", "Buy It Now price", "BuyItNowPrice", "Listing price", "List price"],
    quantity_available: ["Available quantity", "Available Quantity", "Quantity Available", "Quantity", "Qty"],
    quantity_sold: ["Sold quantity", "Sold Quantity", "Quantity sold", "Sold"],
    listing_status: ["Listing status", "Status", "Format"],
    condition: ["Condition", "Item condition", "ConditionName", "CD:Card Condition - (ID: 40001)"],
    category: ["eBay category 1 name", "Category", "Category name"],
    listing_url: ["View Item URL", "Item URL", "Listing URL", "URL"]
  });

  const tcgplayerListingColumns = Object.freeze({
    marketplace_listing_id: [
      "TCGplayer SKU",
      "TCGPlayer SKU",
      "TCGplayer SKU ID",
      "SKU ID",
      "Inventory ID",
      "Product ID",
      "TCGplayer Product ID",
      "Listing ID"
    ],
    sku: ["SKU", "User SKU", "Custom SKU", "Custom label (SKU)", "Custom Label", "Location", "Location Code"],
    listing_title: ["Product Name", "Product", "Title", "Name", "Listing title"],
    current_price: ["Price", "My Price", "Marketplace Price", "TCGplayer Price", "List Price"],
    quantity_available: ["Quantity", "Qty", "Available Quantity", "Live Quantity", "Inventory Quantity", "Total Quantity"],
    quantity_sold: ["Sold quantity", "Sold Quantity", "Quantity sold", "Sold"],
    listing_status: ["Status", "Listing status", "Live Status"],
    condition: ["Condition", "Printing Condition", "Card Condition"],
    category: ["Set", "Category", "Product Line", "TCG", "Game"],
    listing_url: ["Listing URL", "Product URL", "URL"]
  });

  const marketplaceListingConfigs = Object.freeze({
    ebay: {
      label: "eBay",
      source: "ebay_active_listing_csv",
      columns: ebayListingColumns,
      requiresExplicitListingId: true,
      missingIdMessage: "eBay CSV is missing Item number / Item ID.",
      missingTitleMessage: "eBay CSV is missing Title."
    },
    tcgplayer: {
      label: "TCGplayer / TCGTracking",
      source: "tcgplayer_inventory_snapshot_csv",
      columns: tcgplayerListingColumns,
      requiresExplicitListingId: false,
      missingIdMessage: "TCGplayer snapshot is missing a SKU, product ID, or inventory ID column.",
      missingTitleMessage: "TCGplayer snapshot is missing Product Name / Title."
    }
  });

  const carduploaderInventoryColumns = Object.freeze({
    external_inventory_id: ["CardUploader ID", "Source ID", "Inventory ID", "ID"],
    catalog_sku: ["Catalog SKU", "CardUploader Catalog SKU", "Managed Inventory SKU", "Listing SKU"],
    sku: ["User SKU", "SKU", "Custom SKU", "Custom label (SKU)", "Custom Label", "Location", "Location Code"],
    inventory_title: ["Title", "Listing Title", "Name", "Product Name", "Product"],
    inventory_status: ["Status", "Inventory Status"],
    condition: ["Condition", "Printing Condition", "Card Condition"],
    location_display_code: ["User SKU", "Location", "Location Code", "Storage Location"],
    physical_quantity: ["Qty", "Quantity", "Physical Quantity", "Inventory Quantity"],
    available_quantity: ["Available Quantity", "Available", "Qty", "Quantity"],
    reserved_quantity: ["Reserved Quantity", "Reserved"],
    sold_quantity: ["Sold Quantity", "Sold"]
  });

  function normalizeCsvColumn(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function csvCell(row, mapping, key) {
    const column = mapping[key];
    return column ? String(row[column] ?? "").trim() : "";
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const input = String(text || "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const next = input[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) {
      return { fieldnames: [], rows: [] };
    }
    const fieldnames = rows[0].map((value) => String(value || "").trim());
    const records = rows.slice(1).filter((values) => values.some((value) => String(value || "").trim())).map((values) => {
      const record = {};
      fieldnames.forEach((name, index) => {
        record[name] = values[index] ?? "";
      });
      return record;
    });
    return { fieldnames, rows: records };
  }

  function columnMapping(fieldnames, definitions) {
    const normalized = new Map(fieldnames.map((name) => [normalizeCsvColumn(name), name]));
    return Object.fromEntries(Object.entries(definitions).map(([key, candidates]) => {
      const found = candidates.map(normalizeCsvColumn).map((candidate) => normalized.get(candidate)).find(Boolean) || "";
      return [key, found];
    }));
  }

  function parseMoney(value) {
    const normalized = String(value || "").replace(/[$,\s]/g, "");
    if (!normalized) {
      return null;
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
  }

  function parseWholeNumber(value) {
    const normalized = String(value || "").replace(/[,\s]/g, "");
    if (!normalized) {
      return null;
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  }

  function normalizeSku(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSnapshotIdentityPart(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function listingLocationHint(value) {
    const match = String(value || "").toUpperCase().match(/\bETB-[0-9]{3}-[A-J](?:\.[0-9]+)?\b/);
    return match ? match[0] : "";
  }

  function baseLocationHint(value) {
    return String(value || "").replace(/\.[0-9]+$/, "");
  }

  function managedInventorySku(value) {
    const sku = normalizeSku(value);
    return /^CS-[A-Z0-9]+$/.test(sku) ? sku : "";
  }

  function reasonBucket(record, duplicateSkuCount, duplicateListingCount) {
    if (!record.marketplace_listing_id) {
      return { status: "needs_review", reasonCodes: ["MISSING_ITEM_ID"] };
    }
    if (duplicateListingCount > 1) {
      return { status: "duplicate_listing_id", reasonCodes: ["DUPLICATE_LISTING_ID"] };
    }
    if (!record.sku) {
      return { status: "missing_sku", reasonCodes: ["MISSING_SKU"] };
    }
    if (duplicateSkuCount > 1) {
      return { status: "duplicate_sku", reasonCodes: ["DUPLICATE_SKU"] };
    }
    if (record.location_hint) {
      return { status: "location_linked", reasonCodes: ["LOCATION_HINT_FOUND"] };
    }
    return { status: "needs_review", reasonCodes: ["NO_LOCATION_HINT"] };
  }

  function syntheticMarketplaceListingId(marketplace, record) {
    const parts = [
      normalizeSku(record.sku),
      record.listing_title,
      record.condition,
      record.category
    ].map(normalizeSnapshotIdentityPart).filter(Boolean);
    return parts.length >= 2 ? `${marketplace}:snapshot:${parts.join(":")}` : "";
  }

  function syntheticInventorySnapshotId(record) {
    const parts = [
      record.source_file_sha256 || record.source_file_name,
      record.row_number,
      normalizeSku(record.sku),
      record.inventory_title,
      record.condition,
      record.location_display_code
    ].map(normalizeSnapshotIdentityPart).filter(Boolean);
    return parts.length >= 2 ? `carduploader:snapshot:${parts.join(":")}` : "";
  }

  function summarizeListingRows(records) {
    const summary = {
      totalRows: records.length,
      uniqueListings: new Set(records.map((record) => record.marketplace_listing_id).filter(Boolean)).size,
      missingSku: records.filter((record) => record.review_status === "missing_sku").length,
      duplicateSku: records.filter((record) => record.review_status === "duplicate_sku").length,
      duplicateListingId: records.filter((record) => record.review_status === "duplicate_listing_id").length,
      linkedLocations: records.filter((record) => record.location_hint).length,
      needsReview: records.filter((record) => record.review_status === "needs_review").length
    };
    summary.ready = records.filter((record) => ["location_linked", "needs_review", "missing_sku", "duplicate_sku", "duplicate_listing_id"].includes(record.review_status)).length;
    return summary;
  }

  function summarizeInventoryRows(records) {
    const values = Array.isArray(records) ? records : [];
    return {
      totalRows: values.length,
      totalQuantity: values.reduce((total, record) => total + Number(record.available_quantity || record.physical_quantity || 0), 0),
      uniqueSkus: new Set(values.map((record) => record.sku).filter(Boolean)).size,
      missingSku: values.filter((record) => !record.sku).length,
      needsReview: values.filter((record) => record.review_status === "needs_review").length
    };
  }

  function parseMarketplaceListingsCsv(text, fileMeta = {}, marketplace = "ebay") {
    const config = marketplaceListingConfigs[marketplace] || marketplaceListingConfigs.ebay;
    const parsed = parseCsvRows(text);
    const mapping = columnMapping(parsed.fieldnames, config.columns);
    const errors = [];
    if (!mapping.marketplace_listing_id && config.requiresExplicitListingId) {
      errors.push(config.missingIdMessage);
    }
    if (!mapping.listing_title) {
      errors.push(config.missingTitleMessage);
    }
    const skuCounts = new Map();
    const listingCounts = new Map();
    const records = parsed.rows.map((row, index) => {
      const sku = normalizeSku(csvCell(row, mapping, "sku"));
      const explicitListingId = csvCell(row, mapping, "marketplace_listing_id");
      const draftRecord = {
        sku,
        listing_title: csvCell(row, mapping, "listing_title"),
        condition: csvCell(row, mapping, "condition"),
        category: csvCell(row, mapping, "category")
      };
      const syntheticId = explicitListingId ? "" : syntheticMarketplaceListingId(marketplace, draftRecord);
      const listingId = explicitListingId || syntheticId;
      if (sku) {
        skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
      }
      if (listingId) {
        listingCounts.set(listingId, (listingCounts.get(listingId) || 0) + 1);
      }
      return {
        row_number: index + 1,
        marketplace,
        marketplace_label: config.label,
        source: config.source,
        marketplace_listing_id: listingId,
        listing_id_is_synthetic: Boolean(syntheticId),
        sku,
        listing_title: draftRecord.listing_title,
        current_price: parseMoney(csvCell(row, mapping, "current_price")),
        currency: "USD",
        quantity_available: parseWholeNumber(csvCell(row, mapping, "quantity_available")),
        quantity_sold: parseWholeNumber(csvCell(row, mapping, "quantity_sold")),
        listing_status: csvCell(row, mapping, "listing_status") || "active",
        condition: draftRecord.condition,
        category: draftRecord.category,
        listing_url: csvCell(row, mapping, "listing_url"),
        location_hint: listingLocationHint(sku || draftRecord.listing_title),
        raw_row: row,
        source_file_name: fileMeta.name || "",
        source_file_sha256: fileMeta.sha256 || ""
      };
    }).map((record) => {
      const bucket = reasonBucket(
        record,
        record.sku ? skuCounts.get(record.sku) || 0 : 0,
        record.marketplace_listing_id ? listingCounts.get(record.marketplace_listing_id) || 0 : 0
      );
      return {
        ...record,
        review_status: bucket.status,
        reason_codes: record.listing_id_is_synthetic ? [...bucket.reasonCodes, "SYNTHETIC_MARKETPLACE_ID"] : bucket.reasonCodes
      };
    });
    return {
      marketplace,
      marketplaceLabel: config.label,
      fieldnames: parsed.fieldnames,
      mapping,
      records,
      errors,
      summary: summarizeListingRows(records)
    };
  }

  function parseEbayListingsCsv(text, fileMeta = {}) {
    return parseMarketplaceListingsCsv(text, fileMeta, "ebay");
  }

  function parseCardUploaderInventoryCsv(text, fileMeta = {}) {
    const parsed = parseCsvRows(text);
    const mapping = columnMapping(parsed.fieldnames, carduploaderInventoryColumns);
    const errors = [];
    if (!mapping.catalog_sku && !mapping.sku) {
      errors.push("CardUploader inventory CSV is missing Catalog SKU or User SKU / SKU.");
    }
    if (!mapping.inventory_title) {
      errors.push("CardUploader inventory CSV is missing Title / Product Name.");
    }
    const records = parsed.rows.map((row, index) => {
      const userSku = normalizeSku(csvCell(row, mapping, "sku"));
      const catalogSku = managedInventorySku(csvCell(row, mapping, "catalog_sku"));
      const sku = catalogSku || userSku;
      const location = listingLocationHint(csvCell(row, mapping, "location_display_code") || userSku);
      const record = {
        row_number: index + 1,
        external_inventory_provider: "carduploader",
        source: "carduploader_inventory_csv",
        external_inventory_id: csvCell(row, mapping, "external_inventory_id"),
        sku,
        inventory_title: csvCell(row, mapping, "inventory_title"),
        inventory_status: csvCell(row, mapping, "inventory_status"),
        condition: csvCell(row, mapping, "condition"),
        location_display_code: location,
        physical_quantity: parseWholeNumber(csvCell(row, mapping, "physical_quantity")),
        available_quantity: parseWholeNumber(csvCell(row, mapping, "available_quantity")),
        reserved_quantity: parseWholeNumber(csvCell(row, mapping, "reserved_quantity")),
        sold_quantity: parseWholeNumber(csvCell(row, mapping, "sold_quantity")),
        raw_row: row,
        source_file_name: fileMeta.name || "",
        source_file_sha256: fileMeta.sha256 || ""
      };
      return {
        ...record,
        external_inventory_id: record.external_inventory_id || syntheticInventorySnapshotId(record),
        review_status: record.sku ? "snapshot_ready" : "needs_review",
        reason_codes: record.sku
          ? ["CARDUPLOADER_INVENTORY_EVIDENCE", catalogSku ? "CARDUPLOADER_CATALOG_SKU" : "CARDUPLOADER_LOCATION_SKU_ONLY"]
          : ["MISSING_SKU"]
      };
    });
    return {
      type: "inventory",
      fieldnames: parsed.fieldnames,
      mapping,
      records,
      errors,
      summary: summarizeInventoryRows(records)
    };
  }

  async function sha256Hex(buffer) {
    if (!window.crypto || !window.crypto.subtle) {
      return "";
    }
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
      return "n/a";
    }
    const number = Number(value);
    return Number.isFinite(number) ? `$${number.toFixed(2)}` : String(value);
  }

  const repricingReviewStorageKey = "cardvector.repricingPlan.v1";
  const cardUploaderHelperSnapshotStorageKey = "cardvector.carduploaderAutomaticInventorySnapshot.v1";
  const repricingFloorRuleConfigStorageKey = "cardvector.repricingFloorRules.v1";
  const repricingFilterConfigStorageKey = "cardvector.repricingFilters.v1";
  const repricingBusinessProfileStorageKey = "cardvector.repricingBusinessProfile.v1";
  const defaultRepricingFloorRuleConfig = Object.freeze({
    defaultFloor: 1.58,
    pokemonHoloFloor: 1.98,
    pokemonUltraRareFloor: 2.98,
    mtgFoilFloor: 1.98
  });
  const defaultRepricingBusinessProfile = Object.freeze({
    acquisitionCost: 0.05,
    sleeveCost: 0.01,
    topLoaderCost: 0.08,
    teamBagCost: 0.03,
    envelopeCost: 0.06,
    labelAndTapeCost: 0.02,
    otherSupplyCost: 0,
    ebayStandardEnvelopeOneOz: 0.78,
    ebayStandardEnvelopeTwoOz: 1.07,
    ebayStandardEnvelopeThreeOz: 1.36,
    defaultEnvelopeOunces: 1,
    ebayFinalValueFeeRate: 0.1325,
    ebayPerOrderFeeUnderTen: 0.30,
    ebayPerOrderFeeOverTen: 0.40,
    minimumProfit: 0.25,
    roundingMode: "nearest_0_01"
  });
  const defaultRepricingFilterConfig = Object.freeze({
    status: "all",
    game: "all",
    platform: "all",
    priceBucket: "all",
    search: ""
  });
  const repricingFloorRuleLabels = Object.freeze({
    defaultFloor: "Default floor",
    pokemonHoloFloor: "Pokemon holo floor",
    pokemonUltraRareFloor: "Pokemon ultra rare floor",
    mtgFoilFloor: "MTG foil floor"
  });
  const repricingPlanColumns = Object.freeze({
    inventory_id: ["inventory_id", "Inventory ID", "CardUploader ID", "external_inventory_id"],
    row_number: ["row_number", "Row", "Row Number"],
    title: ["title", "Title", "listing_title", "inventory_title", "Product Name"],
    user_sku: ["user_sku", "User SKU", "SKU", "Custom SKU"],
    catalog_sku: ["catalog_sku", "Catalog SKU", "CardUploader Catalog SKU", "Managed Inventory SKU"],
    marketplace: ["marketplace", "Marketplace"],
    marketplace_listing_id: ["marketplace_listing_id", "Marketplace Listing ID", "Item number", "Item ID"],
    current_price: ["current_price", "Current Price", "Current price", "current_listing_price"],
    recommended_price: ["recommended_price", "Recommended Price", "Recommended listing price", "recommended_listing_price"],
    price_delta: ["price_delta", "Price Delta", "Delta"],
    percent_delta: ["percent_delta", "Percent Delta", "Percent"],
    quantity: ["quantity", "Quantity", "Qty"],
    confidence: ["confidence", "Confidence", "pricing_confidence"],
    status: ["status", "Status"],
    review_decision: ["review_decision", "Review Decision", "Recommendation"],
    review_priority: ["review_priority", "Review Priority", "Priority"],
    reason_codes: ["reason_codes", "Reason Codes", "Reasons"],
    notes: ["notes", "Notes", "Warnings"],
    search_query: ["search_query", "Search Query", "eBay Sold Search"],
    listing_reference: ["listing_reference", "Listing Reference", "Listing URL"],
    condition: ["condition", "Condition"],
    set_name: ["set_name", "Set", "Set Name"],
    card_number: ["card_number", "Card Number", "Number"],
    variant: ["variant", "Variant"],
    finish: ["finish", "Finish"],
    apply_ready: ["apply_ready", "Apply Ready"]
  });

  function parseListValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const text = String(value || "").trim();
    if (!text) {
      return [];
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (_error) {
      // Fall through to tolerant CSV/list parsing.
    }
    return text
      .replace(/^\[|\]$/g, "")
      .split(/[,;|]/)
      .map((item) => item.replace(/^['"]|['"]$/g, "").trim())
      .filter(Boolean);
  }

  function boolish(value) {
    if (value === true || value === false) {
      return value;
    }
    const text = String(value || "").trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(text);
  }

  function repricingIdentity(record, index) {
    return [
      record.inventory_id,
      record.marketplace,
      record.marketplace_listing_id,
      record.catalog_sku,
      record.user_sku,
      record.row_number || index + 1
    ].map(normalizeSnapshotIdentityPart).filter(Boolean).join(":") || `repricing:${index + 1}`;
  }

  function normalizeRepricingStatus(value) {
    const status = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (["approved", "blocked", "skipped", "apply_ready", "dry_run"].includes(status)) {
      return status;
    }
    if (["manual_review", "needs_review", "review"].includes(status)) {
      return "dry_run";
    }
    return "dry_run";
  }

  function normalizeRepricingRecord(record, index, fileMeta = {}) {
    const raw = record || {};
    const currentPrice = parseMoney(raw.current_price ?? raw.currentPrice ?? raw.current_listing_price);
    const recommendedPrice = parseMoney(raw.recommended_price ?? raw.recommendedPrice ?? raw.recommended_listing_price);
    const explicitDelta = parseMoney(raw.price_delta ?? raw.priceDelta);
    const delta = explicitDelta !== null
      ? explicitDelta
      : currentPrice !== null && recommendedPrice !== null
        ? Math.round((recommendedPrice - currentPrice) * 100) / 100
        : null;
    const notes = parseListValue(raw.notes);
    const reasonCodes = parseListValue(raw.reason_codes ?? raw.reasonCodes);
    const normalized = {
      id: raw.id || "",
      inventory_id: raw.inventory_id || raw.inventoryId || raw.external_inventory_id || "",
      row_number: raw.row_number || raw.rowNumber || index + 1,
      title: raw.title || raw.listing_title || raw.inventory_title || raw.product_name || "",
      user_sku: normalizeSku(raw.user_sku || raw.userSku || raw.sku),
      catalog_sku: normalizeSku(raw.catalog_sku || raw.catalogSku),
      marketplace: String(raw.marketplace || "carduploader").toLowerCase(),
      marketplace_listing_id: raw.marketplace_listing_id || raw.marketplaceListingId || "",
      current_price: currentPrice,
      recommended_price: recommendedPrice,
      price_delta: delta,
      percent_delta: raw.percent_delta || raw.percentDelta || "",
      quantity: parseWholeNumber(raw.quantity) ?? 1,
      confidence: raw.confidence ?? raw.pricing_confidence ?? "",
      status: normalizeRepricingStatus(raw.status),
      review_decision: raw.review_decision || raw.reviewDecision || "",
      review_priority: raw.review_priority || raw.reviewPriority || "",
      reason_codes: reasonCodes,
      notes,
      search_query: raw.search_query || raw.searchQuery || raw.title || raw.listing_title || "",
      listing_reference: raw.listing_reference || raw.listingReference || raw.listing_url || "",
      condition: raw.condition || "",
      set_name: raw.set_name || raw.setName || "",
      card_number: raw.card_number || raw.cardNumber || "",
      variant: raw.variant || "",
      finish: raw.finish || "",
      apply_ready: boolish(raw.apply_ready || raw.applyReady),
      source_file_name: raw.source_file_name || fileMeta.name || "",
      raw_row: raw
    };
    return {
      ...normalized,
      id: normalized.id || repricingIdentity(normalized, index)
    };
  }

  function parseRepricingPlanJson(text, fileMeta = {}) {
    const payload = JSON.parse(text);
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.records)
        ? payload.records
        : Array.isArray(payload.updates)
          ? payload.updates
          : Array.isArray(payload.items)
            ? payload.items
            : [];
    if (!records.length) {
      throw new Error("Repricing JSON must contain an array or a records, updates, or items array.");
    }
    return records.map((record, index) => normalizeRepricingRecord(record, index, fileMeta));
  }

  function parseRepricingPlanCsv(text, fileMeta = {}) {
    const parsed = parseCsvRows(text);
    const mapping = columnMapping(parsed.fieldnames, repricingPlanColumns);
    return parsed.rows.map((row, index) => {
      const record = Object.fromEntries(Object.keys(repricingPlanColumns).map((key) => [key, csvCell(row, mapping, key)]));
      return normalizeRepricingRecord({ ...record, raw_row: row }, index, fileMeta);
    });
  }

  function parseRepricingPlanFile(text, fileMeta = {}) {
    const trimmed = String(text || "").trim();
    const rows = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? parseRepricingPlanJson(trimmed, fileMeta)
      : parseRepricingPlanCsv(trimmed, fileMeta);
    return rows.filter((row) => row.inventory_id || row.title || row.user_sku || row.catalog_sku);
  }

  function normalizeRepricingFloorRuleConfig(config = {}) {
    return Object.fromEntries(Object.entries(defaultRepricingFloorRuleConfig).map(([key, fallback]) => {
      const value = parseMoney(config[key]);
      return [key, value !== null && value >= 0 ? Math.round(value * 100) / 100 : fallback];
    }));
  }

  function readStoredRepricingFloorRuleConfig() {
    try {
      const payload = JSON.parse(localStorage.getItem(repricingFloorRuleConfigStorageKey) || "null");
      return normalizeRepricingFloorRuleConfig(payload || {});
    } catch (_error) {
      return normalizeRepricingFloorRuleConfig();
    }
  }

  function writeStoredRepricingFloorRuleConfig(config) {
    const normalized = normalizeRepricingFloorRuleConfig(config);
    localStorage.setItem(repricingFloorRuleConfigStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  function normalizeRepricingBusinessProfile(config = {}) {
    const money = (key) => {
      const value = parseMoney(config[key]);
      const fallback = defaultRepricingBusinessProfile[key];
      return value !== null && value >= 0 ? Math.round(value * 100) / 100 : fallback;
    };
    const feeRate = Number(config.ebayFinalValueFeeRate);
    const ounces = Number(config.defaultEnvelopeOunces);
    const roundingMode = ["nearest_0_01", "nearest_0_05", "nearest_0_25", "ending_0_49", "ending_0_99"].includes(config.roundingMode)
      ? config.roundingMode
      : defaultRepricingBusinessProfile.roundingMode;
    return {
      acquisitionCost: money("acquisitionCost"),
      sleeveCost: money("sleeveCost"),
      topLoaderCost: money("topLoaderCost"),
      teamBagCost: money("teamBagCost"),
      envelopeCost: money("envelopeCost"),
      labelAndTapeCost: money("labelAndTapeCost"),
      otherSupplyCost: money("otherSupplyCost"),
      ebayStandardEnvelopeOneOz: money("ebayStandardEnvelopeOneOz"),
      ebayStandardEnvelopeTwoOz: money("ebayStandardEnvelopeTwoOz"),
      ebayStandardEnvelopeThreeOz: money("ebayStandardEnvelopeThreeOz"),
      defaultEnvelopeOunces: [1, 2, 3].includes(ounces) ? ounces : defaultRepricingBusinessProfile.defaultEnvelopeOunces,
      ebayFinalValueFeeRate: Number.isFinite(feeRate) && feeRate >= 0 ? Math.round(feeRate * 10000) / 10000 : defaultRepricingBusinessProfile.ebayFinalValueFeeRate,
      ebayPerOrderFeeUnderTen: money("ebayPerOrderFeeUnderTen"),
      ebayPerOrderFeeOverTen: money("ebayPerOrderFeeOverTen"),
      minimumProfit: money("minimumProfit"),
      roundingMode
    };
  }

  function readStoredRepricingBusinessProfile() {
    try {
      const payload = JSON.parse(localStorage.getItem(repricingBusinessProfileStorageKey) || "null");
      return normalizeRepricingBusinessProfile(payload || {});
    } catch (_error) {
      return normalizeRepricingBusinessProfile();
    }
  }

  function writeStoredRepricingBusinessProfile(config) {
    const normalized = normalizeRepricingBusinessProfile(config);
    localStorage.setItem(repricingBusinessProfileStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  function readRepricingBusinessProfileInputs() {
    const values = {};
    document.querySelectorAll("[data-repricing-business]").forEach((input) => {
      values[input.getAttribute("data-repricing-business")] = input.value;
    });
    return normalizeRepricingBusinessProfile(values);
  }

  function normalizeRepricingFilterConfig(config = {}) {
    if (typeof config === "string") {
      return { ...defaultRepricingFilterConfig, status: config || "all" };
    }
    const status = ["all", "safe", "approved", "needs_review", "blocked", "increase", "decrease"].includes(config.status)
      ? config.status
      : defaultRepricingFilterConfig.status;
    const game = ["all", "pokemon", "mtg", "unknown"].includes(config.game)
      ? config.game
      : defaultRepricingFilterConfig.game;
    const platform = ["all", "ebay", "crosslisted", "manapool", "unknown"].includes(config.platform)
      ? config.platform
      : defaultRepricingFilterConfig.platform;
    const priceBucket = ["all", "under_2", "two_to_five", "five_to_ten", "ten_plus"].includes(config.priceBucket)
      ? config.priceBucket
      : defaultRepricingFilterConfig.priceBucket;
    return {
      status,
      game,
      platform,
      priceBucket,
      search: String(config.search || "").trim().slice(0, 120)
    };
  }

  function readStoredRepricingFilterConfig() {
    try {
      const payload = JSON.parse(localStorage.getItem(repricingFilterConfigStorageKey) || "null");
      return normalizeRepricingFilterConfig(payload || {});
    } catch (_error) {
      return normalizeRepricingFilterConfig();
    }
  }

  function writeStoredRepricingFilterConfig(config) {
    const normalized = normalizeRepricingFilterConfig(config);
    localStorage.setItem(repricingFilterConfigStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  function readRepricingFloorRuleInputs() {
    const values = {};
    document.querySelectorAll("[data-repricing-floor]").forEach((input) => {
      values[input.getAttribute("data-repricing-floor")] = input.value;
    });
    return normalizeRepricingFloorRuleConfig(values);
  }

  function repricingRuleText(row) {
    const raw = row && row.raw_row ? row.raw_row : {};
    return [
      row && row.card_game,
      row && row.title,
      row && row.condition,
      row && row.variant,
      row && row.finish,
      row && row.set_name,
      row && row.card_number,
      row && row.marketplace,
      raw.title,
      raw.condition,
      raw.variant,
      raw.finish,
      raw.tcg,
      raw.game,
      raw.platform,
      raw.evidence_text,
      ...(raw.action_labels || []),
      ...((raw.links || []).map((link) => [link.text, link.href].filter(Boolean).join(" "))),
      ...((raw.cell_details || []).flatMap((cell) => [
        cell.text,
        cell.title,
        cell.aria_label,
        ...(cell.image_alt_text || []),
        ...((cell.links || []).map((link) => [link.text, link.href].filter(Boolean).join(" ")))
      ])),
      raw.raw_text
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function normalizeRepricingGameLabel(value) {
    const text = String(value || "").toLowerCase().replace(/pok\u00e9/g, "poke").replace(/[^a-z0-9]+/g, " ").trim();
    if (!text) {
      return "";
    }
    if (/\b(pokemon|poke mon|pokemon english|pokemon japanese|pokemon jp)\b/.test(text)) {
      return "pokemon";
    }
    if (/\b(mtg|magic|magic the gathering)\b/.test(text)) {
      return "mtg";
    }
    if (/\b(yugioh|yu gi oh)\b/.test(text)) {
      return "yugioh";
    }
    if (/\b(lorcana)\b/.test(text)) {
      return "lorcana";
    }
    if (/\b(one piece)\b/.test(text)) {
      return "one_piece";
    }
    return "";
  }

  function repricingGameEvidence(row) {
    const raw = row && row.raw_row ? row.raw_row : {};
    return [
      row && row.card_game,
      raw.tcg,
      raw.game,
      raw.category,
      raw.product_line
    ].map(normalizeRepricingGameLabel).find(Boolean) || "";
  }

  function detectRepricingGame(row) {
    const explicit = repricingGameEvidence(row);
    if (explicit) {
      return explicit;
    }
    const text = repricingRuleText(row);
    if (/\b(mtg|magic|magic the gathering)\b/.test(text)) {
      return "mtg";
    }
    if (/\b(pokemon|poke|holo|reverse holo|ex|gx|v|vmax|vstar|trainer gallery|illustration rare|secret rare)\b/.test(text)) {
      return "pokemon";
    }
    return "unknown";
  }

  function repricingGameDisplayLabel(row) {
    const game = detectRepricingGame(row);
    if (game === "pokemon") {
      return "Pokemon";
    }
    if (game === "mtg") {
      return "MTG";
    }
    if (game === "yugioh") {
      return "Yu-Gi-Oh";
    }
    if (game === "lorcana") {
      return "Lorcana";
    }
    if (game === "one_piece") {
      return "One Piece";
    }
    return "Unknown game";
  }

  function repricingGameConfidence(row) {
    return repricingGameEvidence(row) ? "explicit" : detectRepricingGame(row) === "unknown" ? "unknown" : "inferred";
  }

  function detectRepricingPlatform(row) {
    const raw = row && row.raw_row ? row.raw_row : {};
    const text = [
      row && row.marketplace,
      raw.platform,
      raw.status,
      raw.raw_text,
      ...(raw.action_labels || []),
      ...((raw.cell_details || []).map((cell) => cell.text || ""))
    ].filter(Boolean).join(" ").toLowerCase();
    const hasEbay = /\bebay\b/.test(text);
    const hasManapool = /\b(mana ?pool|manapool)\b/.test(text);
    if (hasEbay && hasManapool) {
      return "crosslisted";
    }
    if (hasEbay) {
      return "ebay";
    }
    if (hasManapool) {
      return "manapool";
    }
    return "unknown";
  }

  function matchedRepricingFloorRule(row, config = defaultRepricingFloorRuleConfig) {
    const floorConfig = normalizeRepricingFloorRuleConfig(config);
    const text = repricingRuleText(row);
    const game = detectRepricingGame(row);
    const candidates = [{
      id: "default_floor",
      label: "Default floor",
      floor: floorConfig.defaultFloor,
      reason: "BELOW_DEFAULT_FLOOR"
    }];
    if (game === "pokemon" && /\b(reverse holo|holo|foil)\b/.test(text)) {
      candidates.push({
        id: "pokemon_holo_floor",
        label: "Pokemon holo floor",
        floor: floorConfig.pokemonHoloFloor,
        reason: "POKEMON_HOLO_FLOOR_APPLIED"
      });
    }
    if (game === "pokemon" && /\b(ex|gx|v|vmax|vstar|secret rare|illustration rare|special illustration|trainer gallery|full art|alt art|rainbow|gold)\b/.test(text)) {
      candidates.push({
        id: "pokemon_ultra_rare_floor",
        label: "Pokemon ultra rare floor",
        floor: floorConfig.pokemonUltraRareFloor,
        reason: "POKEMON_ULTRA_RARE_FLOOR_APPLIED"
      });
    }
    if (game === "mtg" && /\b(foil|etched|showcase|borderless)\b/.test(text)) {
      candidates.push({
        id: "mtg_foil_floor",
        label: "MTG foil floor",
        floor: floorConfig.mtgFoilFloor,
        reason: "MTG_FOIL_FLOOR_APPLIED"
      });
    }
    return candidates.sort((a, b) => b.floor - a.floor)[0];
  }

  function roundCurrency(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function applyRepricingRounding(value, mode = defaultRepricingBusinessProfile.roundingMode) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return null;
    }
    if (mode === "nearest_0_05") {
      return roundCurrency(Math.ceil(amount / 0.05) * 0.05);
    }
    if (mode === "nearest_0_25") {
      return roundCurrency(Math.ceil(amount / 0.25) * 0.25);
    }
    if (mode === "ending_0_49") {
      const dollars = Math.floor(amount);
      const candidate = dollars + 0.49;
      return roundCurrency(candidate >= amount ? candidate : dollars + 1.49);
    }
    if (mode === "ending_0_99") {
      const dollars = Math.floor(amount);
      const candidate = dollars + 0.99;
      return roundCurrency(candidate >= amount ? candidate : dollars + 1.99);
    }
    return roundCurrency(amount);
  }

  function repricingPackagingCost(profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    return roundCurrency(
      business.sleeveCost
      + business.topLoaderCost
      + business.teamBagCost
      + business.envelopeCost
      + business.labelAndTapeCost
      + business.otherSupplyCost
    );
  }

  function repricingShippingCost(profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    if (business.defaultEnvelopeOunces === 3) {
      return business.ebayStandardEnvelopeThreeOz;
    }
    if (business.defaultEnvelopeOunces === 2) {
      return business.ebayStandardEnvelopeTwoOz;
    }
    return business.ebayStandardEnvelopeOneOz;
  }

  function estimateEbayFee(price, profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    const salePrice = Number(price || 0);
    const perOrder = salePrice <= 10 ? business.ebayPerOrderFeeUnderTen : business.ebayPerOrderFeeOverTen;
    return roundCurrency((salePrice * business.ebayFinalValueFeeRate) + perOrder);
  }

  function calculateMinimumViablePrice(profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    const fixedCosts = roundCurrency(
      business.acquisitionCost
      + repricingPackagingCost(business)
      + repricingShippingCost(business)
      + business.minimumProfit
    );
    const denominator = 1 - business.ebayFinalValueFeeRate;
    const candidate = denominator > 0
      ? (fixedCosts + business.ebayPerOrderFeeUnderTen) / denominator
      : fixedCosts + business.ebayPerOrderFeeUnderTen;
    return applyRepricingRounding(candidate, business.roundingMode);
  }

  function buildRepricingBusinessAnalysis(price, profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    const listingPrice = Number(price);
    if (!Number.isFinite(listingPrice)) {
      return {
        acquisition_cost: business.acquisitionCost,
        packaging_cost: repricingPackagingCost(business),
        shipping_cost: repricingShippingCost(business),
        estimated_fees: null,
        estimated_net_profit: null,
        profit_margin: null,
        minimum_viable_price: calculateMinimumViablePrice(business),
        business_rule_adjustments: []
      };
    }
    const estimatedFees = estimateEbayFee(listingPrice, business);
    const packagingCost = repricingPackagingCost(business);
    const shippingCost = repricingShippingCost(business);
    const netProfit = roundCurrency(listingPrice - estimatedFees - shippingCost - packagingCost - business.acquisitionCost);
    return {
      acquisition_cost: business.acquisitionCost,
      packaging_cost: packagingCost,
      shipping_cost: shippingCost,
      estimated_fees: estimatedFees,
      estimated_net_profit: netProfit,
      profit_margin: listingPrice > 0 ? roundCurrency((netProfit / listingPrice) * 100) : null,
      minimum_viable_price: calculateMinimumViablePrice(business),
      business_rule_adjustments: []
    };
  }

  function applyRepricingBusinessRules(row, rule, profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    const current = row.current_price;
    if (current === null || current === undefined) {
      return row;
    }
    const reasonCodes = new Set(row.reason_codes || []);
    const marketCandidate = row.recommended_price !== null && row.recommended_price !== undefined
      ? Number(row.recommended_price)
      : Number(current);
    const minimumViable = calculateMinimumViablePrice(business);
    const recommendedBase = Math.max(Number.isFinite(marketCandidate) ? marketCandidate : 0, minimumViable);
    const recommended = applyRepricingRounding(recommendedBase, business.roundingMode);
    const delta = roundCurrency(recommended - Number(current));
    reasonCodes.add("BUSINESS_RULES_EVALUATED");
    reasonCodes.add("FREE_SHIPPING_ASSUMED");
    if (recommended > marketCandidate) {
      reasonCodes.add("MINIMUM_VIABLE_PRICE_APPLIED");
    }
    if (rule && recommended > rule.floor) {
      reasonCodes.add("BUSINESS_COST_ABOVE_FLOOR");
    }
    const businessAnalysis = buildRepricingBusinessAnalysis(recommended, business);
    businessAnalysis.business_rule_adjustments = Array.from(reasonCodes).filter((reason) => reason.includes("BUSINESS") || reason.includes("SHIPPING") || reason.includes("MINIMUM"));
    return {
      ...row,
      recommended_price: recommended,
      price_delta: delta,
      percent_delta: Number(current) ? `${roundCurrency(delta / Number(current) * 100)}` : "",
      confidence: row.confidence || "business_floor",
      status: row.status === "skipped" || row.status === "approved" ? row.status : "dry_run",
      review_decision: delta > 0 ? "increase_price" : row.review_decision || "no_change",
      review_priority: delta > 0 && recommended > marketCandidate ? "high" : row.review_priority || "normal",
      apply_ready: false,
      reason_codes: Array.from(reasonCodes),
      business_analysis: businessAnalysis
    };
  }

  function applyRepricingFloorRules(rows, config = defaultRepricingFloorRuleConfig, businessProfile = defaultRepricingBusinessProfile) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const current = row.current_price;
      const rule = matchedRepricingFloorRule(row, config);
      const reasonCodes = new Set(row.reason_codes || []);
      const notes = new Set(row.notes || []);
      reasonCodes.add("FLOOR_RULE_EVALUATED");
      if (detectRepricingGame(row) === "unknown") {
        reasonCodes.add("CARD_GAME_UNKNOWN");
      }
      if (current === null || current === undefined) {
        notes.add("current_price_required");
        return {
          ...row,
          recommended_price: null,
          price_delta: null,
          percent_delta: "",
          review_decision: "manual_review",
          review_priority: "review",
          reason_codes: Array.from(reasonCodes),
          notes: Array.from(notes)
        };
      }
      let pricedRow = row;
      if (Number(current) < rule.floor) {
        const recommended = Math.round(rule.floor * 100) / 100;
        const delta = Math.round((recommended - Number(current)) * 100) / 100;
        reasonCodes.add(rule.reason);
        pricedRow = {
          ...row,
          recommended_price: recommended,
          price_delta: delta,
          percent_delta: Number(current) ? `${Math.round((delta / Number(current) * 100) * 100) / 100}` : "",
          confidence: row.confidence || "floor_rule",
          status: row.status === "skipped" || row.status === "approved" ? row.status : "dry_run",
          review_decision: "increase_price",
          review_priority: rule.id === "default_floor" ? "normal" : "high",
          apply_ready: false,
          reason_codes: Array.from(reasonCodes),
          notes: Array.from(notes)
        };
      } else {
        reasonCodes.add("ABOVE_FLOOR_NO_CHANGE");
        pricedRow = {
          ...row,
          recommended_price: row.recommended_price,
          price_delta: row.price_delta,
          review_decision: row.review_decision || "no_change",
          reason_codes: Array.from(reasonCodes),
          notes: Array.from(notes)
        };
      }
      return applyRepricingBusinessRules(pricedRow, rule, businessProfile);
    });
  }

  function canApproveRepricingRow(row) {
    return row
      && row.status !== "blocked"
      && row.status !== "skipped"
      && row.current_price !== null
      && row.recommended_price !== null
      && Number(row.quantity || 0) > 0
      && !row.notes.length;
  }

  function repricingDecisionLabel(row) {
    if (!row) {
      return "Needs review";
    }
    if (row.status === "approved") {
      return "Approved";
    }
    if (row.status === "skipped") {
      return "Skipped";
    }
    if (row.status === "blocked") {
      return "Blocked";
    }
    if (row.price_delta > 0) {
      return "Increase price";
    }
    if (row.price_delta < 0) {
      return "Decrease price";
    }
    return "No change";
  }

  function summarizeRepricingRows(rows) {
    const values = Array.isArray(rows) ? rows : [];
    const totalDelta = values.reduce((total, row) => total + Number(row.price_delta || 0), 0);
    return {
      total: values.length,
      approved: values.filter((row) => row.status === "approved").length,
      safe: values.filter(canApproveRepricingRow).length,
      blocked: values.filter((row) => row.status === "blocked").length,
      needsReview: values.filter((row) => row.status === "dry_run" && !canApproveRepricingRow(row)).length,
      increases: values.filter((row) => Number(row.price_delta || 0) > 0).length,
      decreases: values.filter((row) => Number(row.price_delta || 0) < 0).length,
      totalDelta: Math.round(totalDelta * 100) / 100
    };
  }

  function repricingPriceBucket(row) {
    const price = Number(row && row.current_price);
    if (!Number.isFinite(price)) {
      return "unknown";
    }
    if (price < 2) {
      return "under_2";
    }
    if (price < 5) {
      return "two_to_five";
    }
    if (price < 10) {
      return "five_to_ten";
    }
    return "ten_plus";
  }

  function repricingSearchText(row) {
    const raw = row && row.raw_row ? row.raw_row : {};
    return [
      row && row.title,
      row && row.inventory_id,
      row && row.user_sku,
      row && row.catalog_sku,
      row && row.condition,
      row && row.variant,
      row && row.finish,
      row && row.set_name,
      row && row.card_number,
      row && row.marketplace_listing_id,
      row && row.search_query,
      raw.platform,
      raw.raw_text
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function rowMatchesRepricingStatus(row, filter) {
    if (filter === "approved") {
      return row.status === "approved";
    }
    if (filter === "safe") {
      return canApproveRepricingRow(row);
    }
    if (filter === "needs_review") {
      return row.status === "dry_run" && !canApproveRepricingRow(row);
    }
    if (filter === "blocked") {
      return row.status === "blocked";
    }
    if (filter === "increase") {
      return Number(row.price_delta || 0) > 0;
    }
    if (filter === "decrease") {
      return Number(row.price_delta || 0) < 0;
    }
    return true;
  }

  function filterRepricingRows(rows, filter) {
    const values = Array.isArray(rows) ? rows : [];
    const filters = normalizeRepricingFilterConfig(filter);
    const search = filters.search.toLowerCase();
    return values.filter((row) => {
      if (!rowMatchesRepricingStatus(row, filters.status)) {
        return false;
      }
      if (filters.game !== "all" && detectRepricingGame(row) !== filters.game) {
        return false;
      }
      if (filters.platform !== "all" && detectRepricingPlatform(row) !== filters.platform) {
        return false;
      }
      if (filters.priceBucket !== "all" && repricingPriceBucket(row) !== filters.priceBucket) {
        return false;
      }
      if (search && !repricingSearchText(row).includes(search)) {
        return false;
      }
      return true;
    });
  }

  function ebaySoldSearchUrl(row) {
    const query = row && (row.search_query || [row.title, row.set_name, row.card_number, row.condition].filter(Boolean).join(" "));
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query || "pokemon card")}&LH_Sold=1&LH_Complete=1`;
  }

  function reviewedRepricingExport(rows) {
    return {
      exported_at: new Date().toISOString(),
      source: "cardvector_operator_repricing_review",
      live_apply_permitted: false,
      rows: rows.map((row) => ({
        ...row,
        approved_for_future_apply: row.status === "approved"
      }))
    };
  }

  function downloadTextFile(filename, text, contentType = "application/json") {
    const blob = new Blob([text], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function renderRepricingSummary(rows) {
    const summary = summarizeRepricingRows(rows);
    return `
      <div class="registry-summary repricing-summary">
        <div><span>Candidates</span><strong>${summary.total}</strong></div>
        <div><span>Auto-safe</span><strong>${summary.safe}</strong></div>
        <div><span>Approved</span><strong>${summary.approved}</strong></div>
        <div><span>Blocked</span><strong>${summary.blocked}</strong></div>
        <div><span>Needs Review</span><strong>${summary.needsReview}</strong></div>
        <div><span>Increases</span><strong>${summary.increases}</strong></div>
        <div><span>Decreases</span><strong>${summary.decreases}</strong></div>
        <div><span>Net Delta</span><strong>${escapeHtml(formatCurrency(summary.totalDelta))}</strong></div>
      </div>`;
  }

  function summarizeRepricingFloorRules(rows) {
    const values = Array.isArray(rows) ? rows : [];
    const countReason = (reason) => values.filter((row) => (row.reason_codes || []).includes(reason)).length;
    return {
      evaluated: countReason("FLOOR_RULE_EVALUATED"),
      defaultFloor: countReason("BELOW_DEFAULT_FLOOR"),
      pokemonHolo: countReason("POKEMON_HOLO_FLOOR_APPLIED"),
      pokemonUltraRare: countReason("POKEMON_ULTRA_RARE_FLOOR_APPLIED"),
      mtgFoil: countReason("MTG_FOIL_FLOOR_APPLIED"),
      raised: values.filter((row) => Number(row.price_delta || 0) > 0).length,
      unknownGame: countReason("CARD_GAME_UNKNOWN")
    };
  }

  function renderRepricingFloorRuleSummary(rows, config = defaultRepricingFloorRuleConfig) {
    const summary = summarizeRepricingFloorRules(rows);
    const floorConfig = normalizeRepricingFloorRuleConfig(config);
    return `
      <div class="repricing-floor-card">
        <div>
          <p class="eyebrow">Floor Rule Recommendations</p>
          <h3>Configure conservative floor pricing.</h3>
          <p>Rows below a matched floor are pre-filled with a recommended price. Save changes before loading a snapshot, or reapply them to the current helper snapshot.</p>
        </div>
        <div class="repricing-floor-grid">
          ${Object.entries(repricingFloorRuleLabels).map(([key, label]) => `
            <label>
              <span>${escapeHtml(label)}</span>
              <input type="number" min="0" step="0.01" inputmode="decimal" data-repricing-floor="${escapeHtml(key)}" value="${escapeHtml(String(floorConfig[key]))}">
            </label>
          `).join("")}
        </div>
        <div class="repricing-floor-actions">
          <button class="button secondary" id="repricing-save-floor-rules" type="button">Save floor rules</button>
          <button class="button secondary" id="repricing-reset-floor-rules" type="button">Reset defaults</button>
          <button class="button primary" id="repricing-reapply-floor-rules" type="button"${rows && rows.length ? "" : " disabled"}>Reapply to snapshot</button>
        </div>
        <div class="registry-summary repricing-summary">
          <div><span>Evaluated</span><strong>${summary.evaluated}</strong></div>
          <div><span>Raised</span><strong>${summary.raised}</strong></div>
          <div><span>Default Floor</span><strong>${summary.defaultFloor}</strong></div>
          <div><span>Pokemon Holo</span><strong>${summary.pokemonHolo}</strong></div>
          <div><span>Pokemon Rare</span><strong>${summary.pokemonUltraRare}</strong></div>
          <div><span>MTG Foil</span><strong>${summary.mtgFoil}</strong></div>
          <div><span>Unknown Game</span><strong>${summary.unknownGame}</strong></div>
        </div>
      </div>`;
  }

  function summarizeRepricingBusiness(rows) {
    const values = Array.isArray(rows) ? rows : [];
    const withAnalysis = values.filter((row) => row.business_analysis && row.business_analysis.estimated_net_profit !== null);
    const minimumApplied = values.filter((row) => (row.reason_codes || []).includes("MINIMUM_VIABLE_PRICE_APPLIED")).length;
    const totalProfit = withAnalysis.reduce((total, row) => total + Number(row.business_analysis.estimated_net_profit || 0), 0);
    return {
      analyzed: withAnalysis.length,
      minimumApplied,
      averageProfit: withAnalysis.length ? roundCurrency(totalProfit / withAnalysis.length) : 0,
      minimumViablePrice: values[0] && values[0].business_analysis ? values[0].business_analysis.minimum_viable_price : null
    };
  }

  function renderRepricingBusinessProfile(rows, profile = defaultRepricingBusinessProfile) {
    const business = normalizeRepricingBusinessProfile(profile);
    const summary = summarizeRepricingBusiness(rows);
    const moneyInput = (key, label) => `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="number" min="0" step="0.01" inputmode="decimal" data-repricing-business="${escapeHtml(key)}" value="${escapeHtml(String(business[key]))}">
      </label>`;
    return `
      <div class="repricing-business-card">
        <div>
          <p class="eyebrow">Business pricing profile</p>
          <h3>Include free shipping, supplies, fees, and profit.</h3>
          <p>Recommendations use the higher of the market/floor result and your minimum viable price. The 1 oz eBay Standard Envelope default is ${escapeHtml(formatCurrency(business.ebayStandardEnvelopeOneOz))}.</p>
        </div>
        <div class="repricing-business-grid">
          ${moneyInput("acquisitionCost", "Acquisition")}
          ${moneyInput("sleeveCost", "Sleeve")}
          ${moneyInput("topLoaderCost", "Top loader")}
          ${moneyInput("teamBagCost", "Team bag")}
          ${moneyInput("envelopeCost", "Envelope")}
          ${moneyInput("labelAndTapeCost", "Label/tape")}
          ${moneyInput("otherSupplyCost", "Other supplies")}
          ${moneyInput("minimumProfit", "Min profit")}
          ${moneyInput("ebayStandardEnvelopeOneOz", "ESE 1 oz")}
          ${moneyInput("ebayStandardEnvelopeTwoOz", "ESE 2 oz")}
          ${moneyInput("ebayStandardEnvelopeThreeOz", "ESE 3 oz")}
          <label>
            <span>Default weight</span>
            <select data-repricing-business="defaultEnvelopeOunces">
              ${[1, 2, 3].map((ounces) => `<option value="${ounces}"${business.defaultEnvelopeOunces === ounces ? " selected" : ""}>${ounces} oz</option>`).join("")}
            </select>
          </label>
          <label>
            <span>eBay fee rate</span>
            <input type="number" min="0" step="0.0001" inputmode="decimal" data-repricing-business="ebayFinalValueFeeRate" value="${escapeHtml(String(business.ebayFinalValueFeeRate))}">
          </label>
          ${moneyInput("ebayPerOrderFeeUnderTen", "Fee <= $10")}
          ${moneyInput("ebayPerOrderFeeOverTen", "Fee > $10")}
          <label>
            <span>Rounding</span>
            <select data-repricing-business="roundingMode">
              ${[
                ["nearest_0_01", "Exact cents"],
                ["nearest_0_05", "Round up $0.05"],
                ["nearest_0_25", "Round up $0.25"],
                ["ending_0_49", "End in $0.49"],
                ["ending_0_99", "End in $0.99"]
              ].map(([value, label]) => `<option value="${escapeHtml(value)}"${business.roundingMode === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="repricing-floor-actions">
          <button class="button secondary" id="repricing-save-business-profile" type="button">Save business profile</button>
          <button class="button secondary" id="repricing-reset-business-profile" type="button">Reset business defaults</button>
        </div>
        <div class="registry-summary repricing-summary">
          <div><span>Minimum viable</span><strong>${escapeHtml(formatCurrency(calculateMinimumViablePrice(business)))}</strong></div>
          <div><span>Packaging</span><strong>${escapeHtml(formatCurrency(repricingPackagingCost(business)))}</strong></div>
          <div><span>Shipping</span><strong>${escapeHtml(formatCurrency(repricingShippingCost(business)))}</strong></div>
          <div><span>Business floor applied</span><strong>${summary.minimumApplied}</strong></div>
          <div><span>Avg est. profit</span><strong>${escapeHtml(formatCurrency(summary.averageProfit))}</strong></div>
        </div>
      </div>`;
  }

  function renderRepricingFilters(rows, activeFilter) {
    const filtersConfig = normalizeRepricingFilterConfig(activeFilter);
    const visibleCount = filterRepricingRows(rows, filtersConfig).length;
    const totalCount = Array.isArray(rows) ? rows.length : 0;
    const filters = [
      ["all", "All"],
      ["safe", "Auto-safe"],
      ["approved", "Approved"],
      ["needs_review", "Needs review"],
      ["blocked", "Blocked"],
      ["increase", "Increases"],
      ["decrease", "Decreases"]
    ];
    const selectControl = (id, label, value, options) => `
      <label>
        <span>${escapeHtml(label)}</span>
        <select id="${escapeHtml(id)}" data-repricing-filter-field="${escapeHtml(id)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${value === optionValue ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
        </select>
      </label>`;
    return `
      <div class="repricing-filter-panel" aria-label="Repricing filters">
        <div class="repricing-filter-header">
          <div>
            <p class="eyebrow">Review filters</p>
            <strong>${escapeHtml(String(visibleCount))} of ${escapeHtml(String(totalCount))} rows visible</strong>
          </div>
          <button class="button secondary" id="repricing-clear-filters" type="button">Clear filters</button>
        </div>
        <div class="repricing-filters">${filters.map(([value, label]) => `
          <button class="repricing-filter${filtersConfig.status === value ? " active" : ""}" type="button" data-repricing-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>
        `).join("")}</div>
        <div class="repricing-filter-grid">
          ${selectControl("game", "Game", filtersConfig.game, [["all", "All games"], ["pokemon", "Pokemon"], ["mtg", "Magic"], ["unknown", "Unknown"]])}
          ${selectControl("platform", "Platform", filtersConfig.platform, [["all", "All platforms"], ["ebay", "eBay only"], ["crosslisted", "eBay + Mana Pool"], ["manapool", "Mana Pool only"], ["unknown", "Unknown"]])}
          ${selectControl("priceBucket", "Current price", filtersConfig.priceBucket, [["all", "All prices"], ["under_2", "Under $2"], ["two_to_five", "$2-$5"], ["five_to_ten", "$5-$10"], ["ten_plus", "$10+"]])}
          <label>
            <span>Search</span>
            <input id="repricing-filter-search" data-repricing-filter-field="search" type="search" value="${escapeHtml(filtersConfig.search)}" placeholder="Card, SKU, condition">
          </label>
        </div>
      </div>`;
  }

  function renderReasonChips(row) {
    const values = [...(row.notes || [])];
    if (!values.length) {
      return "";
    }
    return values.slice(0, 3).map((value) => `<span class="repricing-chip warning">${escapeHtml(value)}</span>`).join("");
  }

  function renderRepricingRows(rows, filter) {
    const filtered = filterRepricingRows(rows, filter);
    if (!filtered.length) {
      return '<p class="operator-empty">No repricing rows match this filter.</p>';
    }
    return `<div class="repricing-list">${filtered.map((row) => `
      <article class="operator-list-row repricing-row ${escapeHtml(row.status)}">
        <div class="repricing-main">
          <strong>${escapeHtml(row.title || "Untitled price candidate")}</strong>
          <span>${escapeHtml([repricingGameDisplayLabel(row), row.condition || "No condition", row.variant, row.finish].filter(Boolean).join(" - "))}${repricingGameConfidence(row) === "unknown" ? ' <span class="repricing-game-warning">Game?</span>' : ""}</span>
          ${row.notes && row.notes.length ? `<div class="repricing-chips">${renderReasonChips(row)}</div>` : ""}
        </div>
        <div class="repricing-price-stack">
          <div><span>Current</span><strong>${escapeHtml(formatCurrency(row.current_price))}</strong></div>
          <label class="repricing-price-input">
            <span>Target</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-repricing-recommend="${escapeHtml(row.id)}" value="${row.recommended_price === null || row.recommended_price === undefined ? "" : escapeHtml(String(row.recommended_price))}">
          </label>
          ${row.business_analysis ? `
            <div><span>Profit</span><strong class="${Number(row.business_analysis.estimated_net_profit || 0) < 0 ? "negative" : "positive"}">${escapeHtml(formatCurrency(row.business_analysis.estimated_net_profit))}</strong></div>
          ` : ""}
          <div><span>Delta</span><strong class="${Number(row.price_delta || 0) < 0 ? "negative" : "positive"}">${escapeHtml(formatCurrency(row.price_delta))}</strong></div>
        </div>
        <div class="repricing-actions">
          <span>${escapeHtml(repricingDecisionLabel(row))}</span>
          <button class="button secondary" type="button" data-repricing-approve="${escapeHtml(row.id)}"${canApproveRepricingRow(row) || row.status === "approved" ? "" : " disabled"}>${row.status === "approved" ? "Approved" : "Approve"}</button>
          <button class="button secondary" type="button" data-repricing-skip="${escapeHtml(row.id)}">Skip</button>
          <a class="operator-inline-link" href="${escapeHtml(ebaySoldSearchUrl(row))}" target="_blank" rel="noopener noreferrer">Open sold search</a>
        </div>
      </article>
    `).join("")}</div>`;
  }
  function renderCardUploaderAutomaticInventoryRows(snapshot) {
    const rows = snapshot && Array.isArray(snapshot.rows) ? snapshot.rows : [];
    if (!rows.length) {
      return '<p class="operator-empty">No CardUploader automatic inventory rows loaded yet.</p>';
    }
    return `<div class="listing-review-list">${rows.slice(0, 50).map((row) => `
      <article class="operator-list-row listing-reconciliation-row">
        <div>
          <strong>${escapeHtml(row.title || "Untitled CardUploader row")}</strong>
          <span>${escapeHtml([row.catalog_sku, row.user_sku, row.condition, row.variant].filter(Boolean).join(" - ") || "No SKU detected")}</span>
          <span>${escapeHtml((row.raw_text || "").slice(0, 100))}</span>
        </div>
        <div>
          <span>Row ${escapeHtml(row.row_number || "")}</span>
          <strong>${row.current_price === null || row.current_price === undefined ? "n/a" : escapeHtml(formatCurrency(row.current_price))}</strong>
          <span>${escapeHtml(row.status || "Read-only scan")}</span>
        </div>
      </article>
    `).join("")}</div>${rows.length > 50 ? `<p class="operator-note">Showing first 50 of ${escapeHtml(rows.length)} scanned rows.</p>` : ""}`;
  }

  function readStoredRepricingPlan() {
    try {
      const payload = JSON.parse(localStorage.getItem(repricingReviewStorageKey) || "null");
      return Array.isArray(payload && payload.rows) ? payload.rows : [];
    } catch (_error) {
      return [];
    }
  }

  function writeStoredRepricingPlan(rows) {
    localStorage.setItem(repricingReviewStorageKey, JSON.stringify({
      saved_at: new Date().toISOString(),
      rows
    }));
  }

  function readStoredCardUploaderHelperSnapshot() {
    try {
      const payload = JSON.parse(localStorage.getItem(cardUploaderHelperSnapshotStorageKey) || "null");
      if (!payload || payload.source !== "carduploader_automatic_inventory_page_snapshot") {
        return null;
      }
      if (!looksLikeCardUploaderAutomaticInventoryUrl(payload.url)) {
        return null;
      }
      return {
        source: payload.source,
        url: payload.url,
        title: payload.title || "CardUploader automatic inventory",
        captured_at: payload.captured_at || "",
        controls: payload.controls || [],
        editable_controls: payload.editable_controls || [],
        rows: Array.isArray(payload.rows) ? payload.rows : []
      };
    } catch (_error) {
      return null;
    }
  }

  function cardUploaderAutomaticInventoryScannerScript() {
    return `(() => {
  const clean = (value, max = 800) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
  const attr = (el, name) => el.getAttribute(name) || '';
  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const selectorFor = (el) => {
    if (!el) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    const name = attr(el, 'name');
    if (name) return el.tagName.toLowerCase() + '[name="' + CSS.escape(name) + '"]';
    const dataAttr = Array.from(el.attributes || []).find((candidate) => candidate.name.startsWith('data-'));
    if (dataAttr) return el.tagName.toLowerCase() + '[' + dataAttr.name + '="' + CSS.escape(dataAttr.value) + '"]';
    return el.tagName.toLowerCase();
  };
  const controls = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'))
    .filter(isVisible)
    .map((el) => ({ text: clean(el.innerText || el.value, 100), aria_label: attr(el, 'aria-label'), selector: selectorFor(el) }));
  const editable_controls = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
    .filter(isVisible)
    .map((el) => ({
      value: clean(el.value || el.textContent, 100),
      name: attr(el, 'name'),
      id: el.id || '',
      aria_label: attr(el, 'aria-label'),
      placeholder: attr(el, 'placeholder'),
      selector: selectorFor(el),
    }));
  const tables = Array.from(document.querySelectorAll('table')).map((table, table_index) => ({
    table_index,
    headers: Array.from(table.querySelectorAll('th')).map((cell) => clean(cell.innerText, 120)),
    rows: Array.from(table.querySelectorAll('tbody tr, tr')).map((row, row_index) => ({
      row_index,
      text: clean(row.innerText, 1200),
      cells: Array.from(row.querySelectorAll('td, th')).map((cell) => clean(cell.innerText, 400)),
    })),
  }));
  const visibleTextBlocks = Array.from(document.querySelectorAll('main, [role="main"], section, article, div'))
    .filter(isVisible)
    .map((el) => clean(el.innerText, 600))
    .filter((text) => text && /\\b(CS-|ETB-|NM|LP|MP|HP|DMG|Near Mint|Listed|Unlisted)\\b/i.test(text))
    .slice(0, 200);
  const payload = {
    source: 'carduploader_automatic_inventory_page_snapshot',
    url: location.href,
    title: document.title,
    captured_at: new Date().toISOString(),
    controls,
    editable_controls,
    tables,
    visibleTextBlocks,
  };
  const output = JSON.stringify(payload, null, 2);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(output)
      .then(() => alert('CardUploader automatic inventory snapshot copied. Paste it back into CardVector.app.'))
      .catch(() => {
        console.log(output);
        alert('Snapshot could not be copied automatically. It was printed to the console.');
      });
  } else {
    console.log(output);
    alert('Snapshot was printed to the console. Copy it and paste it back into CardVector.app.');
  }
  return payload;
})()`;
  }

  function looksLikeCardUploaderAutomaticInventoryUrl(url) {
    return /^https:\/\/carduploader\.com\/dashboard\/inventory\/automatic(?:[/?#]|$)/i.test(String(url || ""));
  }

  function parseMoneyFromText(text) {
    const match = String(text || "").match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    return match ? Number(match[1]) : null;
  }

  function automaticInventoryHeaderKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function looksLikeAutomaticInventoryHeaders(headers) {
    const expected = new Set(["card", "status", "platform", "user sku", "catalog sku", "condition", "variant", "tcg", "game", "price", "market", "qty", "added"]);
    return headers.map(automaticInventoryHeaderKey).filter((header) => expected.has(header)).length >= 7;
  }

  function mappedAutomaticInventoryCells(headers, cells) {
    const mapped = {};
    headers.forEach((header, index) => {
      const key = automaticInventoryHeaderKey(header);
      if (key && index < cells.length) {
        mapped[key] = String(cells[index] || "").trim();
      }
    });
    return mapped;
  }

  function automaticInventoryGameLabel(value) {
    const text = String(value || "").toLowerCase().replace(/pok\u00e9/g, "poke").replace(/[^a-z0-9]+/g, " ").trim();
    if (!text || /^(ebay|mana pool|manapool|ebay mana pool)$/.test(text)) {
      return "";
    }
    if (/\b(pokemon|poke mon)\b/.test(text)) {
      return "Pokemon";
    }
    if (/\b(mtg|magic|magic the gathering)\b/.test(text)) {
      return "Magic";
    }
    if (/\b(yugioh|yu gi oh)\b/.test(text)) {
      return "Yu-Gi-Oh";
    }
    if (/\blorcana\b/.test(text)) {
      return "Lorcana";
    }
    if (/\bone piece\b/.test(text)) {
      return "One Piece";
    }
    return "";
  }

  function automaticInventoryGameFromRow(mapped, cells) {
    const explicit = automaticInventoryGameLabel(mapped.tcg || mapped.game || mapped["tcg game"] || mapped["game tcg"]);
    if (explicit) {
      return explicit;
    }
    return (cells || [])
      .filter((cell) => !/\bebay\b/i.test(cell || "") && !/\bmana\s*pool\b/i.test(cell || "") && !/\bmanapool\b/i.test(cell || ""))
      .map(automaticInventoryGameLabel)
      .find(Boolean) || "";
  }

  function parseCardUploaderAutomaticInventorySnapshot(snapshotText) {
    const text = String(snapshotText || "").trim();
    if (!text) {
      throw new Error("Paste a CardUploader automatic inventory snapshot first.");
    }
    if (text.includes("carduploader_automatic_inventory_page_snapshot") && text.includes("document.querySelectorAll")) {
      throw new Error("That is the scanner script, not the inventory JSON. Open CardUploader Automatic Inventory, paste the script into the browser console, press Enter, then paste the JSON it copies back here.");
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      throw new Error("Snapshot must be valid JSON copied after running the CardUploader automatic inventory scanner on the CardUploader page.");
    }
    if (!payload || payload.source !== "carduploader_automatic_inventory_page_snapshot") {
      throw new Error("Snapshot source is not a CardUploader automatic inventory page scan.");
    }
    if (!looksLikeCardUploaderAutomaticInventoryUrl(payload.url)) {
      throw new Error("Snapshot must come from the CardUploader automatic inventory page.");
    }
    const rows = [];
    for (const table of payload.tables || []) {
      const headers = Array.isArray(table.headers) ? table.headers.map((header) => String(header || "").trim()) : [];
      if (!looksLikeAutomaticInventoryHeaders(headers)) {
        continue;
      }
      for (const row of table.rows || []) {
        const cells = Array.isArray(row.cells) ? row.cells.map((cell) => String(cell || "").trim()) : [];
        const rawText = String(row.text || cells.join(" ")).replace(/\s+/g, " ").trim();
        if (!rawText || cells.length < 2) {
          continue;
        }
        if (headers.length && cells.join("|").toLowerCase() === headers.join("|").toLowerCase()) {
          continue;
        }
        const mapped = mappedAutomaticInventoryCells(headers, cells);
        const catalogSku = (rawText.match(/\bCS-[A-Z0-9-]+\b/i) || [""])[0].toUpperCase();
        const location = (rawText.match(/\bETB-[0-9]{3}-[A-J](?:\.[0-9]+)?\b/i) || [""])[0].toUpperCase();
        const priceCell = mapped.price || cells.find((cell) => /\$[0-9]/.test(cell)) || "";
        const tcg = automaticInventoryGameFromRow(mapped, cells);
        rows.push({
          row_number: rows.length + 1,
          row_key: mapped["catalog sku"] || catalogSku || mapped["user sku"] || location || `row-${rows.length + 1}`,
          title: mapped.card || cells[0] || rawText.slice(0, 120),
          status: mapped.status || "",
          platform: mapped.platform || "",
          tcg,
          catalog_sku: mapped["catalog sku"] || catalogSku,
          user_sku: mapped["user sku"] || location,
          location,
          condition: mapped.condition || "",
          variant: mapped.variant || "",
          current_price: parseMoneyFromText(priceCell),
          market_price: parseMoneyFromText(mapped.market || ""),
          quantity: parseWholeNumber(mapped.qty),
          added: mapped.added || "",
          raw_text: rawText
        });
      }
    }
    return {
      source: payload.source,
      url: payload.url,
      title: payload.title || "CardUploader automatic inventory",
      captured_at: payload.captured_at || "",
      controls: payload.controls || [],
      editable_controls: payload.editable_controls || [],
      rows
    };
  }

  function repricingRowsFromAutomaticInventorySnapshot(snapshot) {
    const rows = snapshot && Array.isArray(snapshot.rows) ? snapshot.rows : [];
    return rows.map((row, index) => normalizeRepricingRecord({
      id: `carduploader-auto:${normalizeSnapshotIdentityPart(row.row_key || row.catalog_sku || row.user_sku || index + 1)}`,
      inventory_id: row.catalog_sku || row.user_sku || row.row_key || "",
      row_number: row.row_number || index + 1,
      title: row.title || "",
      user_sku: row.user_sku || "",
      catalog_sku: row.catalog_sku || "",
      card_game: row.tcg || row.game || "",
      marketplace: "carduploader",
      current_price: row.current_price,
      recommended_price: "",
      quantity: row.quantity ?? 1,
      status: "dry_run",
      review_decision: "manual_review",
      review_priority: "normal",
      reason_codes: ["CARDUPLOADER_AUTOMATIC_INVENTORY_VISIBLE"],
      notes: [],
      search_query: [row.title, row.condition, row.variant].filter(Boolean).join(" "),
      condition: row.condition || "",
      variant: row.variant || "",
      raw_row: row
    }, index));
  }

  function updateRepricingRecommendation(row, value, businessProfile = defaultRepricingBusinessProfile) {
    const recommended = parseMoney(value);
    const current = row.current_price;
    const delta = current !== null && recommended !== null
      ? Math.round((recommended - current) * 100) / 100
      : null;
    const pct = current && recommended !== null
      ? `${Math.round(((recommended - current) / current * 100) * 100) / 100}`
      : "";
    return {
      ...row,
      recommended_price: recommended,
      price_delta: delta,
      percent_delta: pct,
      status: row.status === "skipped" ? "skipped" : "dry_run",
      apply_ready: false,
      reason_codes: Array.from(new Set([...(row.reason_codes || []), "MANUAL_RECOMMENDATION_OVERRIDE"])),
      notes: recommended === null ? ["recommended_price_required"] : [],
      business_analysis: buildRepricingBusinessAnalysis(recommended, businessProfile)
    };
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  function listingSnapshotPayload(record, user, importBatchId) {
    return {
      owner_user_id: user.id,
      marketplace: record.marketplace || "ebay",
      source: record.source || "ebay_active_listing_csv",
      source_file_name: record.source_file_name,
      source_file_sha256: record.source_file_sha256,
      import_batch_id: importBatchId,
      marketplace_listing_id: record.marketplace_listing_id,
      sku: record.sku,
      listing_title: record.listing_title,
      listing_status: record.listing_status,
      current_price: record.current_price,
      currency: record.currency,
      quantity_available: record.quantity_available,
      quantity_sold: record.quantity_sold,
      condition: record.condition,
      category: record.category,
      listing_url: record.listing_url,
      location_hint: baseLocationHint(record.location_hint),
      batch_sequence_label: record.location_hint,
      review_status: record.review_status,
      reason_codes: record.reason_codes,
      raw_row: record.raw_row,
      imported_at: new Date().toISOString()
    };
  }

  function listingMatchPayload(snapshot, record, user) {
    return {
      owner_user_id: user.id,
      marketplace_listing_snapshot_id: snapshot.id,
      external_inventory_provider: "carduploader",
      external_inventory_id: "",
      location_display_code: baseLocationHint(record.location_hint),
      batch_sequence_label: record.location_hint,
      match_status: record.review_status,
      match_confidence: record.location_hint && record.sku ? 0.65 : 0.25,
      reason_codes: record.reason_codes,
      review_notes: "",
      reviewed_at: null
    };
  }

  function inventoryQuantitySnapshotPayload(record, user, importBatchId) {
    return {
      owner_user_id: user.id,
      external_inventory_provider: record.external_inventory_provider || "carduploader",
      source: record.source || "carduploader_inventory_csv",
      source_file_name: record.source_file_name,
      source_file_sha256: record.source_file_sha256,
      import_batch_id: importBatchId,
      external_inventory_id: record.external_inventory_id,
      sku: record.sku,
      inventory_title: record.inventory_title,
      inventory_status: record.inventory_status,
      condition: record.condition,
      location_display_code: baseLocationHint(record.location_display_code),
      physical_quantity: record.physical_quantity,
      available_quantity: record.available_quantity,
      reserved_quantity: record.reserved_quantity,
      sold_quantity: record.sold_quantity,
      raw_row: record.duplicate_source_rows && record.duplicate_source_rows.length
        ? {
            canonical_row: record.raw_row,
            duplicate_rows: record.duplicate_source_rows,
            duplicate_count: record.duplicate_source_rows.length
          }
        : record.raw_row,
      imported_at: new Date().toISOString()
    };
  }

  function inventorySnapshotConflictKey(record) {
    return [
      record.owner_user_id,
      String(record.external_inventory_provider || "carduploader").toLowerCase(),
      String(record.external_inventory_id || ""),
      String(record.condition || "")
    ].join("\u001f");
  }

  function dedupeInventorySnapshotRows(rows) {
    const byIdentity = new Map();
    let duplicateCount = 0;
    rows.forEach((row) => {
      const key = inventorySnapshotConflictKey(row);
      const existing = byIdentity.get(key);
      if (!existing) {
        byIdentity.set(key, { ...row, duplicate_source_rows: [] });
        return;
      }
      duplicateCount += 1;
      existing.duplicate_source_rows = [
        ...(existing.duplicate_source_rows || []),
        row.raw_row || row
      ];
      existing.reason_codes = Array.from(new Set([
        ...(existing.reason_codes || []),
        ...(row.reason_codes || []),
        "DUPLICATE_INVENTORY_SNAPSHOT_IDENTITY_SKIPPED"
      ]));
    });
    const dedupedRows = Array.from(byIdentity.values()).map((row) => {
      const { duplicate_source_rows: duplicateSourceRows = [], ...payload } = row;
      if (!duplicateSourceRows.length) {
        return payload;
      }
      return {
        ...payload,
        raw_row: {
          canonical_row: payload.raw_row,
          duplicate_rows: duplicateSourceRows,
          duplicate_count: duplicateSourceRows.length
        }
      };
    });
    return { rows: dedupedRows, duplicateCount };
  }

  async function supabaseChunks(items, size, handler) {
    const results = [];
    for (let index = 0; index < items.length; index += size) {
      const chunk = items.slice(index, index + size);
      const result = await handler(chunk);
      results.push(...(result || []));
    }
    return results;
  }

  async function importListingSnapshot(client, user, parsed) {
    if (!parsed || !parsed.records.length) {
      throw new Error("Choose a marketplace CSV before importing.");
    }
    const marketplaceLabel = parsed.marketplaceLabel || "marketplace";
    const importBatchId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const rows = parsed.records
      .filter((record) => record.marketplace_listing_id && record.review_status !== "duplicate_listing_id")
      .map((record) => listingSnapshotPayload(record, user, importBatchId));
    if (!rows.length) {
      throw new Error(`No rows with ${marketplaceLabel} listing identities were available to import.`);
    }
    const snapshots = await supabaseChunks(rows, 150, async (chunk) => {
      const result = await client
        .from("cardvector_marketplace_listing_snapshots")
        .upsert(chunk, { onConflict: "owner_user_id,marketplace,marketplace_listing_id" })
        .select("id,marketplace_listing_id");
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    });
    const snapshotByListingId = new Map(snapshots.map((snapshot) => [String(snapshot.marketplace_listing_id), snapshot]));
    const matchRows = parsed.records
      .filter((record) => record.marketplace_listing_id && snapshotByListingId.has(String(record.marketplace_listing_id)))
      .map((record) => listingMatchPayload(snapshotByListingId.get(String(record.marketplace_listing_id)), record, user));
    await supabaseChunks(matchRows, 150, async (chunk) => {
      const result = await client
        .from("cardvector_inventory_listing_matches")
        .upsert(chunk, { onConflict: "owner_user_id,marketplace_listing_snapshot_id" });
      if (result.error) {
        throw result.error;
      }
      return [];
    });
    return {
      importBatchId,
      importedListings: rows.length,
      importedMatches: matchRows.length,
      skippedRows: parsed.records.length - rows.length
    };
  }

  async function importInventoryQuantitySnapshot(client, user, parsed) {
    if (!parsed || !parsed.records.length) {
      throw new Error("Choose a CardUploader inventory CSV before importing.");
    }
    const importBatchId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const candidateRows = parsed.records
      .filter((record) => record.external_inventory_id && record.sku)
      .map((record) => inventoryQuantitySnapshotPayload(record, user, importBatchId));
    const deduped = dedupeInventorySnapshotRows(candidateRows);
    const rows = deduped.rows;
    if (!rows.length) {
      throw new Error("No CardUploader inventory rows with SKU evidence were available to import.");
    }
    await supabaseChunks(rows, 150, async (chunk) => {
      const result = await client
        .from("cardvector_inventory_quantity_snapshots")
        .upsert(chunk, { onConflict: "owner_user_id,external_inventory_provider,external_inventory_id,condition" });
      if (result.error) {
        throw result.error;
      }
      return [];
    });
    return {
      importBatchId,
      importedInventoryRows: rows.length,
      deduplicatedRows: deduped.duplicateCount,
      skippedRows: parsed.records.length - candidateRows.length
    };
  }

  async function loadOperatorListingSnapshots(client, user, options = {}) {
    await requireLocationAuthorization(client, user);
    const cached = !options.forceRefresh ? readEgressCache("listingSnapshots", user) : null;
    if (cached) {
      return { ...cached.data, cache: { cached: true, cachedAt: cached.cachedAt } };
    }
    const consolidated = await queryOptionalTable(
      client,
      "cardvector_marketplace_listing_reconciliation_v",
      "id,marketplace,marketplace_listing_id,sku,listing_title,current_price,currency,quantity_available,quantity_sold,listing_status,location_hint,batch_sequence_label,review_status,reason_codes,imported_at,updated_at",
      (query) => query.order("imported_at", { ascending: false }).limit(egressSafeLimits.listingSnapshots)
    );
    if (!consolidated.missing) {
      writeEgressCache("listingSnapshots", user, consolidated);
      return consolidated;
    }
    const fallback = await queryOptionalTable(
      client,
      "cardvector_ebay_listing_reconciliation_v",
      "id,marketplace,marketplace_listing_id,sku,listing_title,current_price,currency,quantity_available,quantity_sold,listing_status,location_hint,batch_sequence_label,review_status,reason_codes,imported_at,updated_at",
      (query) => query.order("imported_at", { ascending: false }).limit(egressSafeLimits.listingSnapshots)
    );
    writeEgressCache("listingSnapshots", user, fallback);
    return fallback;
  }

  async function loadOperatorAllocationLedger(client, user, options = {}) {
    const cached = !options.forceRefresh ? readEgressCache("allocationLedger", user) : null;
    if (cached) {
      return { ...cached.data, cache: { cached: true, cachedAt: cached.cachedAt } };
    }
    const result = await queryOptionalTable(
      client,
      "cardvector_marketplace_allocation_ledger_v",
      "sku,inventory_title,physical_quantity,available_quantity,ebay_listed_quantity,tcgplayer_listed_quantity,total_listed_quantity,listed_marketplaces,allocation_status,reason_codes,last_marketplace_import_at,last_inventory_import_at",
      (query) => query.order("allocation_status", { ascending: true }).order("sku", { ascending: true }).limit(egressSafeLimits.allocationLedger)
    );
    writeEgressCache("allocationLedger", user, result);
    return result;
  }

  async function loadListingBatchReferences(client, user, options = {}) {
    const cached = !options.forceRefresh ? readEgressCache("listingBatchReferences", user) : null;
    if (cached) {
      return { ...cached.data, cache: { cached: true, cachedAt: cached.cachedAt } };
    }
    const result = await queryOptionalTable(
      client,
      "cardvector_carduploader_batch_events",
      "id,carduploader_batch_id,carduploader_batch_name,location_display_code,batch_label,card_count,batch_date,updated_at,archived_at",
      (query) => query.is("archived_at", null).order("batch_date", { ascending: false }).limit(egressSafeLimits.listingBatchReferences)
    );
    writeEgressCache("listingBatchReferences", user, result);
    return result;
  }

  function listingReferenceLocation(record) {
    return baseLocationHint(
      record && (
        record.batch_sequence_label
        || record.location_hint
        || listingLocationHint(record.sku)
        || listingLocationHint(record.listing_title)
      )
    );
  }

  function reconcileListingSnapshots(snapshots, batchReferences) {
    const listings = Array.isArray(snapshots) ? snapshots : [];
    const references = Array.isArray(batchReferences) ? batchReferences : [];
    const referencesByLocation = new Map();
    references.forEach((reference) => {
      const location = baseLocationHint(reference.location_display_code);
      if (!location) return;
      if (!referencesByLocation.has(location)) referencesByLocation.set(location, []);
      referencesByLocation.get(location).push(reference);
    });
    const skuCounts = new Map();
    listings.forEach((listing) => {
      const sku = normalizeSku(listing.sku);
      if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });
    const buckets = {
      matched: [],
      missing_from_ebay: [],
      ebay_only: [],
      duplicate_sku: [],
      missing_sku: [],
      needs_manual_review: []
    };
    const referencedLocations = new Set();
    listings.forEach((listing) => {
      const sku = normalizeSku(listing.sku);
      const location = listingReferenceLocation(listing);
      const matches = referencesByLocation.get(location) || [];
      if (matches.length) referencedLocations.add(location);
      if (!sku) {
        buckets.missing_sku.push({ ...listing, reconciliation_reason: "eBay snapshot has no SKU" });
        return;
      }
      if ((skuCounts.get(sku) || 0) > 1) {
        buckets.duplicate_sku.push({ ...listing, reconciliation_reason: "SKU appears on multiple eBay listings" });
        return;
      }
      if (!location) {
        buckets.ebay_only.push({ ...listing, reconciliation_reason: "No CardUploader batch/location reference is encoded in the snapshot" });
        return;
      }
      if (!matches.length) {
        buckets.needs_manual_review.push({ ...listing, reconciliation_reason: `Location ${location} has no CardUploader batch reference` });
        return;
      }
      buckets.matched.push({
        ...listing,
        reconciliation_reason: `Matched CardUploader location ${location}`,
        matched_batch_references: matches
      });
    });
    references.forEach((reference) => {
      const location = baseLocationHint(reference.location_display_code);
      if (location && !referencedLocations.has(location)) {
        buckets.missing_from_ebay.push({
          ...reference,
          reconciliation_reason: `CardUploader batch/location ${location} has no matched eBay snapshot`
        });
      }
    });
    return buckets;
  }

  const listingBucketLabels = {
    matched: "Matched",
    missing_from_ebay: "Missing from eBay",
    ebay_only: "eBay-only",
    duplicate_sku: "Duplicate SKU",
    missing_sku: "Missing SKU",
    needs_manual_review: "Needs manual review"
  };

  const allocationStatusLabels = {
    oversell_risk: "Oversell risk",
    cross_channel_conflict: "Cross-channel conflict",
    ebay_only_legacy_listing: "Unlinked eBay legacy listing",
    marketplace_only_legacy_listing: "Unlinked marketplace legacy listing",
    fully_allocated: "Fully allocated",
    safe_capacity: "Safe capacity",
    needs_inventory_snapshot: "Needs inventory snapshot",
    needs_review: "Needs review"
  };

  function isCardUploaderLinked(row) {
    return row?.allocation_key_type === "carduploader_catalog_sku" || Boolean(managedInventorySku(row?.sku));
  }

  function buildMarketplaceAllocationLedger(listings, inventorySnapshots = []) {
    const rowsBySku = new Map();
    const ensure = (sku, defaults = {}) => {
      const key = normalizeSku(sku);
      if (!rowsBySku.has(key)) {
        rowsBySku.set(key, {
          sku: key,
          allocation_key_type: defaults.allocation_key_type || "unknown",
          inventory_title: "",
          physical_quantity: null,
          available_quantity: null,
          ebay_listed_quantity: 0,
          tcgplayer_listed_quantity: 0,
          total_listed_quantity: 0,
          listed_marketplaces: [],
          allocation_status: "needs_inventory_snapshot",
          reason_codes: ["NEEDS_CARDUPLOADER_INVENTORY_SNAPSHOT"]
        });
      }
      return rowsBySku.get(key);
    };
    (Array.isArray(inventorySnapshots) ? inventorySnapshots : []).forEach((item) => {
      const raw = item.raw_row || {};
      const catalogSku = managedInventorySku(item.sku || item.catalog_sku || item.carduploader_catalog_sku || raw["Catalog SKU"]);
      const sku = catalogSku || normalizeSku(item.sku || item.user_sku || raw["User SKU"] || item.location || item.inventory_id);
      if (!sku) return;
      const row = ensure(sku, { allocation_key_type: catalogSku ? "carduploader_catalog_sku" : "legacy_inventory_sku" });
      row.allocation_key_type = catalogSku ? "carduploader_catalog_sku" : row.allocation_key_type;
      row.inventory_title = item.inventory_title || item.title || row.inventory_title;
      const status = String(item.inventory_status || item.status || "").toLowerCase();
      const quantity = Number.isFinite(Number(item.physical_quantity ?? item.quantity_value ?? item.quantity))
        ? Math.max(0, Math.trunc(Number(item.physical_quantity ?? item.quantity_value ?? item.quantity)))
        : 0;
      const availableQuantity = ["sold", "removed", "deleted", "archived"].includes(status)
        ? 0
        : Number.isFinite(Number(item.available_quantity ?? quantity))
          ? Math.max(0, Math.trunc(Number(item.available_quantity ?? quantity)))
          : 0;
      row.physical_quantity = Number(row.physical_quantity || 0) + quantity;
      row.available_quantity = Number(row.available_quantity || 0) + availableQuantity;
    });
    (Array.isArray(listings) ? listings : []).forEach((listing) => {
      const normalizedSku = normalizeSku(listing.sku);
      const marketplace = String(listing.marketplace || "ebay").toLowerCase();
      const sku = normalizedSku || `${marketplace}:${listing.marketplace_listing_id || listing.listing_title || "missing-sku"}`;
      if (!sku) return;
      const row = ensure(sku, {
        allocation_key_type: managedInventorySku(normalizedSku)
          ? "carduploader_catalog_sku"
          : normalizedSku
            ? "legacy_marketplace_sku"
            : "marketplace_listing_id"
      });
      if (managedInventorySku(normalizedSku)) {
        row.allocation_key_type = "carduploader_catalog_sku";
      } else if (row.allocation_key_type === "unknown") {
        row.allocation_key_type = normalizedSku ? "legacy_marketplace_sku" : "marketplace_listing_id";
      }
      if (!row.inventory_title) {
        row.inventory_title = listing.listing_title || "";
      }
      const quantity = Number.isFinite(Number(listing.quantity_available)) ? Math.max(0, Math.trunc(Number(listing.quantity_available))) : 0;
      if (marketplace === "tcgplayer") {
        row.tcgplayer_listed_quantity += quantity;
      } else if (marketplace === "ebay") {
        row.ebay_listed_quantity += quantity;
      }
      if (!row.listed_marketplaces.includes(marketplace)) {
        row.listed_marketplaces.push(marketplace);
      }
      row.total_listed_quantity += quantity;
    });
    return [...rowsBySku.values()].map((row) => {
      const available = row.available_quantity;
      if (available === null || available === undefined) {
        if (row.allocation_key_type !== "carduploader_catalog_sku") {
          const onlyEbay = row.ebay_listed_quantity > 0 && row.tcgplayer_listed_quantity === 0;
          return {
            ...row,
            allocation_status: onlyEbay ? "ebay_only_legacy_listing" : "marketplace_only_legacy_listing",
            reason_codes: [onlyEbay ? "EBAY_LISTING_NOT_LINKED_TO_CARDUPLOADER_CATALOG_SKU" : "MARKETPLACE_LISTING_NOT_LINKED_TO_CARDUPLOADER_CATALOG_SKU"]
          };
        }
        return row;
      }
      if (row.ebay_listed_quantity > 0 && row.tcgplayer_listed_quantity > 0 && row.total_listed_quantity > available) {
        return { ...row, allocation_status: "oversell_risk", reason_codes: ["LISTED_QUANTITY_EXCEEDS_AVAILABLE", "MULTIPLE_MARKETPLACES_LISTED"] };
      }
      if (row.ebay_listed_quantity > 0 && row.tcgplayer_listed_quantity > 0 && available <= Math.max(row.ebay_listed_quantity, row.tcgplayer_listed_quantity)) {
        return { ...row, allocation_status: "cross_channel_conflict", reason_codes: ["MULTIPLE_MARKETPLACES_SHARE_SINGLE_CAPACITY"] };
      }
      if (row.total_listed_quantity > available) {
        return { ...row, allocation_status: "oversell_risk", reason_codes: ["LISTED_QUANTITY_EXCEEDS_AVAILABLE"] };
      }
      if (row.total_listed_quantity === available) {
        return { ...row, allocation_status: "fully_allocated", reason_codes: ["LISTED_QUANTITY_EQUALS_AVAILABLE"] };
      }
      if (row.total_listed_quantity < available) {
        return { ...row, allocation_status: "safe_capacity", reason_codes: ["AVAILABLE_QUANTITY_REMAINS"] };
      }
      return { ...row, allocation_status: "needs_review", reason_codes: ["ALLOCATION_REVIEW_REQUIRED"] };
    }).sort((a, b) => {
      const severity = { oversell_risk: 0, cross_channel_conflict: 1, ebay_only_legacy_listing: 2, marketplace_only_legacy_listing: 3, needs_inventory_snapshot: 4, needs_review: 5, fully_allocated: 6, safe_capacity: 7 };
      return (severity[a.allocation_status] ?? 9) - (severity[b.allocation_status] ?? 9) || a.sku.localeCompare(b.sku);
    });
  }

  function allocationLedgerSummary(rows) {
    const values = Array.isArray(rows) ? rows : [];
    return {
      totalSkus: values.length,
      cardUploaderLinked: values.filter(isCardUploaderLinked).length,
      oversellRisk: values.filter((row) => row.allocation_status === "oversell_risk").length,
      crossChannel: values.filter((row) => row.allocation_status === "cross_channel_conflict").length,
      legacyListings: values.filter((row) => ["ebay_only_legacy_listing", "marketplace_only_legacy_listing"].includes(row.allocation_status)).length,
      needsInventory: values.filter((row) => row.allocation_status === "needs_inventory_snapshot").length
    };
  }

  function renderAllocationLedger(rows, missingLedger) {
    if (missingLedger) {
      return '<p class="operator-empty">Marketplace allocation ledger is pending migration in Supabase.</p>';
    }
    if (!rows || !rows.length) {
      return '<p class="operator-empty">No marketplace allocation evidence is available yet. Import eBay and TCGplayer snapshots to begin comparing listed quantities.</p>';
    }
    const summary = allocationLedgerSummary(rows);
    return `
      <div class="registry-summary listing-summary">
        <div><span>SKUs</span><strong>${summary.totalSkus}</strong></div>
        <div><span>CardUploader Linked</span><strong>${summary.cardUploaderLinked}</strong></div>
        <div><span>Oversell Risk</span><strong>${summary.oversellRisk}</strong></div>
        <div><span>Cross-Channel</span><strong>${summary.crossChannel}</strong></div>
        <div><span>Unlinked Legacy</span><strong>${summary.legacyListings}</strong></div>
        <div><span>Need Inventory</span><strong>${summary.needsInventory}</strong></div>
      </div>
      <div class="allocation-ledger-list">
        ${rows.slice(0, 30).map((row) => `
          <article class="operator-list-row listing-reconciliation-row allocation-ledger-row ${escapeHtml(row.allocation_status || "needs_review")}">
            <div>
              <strong>${escapeHtml(row.sku || "Missing SKU")}</strong>
              <span>${escapeHtml(row.inventory_title || "Marketplace snapshot evidence")}</span>
              <span>${escapeHtml(isCardUploaderLinked(row) ? "CardUploader identifier trusted" : "No CardUploader identifier")}${Array.isArray(row.reason_codes) && row.reason_codes.length ? ` &middot; ${escapeHtml(row.reason_codes.join(", "))}` : ""}</span>
            </div>
            <div>
              <span>eBay ${Number(row.ebay_listed_quantity || 0)} &middot; TCGplayer ${Number(row.tcgplayer_listed_quantity || 0)}</span>
              <strong>${Number(row.total_listed_quantity || 0)} listed / ${row.available_quantity === null || row.available_quantity === undefined ? "?" : Number(row.available_quantity)} available</strong>
              <span>${escapeHtml(allocationStatusLabels[row.allocation_status] || compactStatusLabel(row.allocation_status || "needs_review"))}</span>
            </div>
          </article>`).join("")}
      </div>`;
  }

  function renderReconciliationBuckets(buckets) {
    const values = buckets || reconcileListingSnapshots([], []);
    return `
      <div class="listing-bucket-summary" aria-label="Reconciliation bucket counts">
        ${Object.entries(listingBucketLabels).map(([key, label]) => `
          <a href="#listing-bucket-${key}">
            <span>${escapeHtml(label)}</span>
            <strong>${values[key].length}</strong>
          </a>`).join("")}
      </div>
      <div class="listing-buckets">
        ${Object.entries(listingBucketLabels).map(([key, label]) => `
          <section class="operator-side-panel listing-bucket" id="listing-bucket-${key}" aria-labelledby="listing-bucket-${key}-title">
            <h2 id="listing-bucket-${key}-title">${escapeHtml(label)} <span>${values[key].length}</span></h2>
            ${key === "missing_from_ebay" ? '<p class="operator-note">Reference-level gap only. Card-level absence cannot be inferred from batch metadata.</p>' : ""}
            ${renderReconciliationBucketRows(values[key], key)}
          </section>`).join("")}
      </div>`;
  }

  function renderReconciliationBucketRows(rows, bucket) {
    if (!rows.length) return '<p class="operator-empty">No records in this bucket.</p>';
    return rows.slice(0, 20).map((row) => {
      const isReference = bucket === "missing_from_ebay";
      const title = isReference
        ? row.carduploader_batch_name || row.batch_label || "CardUploader batch reference"
        : row.listing_title || "Untitled listing";
      const identity = isReference
        ? `${row.location_display_code || "No location"} · ${row.carduploader_batch_id || "No batch ID"}`
        : `${row.sku || "Missing SKU"} · eBay ${row.marketplace_listing_id || "missing item ID"}`;
      const detail = isReference
        ? `${Number(row.card_count || 0)} cards · ${row.batch_date || "No batch date"}`
        : formatCurrency(row.current_price);
      return `
        <article class="operator-list-row listing-reconciliation-row">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(identity)}</span>
            <span>${escapeHtml(row.reconciliation_reason || "")}</span>
          </div>
          <div><strong>${escapeHtml(detail)}</strong></div>
        </article>`;
    }).join("");
  }

  function renderListingSummary(summary) {
    const values = summary || {};
    if (Object.prototype.hasOwnProperty.call(values, "totalQuantity")) {
      return `
        <div class="registry-summary listing-summary">
          <div><span>Rows</span><strong>${Number(values.totalRows || 0)}</strong></div>
          <div><span>Quantity</span><strong>${Number(values.totalQuantity || 0)}</strong></div>
          <div><span>Unique SKUs</span><strong>${Number(values.uniqueSkus || 0)}</strong></div>
          <div><span>Needs Review</span><strong>${Number(values.needsReview || 0) + Number(values.missingSku || 0)}</strong></div>
        </div>`;
    }
    return `
      <div class="registry-summary listing-summary">
        <div><span>Rows</span><strong>${Number(values.totalRows || 0)}</strong></div>
        <div><span>Linked Hints</span><strong>${Number(values.linkedLocations || 0)}</strong></div>
        <div><span>Duplicate SKUs</span><strong>${Number(values.duplicateSku || 0)}</strong></div>
        <div><span>Needs Review</span><strong>${Number(values.needsReview || 0) + Number(values.missingSku || 0) + Number(values.duplicateListingId || 0)}</strong></div>
      </div>`;
  }

  function renderInventorySnapshotRows(records, limit = 40) {
    if (!records || !records.length) {
      return '<p class="operator-empty">Import a CardUploader inventory CSV to stage quantity evidence.</p>';
    }
    return records.slice(0, limit).map((record) => `
      <article class="operator-list-row listing-reconciliation-row">
        <div>
          <strong>${escapeHtml(record.inventory_title || "Untitled inventory row")}</strong>
          <span>${escapeHtml(record.sku || "Missing SKU")} &middot; ${escapeHtml(record.condition || "No condition")}</span>
          <span>${escapeHtml(record.reason_codes.join(", "))}</span>
        </div>
        <div>
          <span>${escapeHtml(record.location_display_code || "No location")}</span>
          <strong>${Number(record.available_quantity ?? record.physical_quantity ?? 0)} available</strong>
          <span>${escapeHtml(compactStatusLabel(record.inventory_status || record.review_status))}</span>
        </div>
      </article>`).join("");
  }

  function renderCurrentSnapshotRows(parsed) {
    if (!parsed) {
      return '<p class="operator-empty">No CSV loaded yet.</p>';
    }
    return parsed.type === "inventory"
      ? renderInventorySnapshotRows(parsed.records)
      : renderListingRows(parsed.records);
  }

  function renderListingRows(records, limit = 40) {
    if (!records || !records.length) {
      return '<p class="operator-empty">Import a marketplace snapshot CSV to stage reconciliation rows.</p>';
    }
    return records.slice(0, limit).map((record) => `
      <article class="operator-list-row listing-reconciliation-row">
        <div>
          <strong>${escapeHtml(record.listing_title || "Untitled listing")}</strong>
          <span>${escapeHtml(record.sku || "Missing SKU")} &middot; ${escapeHtml(record.marketplace_label || record.marketplace || "Marketplace")} ${escapeHtml(record.marketplace_listing_id || "missing listing ID")}</span>
          <span>${escapeHtml(record.reason_codes.join(", "))}</span>
        </div>
        <div>
          <span>${escapeHtml(record.location_hint || "No location hint")}</span>
          <strong>${escapeHtml(formatCurrency(record.current_price))}</strong>
          <span>${escapeHtml(compactStatusLabel(record.review_status))}</span>
        </div>
      </article>`).join("");
  }

  function renderImportedListingRows(rows) {
    if (!rows || !rows.length) {
      return '<p class="operator-empty">No imported marketplace listing snapshots are available yet.</p>';
    }
    return rows.slice(0, 20).map((row) => `
      <article class="operator-list-row listing-reconciliation-row">
        <div>
          <strong>${escapeHtml(row.listing_title || "Untitled listing")}</strong>
          <span>${escapeHtml(row.sku || "Missing SKU")} &middot; ${escapeHtml(row.marketplace || "marketplace")} ${escapeHtml(row.marketplace_listing_id || "")}</span>
          <span>${Array.isArray(row.reason_codes) ? escapeHtml(row.reason_codes.join(", ")) : ""}</span>
        </div>
        <div>
          <span>${escapeHtml(row.batch_sequence_label || row.location_hint || "No location hint")}</span>
          <strong>${escapeHtml(formatCurrency(row.current_price))}</strong>
          <span>${escapeHtml(compactStatusLabel(row.review_status))}</span>
        </div>
      </article>`).join("");
  }

  async function renderOperatorRepricingReview() {
    const state = {
      rows: readStoredRepricingPlan(),
      snapshot: readStoredCardUploaderHelperSnapshot(),
      floorConfig: readStoredRepricingFloorRuleConfig(),
      businessProfile: readStoredRepricingBusinessProfile(),
      filters: readStoredRepricingFilterConfig(),
      error: "",
      message: "",
      focusCandidates: false
    };

    async function draw() {
      main.innerHTML = `
        <section class="operator-shell wrap listing-shell repricing-shell" aria-labelledby="repricing-review-title">
          <div class="operator-toolbar">
            <div>
              <p class="eyebrow">CardVector operator</p>
              <h1 id="repricing-review-title">Automatic Inventory Price Review</h1>
              <p>Review CardUploader automatic inventory prices through the Chrome helper before changing values that sync live to eBay.</p>
              <p class="operator-note">CardUploader remains inventory truth. CardVector reads the latest helper snapshot from this browser and never asks you to paste scripts or JSON.</p>
            </div>
            <div class="operator-toolbar-actions">
              <a class="button secondary" href="/operator">Operator Dashboard</a>
              <a class="button primary" href="https://carduploader.com/dashboard/inventory/automatic" target="_blank" rel="noopener noreferrer">Open CardUploader Automatic Inventory</a>
            </div>
          </div>
          <div class="operator-warning" role="status">CardUploader automatic inventory is already connected to live eBay sync. Live apply remains disabled until apply behavior and approval guardrails are built.</div>
          <div class="registry-summary repricing-summary">
            <div><span>Source</span><strong>Automatic Inventory</strong></div>
            <div><span>Inventory Truth</span><strong>CardUploader</strong></div>
            <div><span>eBay Sync</span><strong>CardUploader</strong></div>
            <div><span>Live Apply</span><strong>Disabled</strong></div>
          </div>
          <div class="operator-side-panel operator-main-panel">
            <h2>Safe Review Workflow</h2>
            <div class="repricing-live-steps">
              <article>
                <span>1</span>
                <strong>Install Chrome helper</strong>
                <p>The private extension runs on CardUploader and owns browser access to the signed-in page.</p>
              </article>
              <article>
                <span>2</span>
                <strong>Scan automatic inventory</strong>
                <p>Use the helper panel on CardUploader to capture visible rows without console scripts.</p>
              </article>
              <article>
                <span>3</span>
                <strong>Set reviewed prices</strong>
                <p>Review sold-search evidence, enter recommended prices, and approve only rows you are comfortable changing.</p>
              </article>
              <article>
                <span>4</span>
                <strong>Apply later with guardrails</strong>
                <p>Approved rows become a local plan. Applying changes stays locked until save behavior is proven and explicitly enabled.</p>
              </article>
            </div>
          </div>
          <section class="operator-side-panel operator-main-panel" aria-labelledby="repricing-helper-title">
            <h2 id="repricing-helper-title">PC Helper Connection</h2>
            ${state.message ? `<div class="operator-success" role="status">${escapeHtml(state.message)}</div>` : ""}
            ${state.error ? `<div class="operator-warning" role="alert">${escapeHtml(state.error)}</div>` : ""}
            <div class="repricing-command-bar">
              <div class="repricing-command-actions">
                <button class="button secondary" id="repricing-helper-status" type="button">Check helper status</button>
                <button class="button secondary" id="repricing-request-snapshot" type="button"${state.snapshot && state.snapshot.rows.length ? "" : " disabled"}>Load helper snapshot</button>
                <button class="button primary" id="repricing-apply-live" type="button"${summarizeRepricingRows(state.rows).approved ? "" : " disabled"}>Prepare approved price updates</button>
              </div>
            </div>
            <ol class="repricing-instructions">
              <li>Install the private CardVector Chrome helper.</li>
              <li>Open CardUploader Automatic Inventory in the same Chrome profile.</li>
              <li>Click Scan Visible Rows in the helper panel.</li>
              <li>Return here and load the helper snapshot for review.</li>
              <li>Approve prices here only after reviewing evidence. Live apply stays locked until the apply helper is separately approved.</li>
            </ol>
            <div class="repricing-helper-card">
              <span>Helper Status</span>
              <strong>${state.snapshot && state.snapshot.rows.length ? "Snapshot available" : "No snapshot yet"}</strong>
              <p>${state.snapshot && state.snapshot.rows.length ? `Latest helper snapshot has ${escapeHtml(state.snapshot.rows.length)} visible rows captured at ${escapeHtml(state.snapshot.captured_at || "unknown time")}.` : "Install the private Chrome helper, scan CardUploader automatic inventory, then return here."}</p>
            </div>
            <ul class="repricing-safeguard-list">
              <li>Primary workflow targets CardUploader automatic inventory because it is the live eBay-managed surface.</li>
              <li>CardVector.app does not need CardUploader credentials; the signed-in Chrome page provides read-only evidence.</li>
              <li>Approved prices require exact CardUploader identity, current visible price, and operator review.</li>
              <li>Bulk preparation remains local and read-only until the apply workflow is separately characterized and approved.</li>
            </ul>
          </section>
          <section class="operator-side-panel operator-main-panel" aria-labelledby="repricing-plan-title">
            <h2 id="repricing-plan-title">Price Review Candidates</h2>
            ${renderRepricingFloorRuleSummary(state.rows, state.floorConfig)}
            ${renderRepricingBusinessProfile(state.rows, state.businessProfile)}
            ${renderRepricingSummary(state.rows)}
            ${renderRepricingFilters(state.rows, state.filters)}
            ${renderRepricingRows(state.rows, state.filters)}
          </section>
        </section>`;

      const helperStatus = document.getElementById("repricing-helper-status");
      if (helperStatus) {
        helperStatus.addEventListener("click", async () => {
          state.error = "";
          state.snapshot = readStoredCardUploaderHelperSnapshot();
          state.message = state.snapshot && state.snapshot.rows.length
            ? `Helper snapshot found with ${state.snapshot.rows.length} visible rows.`
            : "No helper snapshot found yet. Open CardUploader automatic inventory and run Scan Visible Rows in the Chrome helper.";
          await draw();
        });
      }
      const requestSnapshot = document.getElementById("repricing-request-snapshot");
      if (requestSnapshot) {
        requestSnapshot.addEventListener("click", async () => {
          state.error = "";
          state.message = "";
          state.snapshot = readStoredCardUploaderHelperSnapshot();
          if (!state.snapshot || !state.snapshot.rows.length) {
            state.error = "No helper snapshot is available yet.";
          } else {
            state.rows = applyRepricingFloorRules(repricingRowsFromAutomaticInventorySnapshot(state.snapshot), state.floorConfig, state.businessProfile);
            writeStoredRepricingPlan(state.rows);
            const floorSummary = summarizeRepricingFloorRules(state.rows);
            state.filters = writeStoredRepricingFilterConfig({ ...state.filters, status: floorSummary.raised ? "increase" : "all" });
            state.focusCandidates = true;
            state.message = `Loaded ${state.snapshot.rows.length} helper rows into price review. Floor rules raised ${floorSummary.raised} rows for review.`;
          }
          await draw();
        });
      }
      const saveFloorRules = document.getElementById("repricing-save-floor-rules");
      if (saveFloorRules) {
        saveFloorRules.addEventListener("click", async () => {
          state.error = "";
          state.floorConfig = writeStoredRepricingFloorRuleConfig(readRepricingFloorRuleInputs());
          state.message = "Saved floor rules. Load or reapply a helper snapshot to use the updated floors.";
          await draw();
        });
      }
      const resetFloorRules = document.getElementById("repricing-reset-floor-rules");
      if (resetFloorRules) {
        resetFloorRules.addEventListener("click", async () => {
          state.error = "";
          state.floorConfig = writeStoredRepricingFloorRuleConfig(defaultRepricingFloorRuleConfig);
          state.message = "Reset floor rules to CardVector defaults.";
          await draw();
        });
      }
      const saveBusinessProfile = document.getElementById("repricing-save-business-profile");
      if (saveBusinessProfile) {
        saveBusinessProfile.addEventListener("click", async () => {
          state.error = "";
          state.businessProfile = writeStoredRepricingBusinessProfile(readRepricingBusinessProfileInputs());
          state.message = "Saved business pricing profile. Reapply floor rules to refresh current recommendations.";
          await draw();
        });
      }
      const resetBusinessProfile = document.getElementById("repricing-reset-business-profile");
      if (resetBusinessProfile) {
        resetBusinessProfile.addEventListener("click", async () => {
          state.error = "";
          state.businessProfile = writeStoredRepricingBusinessProfile(defaultRepricingBusinessProfile);
          state.message = "Reset business pricing profile to CardVector defaults.";
          await draw();
        });
      }
      const reapplyFloorRules = document.getElementById("repricing-reapply-floor-rules");
      if (reapplyFloorRules) {
        reapplyFloorRules.addEventListener("click", async () => {
          state.error = "";
          state.floorConfig = writeStoredRepricingFloorRuleConfig(readRepricingFloorRuleInputs());
          state.snapshot = readStoredCardUploaderHelperSnapshot();
          if (!state.snapshot || !state.snapshot.rows.length) {
            state.error = "No helper snapshot is available to reapply.";
          } else {
            state.businessProfile = writeStoredRepricingBusinessProfile(readRepricingBusinessProfileInputs());
            state.rows = applyRepricingFloorRules(repricingRowsFromAutomaticInventorySnapshot(state.snapshot), state.floorConfig, state.businessProfile);
            writeStoredRepricingPlan(state.rows);
            const floorSummary = summarizeRepricingFloorRules(state.rows);
            state.filters = writeStoredRepricingFilterConfig({ ...state.filters, status: floorSummary.raised ? "increase" : "all" });
            state.focusCandidates = true;
            state.message = `Reapplied floor rules to ${state.snapshot.rows.length} helper rows. Floor rules raised ${floorSummary.raised} rows for review.`;
          }
          await draw();
        });
      }
      document.querySelectorAll("[data-repricing-filter]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.filters = writeStoredRepricingFilterConfig({
            ...state.filters,
            status: button.getAttribute("data-repricing-filter") || "all"
          });
          await draw();
        });
      });
      document.querySelectorAll("[data-repricing-filter-field]").forEach((control) => {
        control.addEventListener("change", async () => {
          const field = control.getAttribute("data-repricing-filter-field");
          state.filters = writeStoredRepricingFilterConfig({ ...state.filters, [field]: control.value });
          await draw();
        });
      });
      const filterSearch = document.getElementById("repricing-filter-search");
      if (filterSearch) {
        filterSearch.addEventListener("input", () => {
          state.filters = writeStoredRepricingFilterConfig({ ...state.filters, search: filterSearch.value });
        });
        filterSearch.addEventListener("keydown", async (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            await draw();
          }
        });
        filterSearch.addEventListener("blur", async () => {
          await draw();
        });
      }
      const clearFilters = document.getElementById("repricing-clear-filters");
      if (clearFilters) {
        clearFilters.addEventListener("click", async () => {
          state.filters = writeStoredRepricingFilterConfig(defaultRepricingFilterConfig);
          await draw();
        });
      }
      document.querySelectorAll("[data-repricing-recommend]").forEach((input) => {
        input.addEventListener("change", async () => {
          const id = input.getAttribute("data-repricing-recommend");
          state.rows = state.rows.map((row) => row.id === id ? updateRepricingRecommendation(row, input.value, state.businessProfile) : row);
          writeStoredRepricingPlan(state.rows);
          await draw();
        });
      });
      document.querySelectorAll("[data-repricing-approve]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-repricing-approve");
          state.rows = state.rows.map((row) => row.id === id && canApproveRepricingRow(row)
            ? { ...row, status: "approved", apply_ready: true }
            : row);
          writeStoredRepricingPlan(state.rows);
          await draw();
        });
      });
      document.querySelectorAll("[data-repricing-skip]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-repricing-skip");
          state.rows = state.rows.map((row) => row.id === id ? { ...row, status: "skipped", apply_ready: false } : row);
          writeStoredRepricingPlan(state.rows);
          await draw();
        });
      });
      const applyLive = document.getElementById("repricing-apply-live");
      if (applyLive) {
        applyLive.addEventListener("click", () => {
          const approved = state.rows.filter((row) => row.status === "approved");
          const payload = reviewedRepricingExport(approved);
          const stamp = new Date().toISOString().slice(0, 10);
          downloadTextFile(`carduploader-approved-price-plan-${stamp}.json`, JSON.stringify(payload, null, 2));
        });
      }
      if (state.focusCandidates) {
        state.focusCandidates = false;
        requestAnimationFrame(() => {
          document.getElementById("repricing-plan-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    await draw();
    document.title = "Automatic Inventory Price Review | CardVector";
  }

  async function renderOperatorListingReconciliationView(client, user, importedResult) {
    const batchResult = await loadListingBatchReferences(client, user);
    const ledgerResult = await loadOperatorAllocationLedger(client, user);
    const state = {
      parsed: null,
      fileName: "",
      marketplace: "ebay",
      error: "",
      importResult: null,
      importedRows: importedResult.data || [],
      allocationRows: ledgerResult.data || [],
      batchReferences: batchResult.data || [],
      missingSnapshots: importedResult.missing,
      missingAllocationLedger: ledgerResult.missing,
      missingBatchReferences: batchResult.missing
    };

    async function draw() {
      main.innerHTML = `
        <section class="operator-shell wrap listing-shell" aria-labelledby="listing-reconciliation-title">
          <div class="operator-toolbar">
            <div>
              <p class="eyebrow">CSV snapshot workflow</p>
              <h1 id="listing-reconciliation-title">Existing Listing Review</h1>
              <p>Signed in as ${escapeHtml(authStateLabel(user))}. Import marketplace CSV snapshots, compare listed quantities by SKU, and keep live marketplace edits out of this v1 workflow.</p>
              <p class="operator-note">Egress saver: metadata-only reads are capped and cached for five minutes. Use Refresh from Supabase after imports or when current data matters.</p>
            </div>
            <div class="operator-toolbar-actions">
              <button class="button secondary" id="listing-refresh-supabase" type="button">Refresh from Supabase</button>
              <a class="button secondary" href="/operator">Operator Dashboard</a>
              <a class="button secondary" href="/operator/batches">Batch Workflow</a>
            </div>
          </div>
          ${state.missingSnapshots ? '<div class="operator-warning" role="status">Marketplace listing reconciliation tables are pending migration or not available in Supabase yet.</div>' : ""}
          ${state.missingAllocationLedger ? '<div class="operator-warning" role="status">Marketplace allocation ledger is pending migration or not available in Supabase yet.</div>' : ""}
          ${state.missingBatchReferences ? '<div class="operator-warning" role="status">CardUploader batch references are not available through the authenticated Supabase API. Reconciliation will show eBay-only review until they are available.</div>' : ""}
          <div class="operator-side-panel operator-main-panel">
            <h2>Marketplace Allocation Ledger</h2>
            <p class="operator-note">Read-only oversell-prevention view. eBay and TCGplayer listed quantities are compared against CardUploader inventory snapshot evidence when available.</p>
            ${renderAllocationLedger(state.allocationRows, state.missingAllocationLedger)}
          </div>
          <div class="operator-side-panel operator-main-panel">
            <h2>Location Reconciliation Review</h2>
            <p class="operator-note">Computed read-only from imported marketplace snapshot evidence and CardUploader batch/location references. CardUploader remains inventory truth; marketplaces remain live listing truth.</p>
            ${renderReconciliationBuckets(reconcileListingSnapshots(state.importedRows, state.batchReferences))}
          </div>
          <div class="operator-side-panel operator-main-panel listing-import-panel">
            <h2>Import Marketplace Snapshot CSV</h2>
            <p class="operator-note">Snapshot only. This page does not update CardUploader inventory or revise, end, publish, sync, or otherwise change live marketplace listings.</p>
            <label class="listing-marketplace-select">
              <span>Snapshot Type</span>
              <select id="listing-marketplace">
                <option value="ebay"${state.marketplace === "ebay" ? " selected" : ""}>eBay active listings</option>
                <option value="tcgplayer"${state.marketplace === "tcgplayer" ? " selected" : ""}>TCGplayer / TCGTracking inventory</option>
                <option value="carduploader_inventory"${state.marketplace === "carduploader_inventory" ? " selected" : ""}>CardUploader inventory snapshot</option>
              </select>
            </label>
            <label class="listing-file-drop">
              <span>Choose ${escapeHtml(state.marketplace === "carduploader_inventory" ? "CardUploader inventory" : marketplaceListingConfigs[state.marketplace].label)} CSV</span>
              <input id="listing-csv-file" type="file" accept=".csv,text/csv">
            </label>
            ${state.fileName ? `<p class="operator-note">Selected: ${escapeHtml(state.fileName)}</p>` : ""}
            ${state.error ? `<p class="entry-message error">${escapeHtml(state.error)}</p>` : ""}
            ${state.parsed ? renderListingSummary(state.parsed.summary) : ""}
            ${state.parsed && state.parsed.errors.length ? `<div class="operator-warning">${state.parsed.errors.map(escapeHtml).join(" ")}</div>` : ""}
            <div class="entry-actions">
              <button class="button primary" id="listing-import-snapshot" type="button"${state.parsed && state.parsed.records.length && !state.parsed.errors.length ? "" : " disabled"}>Import Snapshot</button>
            </div>
            ${state.importResult && state.importResult.importedInventoryRows ? `<p class="entry-ready">Imported ${state.importResult.importedInventoryRows} CardUploader inventory rows. Skipped ${state.importResult.skippedRows} rows without SKU evidence.${state.importResult.deduplicatedRows ? ` Skipped ${state.importResult.deduplicatedRows} duplicate snapshot identities.` : ""}</p>` : ""}
            ${state.importResult && state.importResult.importedListings ? `<p class="entry-ready">Imported ${state.importResult.importedListings} listings and ${state.importResult.importedMatches} reconciliation rows. Skipped ${state.importResult.skippedRows} rows without marketplace identities.</p>` : ""}
          </div>
          <div class="registry-layout listing-layout">
            <section class="operator-side-panel operator-main-panel" aria-labelledby="listing-preview-title">
              <h2 id="listing-preview-title">Current CSV Review</h2>
              ${renderCurrentSnapshotRows(state.parsed)}
            </section>
            <aside class="operator-side-panel" aria-labelledby="listing-imported-title">
              <h2 id="listing-imported-title">Recent Snapshots</h2>
              ${renderImportedListingRows(state.importedRows)}
            </aside>
          </div>
        </section>`;

      const fileInput = document.getElementById("listing-csv-file");
      const marketplaceSelect = document.getElementById("listing-marketplace");
      if (marketplaceSelect) {
        marketplaceSelect.addEventListener("change", async (event) => {
          state.marketplace = event.target.value || "ebay";
          state.parsed = null;
          state.fileName = "";
          state.importResult = null;
          state.error = "";
          await draw();
        });
      }
      if (fileInput) {
        fileInput.addEventListener("change", async (event) => {
          const file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }
          try {
            const buffer = await file.arrayBuffer();
            const text = new TextDecoder("utf-8").decode(buffer);
            const sha256 = await sha256Hex(buffer);
            state.fileName = file.name;
            state.error = "";
            state.importResult = null;
            state.parsed = state.marketplace === "carduploader_inventory"
              ? parseCardUploaderInventoryCsv(text, { name: file.name, sha256 })
              : parseMarketplaceListingsCsv(text, { name: file.name, sha256 }, state.marketplace);
          } catch (error) {
            state.error = error.message || String(error);
          }
          await draw();
        });
      }
      const importButton = document.getElementById("listing-import-snapshot");
      if (importButton) {
        importButton.addEventListener("click", async () => {
          try {
            importButton.disabled = true;
            importButton.textContent = "Importing...";
            state.importResult = state.marketplace === "carduploader_inventory"
              ? await importInventoryQuantitySnapshot(client, user, state.parsed)
              : await importListingSnapshot(client, user, state.parsed);
            const refreshed = await loadOperatorListingSnapshots(client, user, { forceRefresh: true });
            state.importedRows = refreshed.data || [];
            state.missingSnapshots = refreshed.missing;
            const refreshedLedger = await loadOperatorAllocationLedger(client, user, { forceRefresh: true });
            state.allocationRows = refreshedLedger.data || [];
            state.missingAllocationLedger = refreshedLedger.missing;
            const refreshedBatches = await loadListingBatchReferences(client, user, { forceRefresh: true });
            state.batchReferences = refreshedBatches.data || [];
            state.missingBatchReferences = refreshedBatches.missing;
            state.error = "";
          } catch (error) {
            const importLabel = state.marketplace === "carduploader_inventory"
              ? "Import CardUploader inventory snapshot"
              : "Import marketplace listing snapshot";
            state.error = supabaseErrorDetails(importLabel, error, user);
          }
          await draw();
        });
      }
      const refreshButton = document.getElementById("listing-refresh-supabase");
      if (refreshButton) {
        refreshButton.addEventListener("click", async () => {
          refreshButton.disabled = true;
          refreshButton.textContent = "Refreshing...";
          try {
            const refreshed = await loadOperatorListingSnapshots(client, user, { forceRefresh: true });
            state.importedRows = refreshed.data || [];
            state.missingSnapshots = refreshed.missing;
            const refreshedLedger = await loadOperatorAllocationLedger(client, user, { forceRefresh: true });
            state.allocationRows = refreshedLedger.data || [];
            state.missingAllocationLedger = refreshedLedger.missing;
            const refreshedBatches = await loadListingBatchReferences(client, user, { forceRefresh: true });
            state.batchReferences = refreshedBatches.data || [];
            state.missingBatchReferences = refreshedBatches.missing;
            state.error = "";
          } catch (error) {
            state.error = supabaseErrorDetails("Refresh listing reconciliation", error, user);
          }
          await draw();
        });
      }
    }

    await draw();
    document.title = "Existing Listing Review | CardVector";
  }

  async function renderOperatorListingReconciliation() {
    main.innerHTML = `
      <section class="operator-shell wrap" aria-labelledby="listing-reconciliation-title">
        <div class="operator-toolbar">
          <div>
            <p class="eyebrow">CardVector operator</p>
            <h1 id="listing-reconciliation-title">Existing Listing Review</h1>
            <p>Sign in to import marketplace CSV snapshots for reconciliation review.</p>
          </div>
          <a class="button secondary" href="/operator">Operator Dashboard</a>
        </div>
        <div class="capture-operator" id="operator-listings-user" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth operator-auth" id="operator-listings-auth"></div>
        <div id="operator-listings-status" class="operator-loading">Waiting for sign-in.</div>
      </section>`;
    document.title = "Existing Listing Review | CardVector";
    const client = configuredSupabase();
    const status = document.getElementById("operator-listings-status");
    if (!client) {
      if (status) {
        status.textContent = "Supabase is not configured for this deployment.";
      }
      return;
    }
    await ensureAuth(client, {
      authId: "operator-listings-auth",
      operatorId: "operator-listings-user",
      idPrefix: "operator-listings",
      onAuthenticated: async (user) => {
        if (status) {
          status.textContent = "Loading marketplace listing reconciliation...";
        }
        try {
          const imported = await loadOperatorListingSnapshots(client, user);
          await renderOperatorListingReconciliationView(client, user, imported);
        } catch (error) {
          if (status) {
            status.innerHTML = `<span class="entry-message error">${escapeHtml(error.message || error)}</span>`;
          }
        }
      }
    });
  }

  function renderOperatorRegistryView(registry, user, onRefresh) {
    const etbs = registry.locations.filter((location) => location.location_type === "etb");
    const slots = registry.locations.filter((location) => location.location_type === "slot");
    const slotsByParent = new Map();
    slots.forEach((slot) => {
      const key = slot.parent_location_id || "";
      if (!slotsByParent.has(key)) {
        slotsByParent.set(key, []);
      }
      slotsByParent.get(key).push(slot);
    });
    const sessionsByLocation = new Map();
    registry.sessions.forEach((session) => {
      [session.location_id, captureSessionLocationKey(session)].filter(Boolean).forEach((key) => {
        if (!sessionsByLocation.has(key)) {
          sessionsByLocation.set(key, []);
        }
        sessionsByLocation.get(key).push(session);
      });
    });
    const batchesByLocation = new Map();
    registry.batches.forEach((batch) => {
      [batch.location_id, batch.location_display_code, batch.canonical_location_display_code].filter(Boolean).forEach((key) => {
        if (!batchesByLocation.has(key)) {
          batchesByLocation.set(key, []);
        }
        batchesByLocation.get(key).push(batch);
      });
    });
    const registryCards = etbs.length
      ? etbs.map((etb) => renderEtbCard(etb, slotsByParent.get(etb.id) || [], sessionsByLocation, batchesByLocation)).join("")
      : '<p class="operator-empty">No canonical ETBs are available yet.</p>';
    main.innerHTML = `
      <section class="operator-shell wrap registry-shell" aria-labelledby="registry-title">
        <div class="operator-toolbar">
          <div>
            <p class="eyebrow">Supabase-backed registry</p>
            <h1 id="registry-title">ETB / Location Registry</h1>
            <p>Signed in as ${escapeHtml(authStateLabel(user))}. This view reads the shared canonical registry used by CardVector.app and CardVector OS.</p>
            <p class="operator-note">Egress saver: registry data is metadata-only, capped, and cached for five minutes. Source: ${escapeHtml(cacheFreshnessLabel(registry.cache && registry.cache.cached ? registry.cache.cachedAt : ""))}.</p>
          </div>
          <div class="operator-toolbar-actions">
            <button class="button secondary" id="registry-refresh-supabase" type="button">Refresh from Supabase</button>
            <a class="button secondary" href="/operator">Operator Dashboard</a>
            <a class="button primary" href="https://carduploader.com/dashboard/history" target="_blank" rel="noopener noreferrer">Open CardUploader Batches</a>
          </div>
        </div>
        ${registryWarningHtml(registry)}
        <div class="registry-summary">
          <div><span>ETBs</span><strong>${etbs.length}</strong></div>
          <div><span>Locations</span><strong>${slots.length}</strong></div>
          <div><span>Recent Captures</span><strong>${registry.sessions.length}</strong></div>
          <div><span>Batch References</span><strong>${registry.batches.length}</strong></div>
        </div>
        <div class="registry-layout">
          <div class="registry-list">${registryCards}</div>
          <aside class="operator-side-panel" aria-labelledby="recent-captures-title">
            <h2 id="recent-captures-title">Recent Capture Sessions</h2>
            ${renderRecentSessions(registry.sessions)}
          </aside>
        </div>
      </section>`;
    const refreshButton = document.getElementById("registry-refresh-supabase");
    if (refreshButton && typeof onRefresh === "function") {
      refreshButton.addEventListener("click", async () => {
        refreshButton.disabled = true;
        refreshButton.textContent = "Refreshing...";
        await onRefresh();
      });
    }
    document.title = "ETB Location Registry | CardVector";
  }

  async function renderOperatorRegistry() {
    main.innerHTML = `
      <section class="operator-shell wrap" aria-labelledby="registry-title">
        <div class="operator-toolbar">
          <div>
            <p class="eyebrow">CardVector operator</p>
            <h1 id="registry-title">ETB / Location Registry</h1>
            <p>Sign in to load synchronized Supabase ETBs, slots, capture sessions, and CardUploader batch references.</p>
          </div>
          <a class="button secondary" href="/operator">Operator Dashboard</a>
        </div>
        <div class="capture-operator" id="operator-registry-user" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth operator-auth" id="operator-registry-auth"></div>
        <div id="operator-registry-status" class="operator-loading">Waiting for sign-in.</div>
      </section>`;
    document.title = "ETB Location Registry | CardVector";
    const client = configuredSupabase();
    const status = document.getElementById("operator-registry-status");
    if (!client) {
      if (status) {
        status.textContent = "Supabase is not configured for this deployment.";
      }
      return;
    }
    await ensureAuth(client, {
      authId: "operator-registry-auth",
      operatorId: "operator-registry-user",
      idPrefix: "operator-registry",
      onAuthenticated: async (user) => {
        if (status) {
          status.textContent = "Loading synchronized registry...";
        }
        try {
          const refreshRegistryFromSupabase = async () => {
            const refreshed = await loadOperatorRegistry(client, user, { forceRefresh: true });
            renderOperatorRegistryView(refreshed, user, refreshRegistryFromSupabase);
          };
          const registry = await loadOperatorRegistry(client, user);
          renderOperatorRegistryView(registry, user, refreshRegistryFromSupabase);
        } catch (error) {
          if (status) {
            status.innerHTML = `<span class="entry-message error">${escapeHtml(error.message || error)}</span>`;
          }
        }
      }
    });
  }

  async function renderOperatorBatchWorkflow() {
    main.innerHTML = `
      <section class="operator-shell wrap" aria-labelledby="batch-workflow-title">
        <div class="operator-toolbar">
          <div>
            <p class="eyebrow">CardVector operator</p>
            <h1 id="batch-workflow-title">Batch Workflow</h1>
            <p>Sign in to load synchronized CardUploader batch references, ETB locations, and capture handoff state.</p>
          </div>
          <a class="button secondary" href="/operator">Operator Dashboard</a>
        </div>
        <div class="capture-operator" id="operator-batches-user" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth operator-auth" id="operator-batches-auth"></div>
        <div id="operator-batches-status" class="operator-loading">Waiting for sign-in.</div>
      </section>`;
    document.title = "Batch Workflow | CardVector";
    const client = configuredSupabase();
    const status = document.getElementById("operator-batches-status");
    if (!client) {
      if (status) {
        status.textContent = "Supabase is not configured for this deployment.";
      }
      return;
    }
    await ensureAuth(client, {
      authId: "operator-batches-auth",
      operatorId: "operator-batches-user",
      idPrefix: "operator-batches",
      onAuthenticated: async (user) => {
        if (status) {
          status.textContent = "Loading batch workflow...";
        }
        try {
          const registry = await loadOperatorRegistry(client, user);
          renderOperatorBatchWorkflowView(registry, user);
        } catch (error) {
          if (status) {
            status.innerHTML = `<span class="entry-message error">${escapeHtml(error.message || error)}</span>`;
          }
        }
      }
    });
  }

  async function createCloudNextLocation(client, user, etbId, expectedCode) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
    const expected = mobileCore.normalizeLocationCode(expectedCode);
    try {
      const canonicalResult = await client.rpc("cardvector_create_next_etb_slot", {
        p_etb_display_code: canonicalEtb,
        p_expected_slot_code: expected
      });
      if (canonicalResult.error) {
        throw canonicalResult.error;
      }
      const canonicalRow = Array.isArray(canonicalResult.data) ? canonicalResult.data[0] : canonicalResult.data;
      if (!canonicalRow || canonicalRow.location_id !== mobileCore.canonicalLocationId(canonicalEtb, canonicalRow.location_code)) {
        throw new Error("Canonical location creation returned an invalid location.");
      }
      return {
        canonical_location_uuid: canonicalRow.id,
        location_id: canonicalRow.location_id,
        etb_id: canonicalRow.etb_id,
        location_code: canonicalRow.location_code,
        status: canonicalRow.status,
        capacity: canonicalRow.capacity,
        stored_count: canonicalRow.stored_count,
        updated_at: canonicalRow.updated_at
      };
    } catch (error) {
      if (!isMissingCanonicalRegistry(error)) {
        throw new Error(supabaseErrorDetails("Create canonical next location", error, user));
      }
    }
    const result = await client.rpc("cardvector_create_next_location", {
      p_etb_id: canonicalEtb,
      p_expected_location_code: expected
    });
    if (result.error) {
      throw new Error(supabaseErrorDetails("Create next location", result.error, user));
    }
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row || row.location_id !== mobileCore.canonicalLocationId(canonicalEtb, row.location_code)) {
      throw new Error("Location creation returned an invalid canonical location.");
    }
    return row;
  }

  function localDraftSessionsForUser(userId) {
    const drafts = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("cardvector.mobileCapture.")) {
        continue;
      }
      try {
        const session = JSON.parse(localStorage.getItem(key) || "null");
        if (!session || session.status !== "DRAFT" || session.operator_id !== userId) {
          continue;
        }
        const match = String(session.etb_location || "").match(/^(ETB-[0-9]{3})-([A-J])$/);
        if (!match) {
          continue;
        }
        drafts.push({ key, session, etbId: match[1], location: match[2] });
      } catch (_exc) {
        // Corrupt local state is ignored; IndexedDB content is not deleted.
      }
    }
    return drafts.sort((left, right) => String(right.session.created_at || "").localeCompare(String(left.session.created_at || "")));
  }

  async function renderRecentDraft(user) {
    const target = document.getElementById("mobile-draft-resume");
    if (!target || !user) {
      return;
    }
    const draft = localDraftSessionsForUser(user.id)[0];
    if (!draft) {
      target.innerHTML = "";
      return;
    }
    const images = await loadDraftImages(draft.session.capture_session_id);
    if (!images.length) {
      target.innerHTML = "";
      return;
    }
    const type = normalizeCaptureType(draft.session.capture_type);
    const layout = normalizeCaptureLayout(
      draft.session.capture_layout
      || (draft.session.device && draft.session.device.capture_layout)
    );
    target.innerHTML = `
      <aside class="draft-resume">
        <div>
          <strong>Unfinished Draft</strong>
          <span>${escapeHtml(draft.session.etb_location)} · ${images.length} image${images.length === 1 ? "" : "s"}</span>
        </div>
        <div class="entry-actions">
          <a class="button primary" href="${captureRoute(draft.etbId, draft.location, type, layout)}">Resume Draft</a>
          <button class="button secondary" id="discard-mobile-draft" type="button">Discard Draft</button>
        </div>
      </aside>`;
    document.getElementById("discard-mobile-draft").addEventListener("click", async () => {
      if (!window.confirm("Discard this unfinished draft and its local images?")) {
        return;
      }
      await clearDraftImages(draft.session.capture_session_id);
      localStorage.removeItem(draft.key);
      await renderRecentDraft(user);
    });
  }

  async function initializeCaptureEntry(options = {}) {
    const target = document.getElementById("mobile-entry-body");
    const client = configuredSupabase();
    if (!target || !client) {
      if (target) {
        target.innerHTML = '<p class="entry-message error">Mobile capture backend is not configured.</p>';
      }
      return;
    }

    const fixedEtb = options.fixedEtb ? mobileCore.normalizeEtbId(options.fixedEtb) : "";
    const state = {
      captureType: "",
      captureLayout: "",
      etbId: fixedEtb,
      location: "",
      etbs: [],
      locations: [],
      user: null,
      landing: Boolean(options.landing && fixedEtb),
      createAfterType: false,
      viewOnly: false
    };

    function showError(error) {
      target.innerHTML = `${entrySummaryHtml(state)}<p class="entry-message error">${escapeHtml(error.message || error)}</p>`;
    }

    function bind(selector, handler) {
      const element = target.querySelector(selector);
      if (element) {
        element.addEventListener("click", handler);
      }
    }

    function bindChange(selector, handler) {
      const element = target.querySelector(selector);
      if (element) {
        element.addEventListener("change", handler);
      }
    }

    async function refreshLocations() {
      state.locations = await listCloudLocations(client, state.user, state.etbId);
      return state.locations;
    }

    function renderMobileCaptureForm(message = "") {
      const typeOptions = Object.entries(captureTypeConfig).map(([value, config]) => (
        `<option value="${escapeHtml(value)}"${state.captureType === value ? " selected" : ""}>${escapeHtml(config.label)}</option>`
      )).join("");
      const etbOptions = state.etbs.map((etb) => (
        `<option value="${escapeHtml(etb.etb_id)}"${state.etbId === etb.etb_id ? " selected" : ""}>${escapeHtml(etb.etb_id)}${etb.status ? ` (${escapeHtml(etb.status)})` : ""}</option>`
      )).join("");
      const locationOptions = state.locations.map((location) => {
        const label = `Location ${location.location_code} (${locationStoredLabel(location)}, ${location.status || "Empty"})`;
        return `<option value="${escapeHtml(location.location_code)}"${state.location === location.location_code ? " selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");
      const layoutOptions = Object.entries(captureLayoutConfig).map(([value, config]) => (
        `<option value="${escapeHtml(value)}"${state.captureLayout === value ? " selected" : ""}>${escapeHtml(config.label)}</option>`
      )).join("");
      const nextCode = state.etbId ? mobileCore.nextAvailableLocationCode(state.locations) : "";
      const ready = state.captureType && state.etbId && state.location && state.captureLayout;
      const readyLine = ready
        ? `<p class="entry-ready">Ready for ${escapeHtml(captureTypeConfig[state.captureType].shortLabel)} at ${escapeHtml(mobileCore.canonicalLocationId(state.etbId, state.location))}.</p>`
        : "";
      target.innerHTML = `
        <form class="entry-form" id="mobile-capture-entry-form">
          <label class="entry-field" for="mobile-capture-type">
            <span>Capture type</span>
            <select id="mobile-capture-type" name="capture_type">
              <option value="">Choose capture type</option>
              ${typeOptions}
            </select>
          </label>
          <label class="entry-field" for="mobile-capture-etb">
            <span>ETB</span>
            <select id="mobile-capture-etb" name="etb_id"${state.etbs.length ? "" : " disabled"}>
              <option value="">Choose ETB</option>
              ${etbOptions}
            </select>
          </label>
          <label class="entry-field" for="mobile-capture-location">
            <span>Location</span>
            <select id="mobile-capture-location" name="location_code"${state.etbId && state.locations.length ? "" : " disabled"}>
              <option value="">${state.etbId ? "Choose location" : "Choose ETB first"}</option>
              ${locationOptions}
            </select>
          </label>
          <label class="entry-field" for="mobile-capture-layout">
            <span>Photo mode</span>
            <select id="mobile-capture-layout" name="capture_layout">
              <option value="">Choose photo mode</option>
              ${layoutOptions}
            </select>
          </label>
          ${state.etbs.length ? "" : '<p class="entry-message">No synchronized ETBs are available. Run desktop location sync after applying the migration.</p>'}
          ${message ? `<p class="entry-message">${escapeHtml(message)}</p>` : ""}
          ${!state.etbId || state.locations.length || !nextCode ? "" : '<p class="entry-message">No locations have been provisioned for this ETB yet.</p>'}
          <div class="entry-actions">
            <button class="button primary" id="entry-start-capture" type="submit"${ready ? "" : " disabled"}>Start Capture</button>
            ${state.etbId && nextCode ? '<button class="button secondary" id="entry-create-location" type="button">Create Next Location</button>' : ""}
          </div>
          ${readyLine}
        </form>`;
      bindChange("#mobile-capture-type", (event) => {
        state.captureType = event.target.value ? normalizeCaptureType(event.target.value) : "";
        renderMobileCaptureForm();
      });
      bindChange("#mobile-capture-etb", async (event) => {
        state.etbId = event.target.value ? mobileCore.normalizeEtbId(event.target.value) : "";
        state.location = "";
        try {
          state.locations = state.etbId ? await listCloudLocations(client, state.user, state.etbId) : [];
          renderMobileCaptureForm();
        } catch (error) {
          showError(error);
        }
      });
      bindChange("#mobile-capture-location", (event) => {
        state.location = event.target.value ? mobileCore.normalizeLocationCode(event.target.value) : "";
        renderMobileCaptureForm();
      });
      bindChange("#mobile-capture-layout", (event) => {
        state.captureLayout = event.target.value ? normalizeCaptureLayout(event.target.value) : "";
        renderMobileCaptureForm();
      });
      bind("#entry-create-location", async (event) => {
        event.currentTarget.disabled = true;
        try {
          const created = await createCloudNextLocation(client, state.user, state.etbId, nextCode);
          await refreshLocations();
          state.location = mobileCore.normalizeLocationCode(created.location_code);
          renderMobileCaptureForm(`Created ${mobileCore.canonicalLocationId(state.etbId, state.location)}.`);
        } catch (error) {
          showError(error);
        }
      });
      const form = target.querySelector("#mobile-capture-entry-form");
      if (form) {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          if (ready) {
            window.location.assign(captureRoute(state.etbId, state.location, state.captureType, state.captureLayout));
          }
        });
      }
    }

    function renderTypeSelection(backTarget = "") {
      state.location = "";
      state.captureLayout = "";
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Choose Capture Type</h3>
        <div class="entry-grid">
          <button class="entry-card" data-capture-type="NEW_CAPTURE" type="button"><strong>New Inventory Capture</strong><span>Capture newly acquired cards.</span></button>
          <button class="entry-card" data-capture-type="PHYSICAL_INVENTORY" type="button"><strong>Physical Inventory Conversion</strong><span>Convert cards already stored in this location.</span></button>
        </div>
        ${backTarget ? '<button class="entry-back" id="entry-back" type="button">Back</button>' : ""}`;
      target.querySelectorAll("[data-capture-type]").forEach((button) => {
        button.addEventListener("click", async () => {
          state.captureType = normalizeCaptureType(button.dataset.captureType);
          try {
            if (state.etbId) {
              await refreshLocations();
              if (state.createAfterType) {
                renderCreateProposal();
              } else {
                renderLocationSelection();
              }
            } else {
              renderEtbSelection();
            }
          } catch (error) {
            showError(error);
          }
        });
      });
      bind("#entry-back", () => {
        if (backTarget === "landing") {
          renderEtbLanding();
        } else if (backTarget === "etbs") {
          renderEtbSelection();
        }
      });
    }

    function renderEtbSelection() {
      state.etbId = "";
      state.location = "";
      const cards = state.etbs.map((etb) => `
        <button class="entry-card" data-etb-id="${escapeHtml(etb.etb_id)}" type="button">
          <strong>${escapeHtml(etb.etb_id)}</strong>
          <span>${escapeHtml(etb.status || "Empty")}</span>
        </button>`).join("");
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Choose ETB</h3>
        ${cards ? `<div class="entry-grid">${cards}</div>` : '<p class="entry-message">No synchronized ETBs are available. Run desktop location sync after applying the migration.</p>'}
        <button class="entry-back" id="entry-back" type="button">Back</button>`;
      target.querySelectorAll("[data-etb-id]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            state.etbId = mobileCore.normalizeEtbId(button.dataset.etbId);
            await refreshLocations();
            renderLocationSelection();
          } catch (error) {
            showError(error);
          }
        });
      });
      bind("#entry-back", () => renderTypeSelection());
    }

    function renderLocationSelection() {
      state.location = "";
      const cards = state.locations.map((location) => {
        const occupancy = locationStoredLabel(location);
        if (state.viewOnly) {
          return `<article class="entry-card static"><strong>Location ${escapeHtml(location.location_code)}</strong><span>${escapeHtml(occupancy)} · ${escapeHtml(location.status || "Empty")}</span></article>`;
        }
        return `<button class="entry-card" data-location-code="${escapeHtml(location.location_code)}" type="button"><strong>Location ${escapeHtml(location.location_code)}</strong><span>${escapeHtml(occupancy)} · ${escapeHtml(location.status || "Empty")}</span></button>`;
      }).join("");
      const nextCode = mobileCore.nextAvailableLocationCode(state.locations);
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>${state.viewOnly ? "Locations" : "Choose Location"}</h3>
        ${cards ? `<div class="entry-grid location-grid">${cards}</div>` : '<p class="entry-message">No locations have been provisioned for this ETB.</p>'}
        ${!state.viewOnly && nextCode ? '<button class="button secondary entry-wide-action" id="entry-create-location" type="button">Create Next Location</button>' : ""}
        ${!state.viewOnly && !nextCode ? '<p class="entry-message warning">All valid locations A-J are already provisioned.</p>' : ""}
        <button class="entry-back" id="entry-back" type="button">Back</button>`;
      target.querySelectorAll("[data-location-code]").forEach((button) => {
        button.addEventListener("click", () => {
          state.location = mobileCore.normalizeLocationCode(button.dataset.locationCode);
          renderReview();
        });
      });
      bind("#entry-create-location", renderCreateProposal);
      bind("#entry-back", () => {
        state.viewOnly = false;
        if (fixedEtb) {
          renderEtbLanding();
        } else {
          renderEtbSelection();
        }
      });
    }

    function renderCreateProposal() {
      const nextCode = mobileCore.nextAvailableLocationCode(state.locations);
      if (!nextCode) {
        target.innerHTML = `${entrySummaryHtml(state)}<p class="entry-message warning">No valid location remains. This ETB already has locations A-J.</p><button class="entry-back" id="entry-back" type="button">Back</button>`;
        bind("#entry-back", renderLocationSelection);
        return;
      }
      const proposedId = mobileCore.canonicalLocationId(state.etbId, nextCode);
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Create New Location</h3>
        <div class="location-proposal"><span>Next available location</span><strong>${escapeHtml(proposedId)}</strong></div>
        <p class="entry-message">Confirm to create this canonical location. Existing locations will not be overwritten.</p>
        <div class="entry-actions">
          <button class="button primary" id="entry-confirm-create" type="button">Confirm Create Location</button>
          <button class="button secondary" id="entry-back" type="button">Back</button>
        </div>`;
      bind("#entry-confirm-create", async (event) => {
        event.currentTarget.disabled = true;
        try {
          const created = await createCloudNextLocation(client, state.user, state.etbId, nextCode);
          await refreshLocations();
          state.location = mobileCore.normalizeLocationCode(created.location_code);
          renderReview();
        } catch (error) {
          showError(error);
        }
      });
      bind("#entry-back", renderLocationSelection);
    }

    function renderReview() {
      const type = captureTypeConfig[normalizeCaptureType(state.captureType)];
      const canonicalId = mobileCore.canonicalLocationId(state.etbId, state.location);
      const layoutCards = Object.entries(captureLayoutConfig).map(([layout, config]) => `
        <button class="entry-card${state.captureLayout === layout ? " selected" : ""}" data-capture-layout="${layout}" type="button">
          <strong>${escapeHtml(config.label)}</strong>
          <span>${escapeHtml(config.description)}</span>
        </button>`).join("");
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Review Destination</h3>
        <div class="location-proposal"><span>${escapeHtml(type.label)}</span><strong>${escapeHtml(canonicalId)}</strong></div>
        <h3>Choose Photo Mode</h3>
        <div class="entry-grid">${layoutCards}</div>
        <div class="entry-actions">
          <button class="button primary" id="entry-start-capture" type="button"${state.captureLayout ? "" : " disabled"}>Start Capture</button>
          <button class="button secondary" id="entry-back" type="button">Back</button>
        </div>`;
      target.querySelectorAll("[data-capture-layout]").forEach((button) => {
        button.addEventListener("click", () => {
          state.captureLayout = normalizeCaptureLayout(button.dataset.captureLayout);
          renderReview();
        });
      });
      bind("#entry-start-capture", () => {
        if (state.captureLayout) {
          window.location.assign(captureRoute(state.etbId, state.location, state.captureType, state.captureLayout));
        }
      });
      bind("#entry-back", renderLocationSelection);
    }

    function renderEtbLanding() {
      state.captureType = "";
      state.captureLayout = "";
      state.location = "";
      state.createAfterType = false;
      state.viewOnly = false;
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Choose Action</h3>
        <div class="entry-grid">
          <button class="entry-card" data-etb-action="NEW_CAPTURE" type="button"><strong>New Inventory Capture</strong><span>Select or create a location.</span></button>
          <button class="entry-card" data-etb-action="PHYSICAL_INVENTORY" type="button"><strong>Physical Inventory Conversion</strong><span>Select or create a location.</span></button>
          <button class="entry-card" data-etb-action="view" type="button"><strong>View Locations</strong><span>Review synchronized A-J locations.</span></button>
          <button class="entry-card" data-etb-action="create" type="button"><strong>Create New Location</strong><span>Choose capture type, then confirm the next location.</span></button>
        </div>`;
      target.querySelectorAll("[data-etb-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const action = button.dataset.etbAction;
            if (action === "view") {
              state.viewOnly = true;
              await refreshLocations();
              renderLocationSelection();
              return;
            }
            if (action === "create") {
              state.createAfterType = true;
              renderTypeSelection("landing");
              return;
            }
            state.captureType = normalizeCaptureType(action);
            await refreshLocations();
            renderLocationSelection();
          } catch (error) {
            showError(error);
          }
        });
      });
    }

    await ensureAuth(client, {
      authId: "mobile-entry-auth",
      operatorId: "mobile-entry-operator",
      idPrefix: "mobile-entry",
      onAuthenticated: async (user) => {
        try {
          state.user = user;
          await requireLocationAuthorization(client, user);
          state.etbs = await listCloudEtbs(client, user);
          if (fixedEtb && !state.etbs.some((item) => item.etb_id === fixedEtb)) {
            throw new Error(`${fixedEtb} is not synchronized to CardVector Cloud yet. Run desktop location sync.`);
          }
          await renderRecentDraft(user);
          if (state.landing) {
            renderEtbLanding();
          } else {
            renderMobileCaptureForm();
          }
        } catch (error) {
          showError(error);
        }
      }
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function setCaptureStatus(value) {
    const status = captureStatuses.has(value) ? value : "DRAFT";
    setText("capture-status", status);
  }

  function setProgress(value, text) {
    const progress = document.getElementById("capture-progress");
    if (progress) {
      progress.value = Math.max(0, Math.min(100, Number(value) || 0));
    }
    setText("capture-progress-text", text);
  }

  async function renderThumbnails(session) {
    const target = document.getElementById("capture-thumbs");
    if (!target || !session) {
      return;
    }
    const images = await loadDraftImages(session.capture_session_id);
    try {
      JSON.parse(target.dataset.objectUrls || "[]").forEach((url) => URL.revokeObjectURL(url));
    } catch (_exc) {
      // A stale cache hint must never block thumbnail recovery.
    }
    const urls = [];
    target.innerHTML = "";
    orderedCaptureImages(images, session.capture_layout).forEach((image, index) => {
      const position = imageCapturePosition(image, index, session.capture_layout);
      const url = URL.createObjectURL(image.file);
      urls.push(url);
      const item = document.createElement("figure");
      item.className = "capture-thumb";
      item.innerHTML = `
        <img src="${url}" alt="Card ${position.cardNumber} ${position.side}">
        <figcaption>
          <span>Card ${position.cardNumber} ${position.side === "front" ? "Front" : "Back"}</span>
          <button type="button" data-remove-image="${escapeHtml(image.id)}" aria-label="Remove card ${position.cardNumber} ${position.side}">Remove</button>
        </figcaption>`;
      const imageElement = item.querySelector("img");
      const releaseUrl = () => URL.revokeObjectURL(url);
      imageElement.addEventListener("load", releaseUrl, { once: true });
      imageElement.addEventListener("error", releaseUrl, { once: true });
      target.appendChild(item);
    });
    target.dataset.objectUrls = JSON.stringify(urls);
    target.querySelectorAll("[data-remove-image]").forEach((button) => {
      button.addEventListener("click", async () => {
        await removeDraftImage(button.getAttribute("data-remove-image"));
        session.image_count = (await loadDraftImages(session.capture_session_id)).length;
        const parts = session.etb_location.split("-");
        saveStoredSession(parts.slice(0, 2).join("-"), parts[2], session);
        updateCaptureSummary(session);
        renderThumbnails(session);
      });
    });
    setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 5000);
  }

  function updateCaptureSummary(session) {
    if (!session) {
      setText("capture-session-id", "Not started");
      setText("capture-image-count", "0");
      setCaptureStatus("DRAFT");
      return;
    }
    setText("capture-session-id", session.capture_session_id);
    setText("capture-image-count", String(session.image_count || 0));
    loadDraftImages(session.capture_session_id).then((images) => {
      const next = nextCapturePosition(images, session.capture_layout);
      setText("capture-next-photo", `Card ${next.cardNumber} ${next.side === "front" ? "Front" : "Back"}`);
    }).catch(() => setText("capture-next-photo", "Unavailable"));
    setCaptureStatus(session.status);
  }

  async function ensureAuth(client, options = {}) {
    const authId = options.authId || "capture-auth";
    const operatorId = options.operatorId || "capture-operator";
    const idPrefix = options.idPrefix || "capture";
    const onAuthenticated = typeof options.onAuthenticated === "function" ? options.onAuthenticated : null;
    const auth = document.getElementById(authId);
    if (!client || !auth) {
      return null;
    }
    const current = await client.auth.getSession();
    if (current.data && current.data.session) {
      auth.innerHTML = `<span class="capture-auth-state">Signed in</span>`;
      setText(operatorId, `Operator: ${authStateLabel(current.data.session.user)}`);
      if (onAuthenticated) {
        await onAuthenticated(current.data.session.user);
      }
      return current.data.session.user;
    }
    const emailId = `${idPrefix}-email`;
    const passwordId = `${idPrefix}-password`;
    const signInId = `${idPrefix}-sign-in`;
    const stateId = `${idPrefix}-auth-state`;
    auth.innerHTML = `
      <label>Email <input id="${emailId}" type="email" autocomplete="email" placeholder="operator@example.com"></label>
      <label>Password <input id="${passwordId}" type="password" autocomplete="current-password" placeholder="Password"></label>
      <button class="button secondary" id="${signInId}" type="button">Sign In</button>
      <span class="capture-auth-state" id="${stateId}">Sign in to continue.</span>`;
    document.getElementById(signInId).addEventListener("click", async () => {
      const email = document.getElementById(emailId).value.trim();
      const password = document.getElementById(passwordId).value;
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        setText(stateId, supabaseErrorDetails("Sign in", result.error, null));
        return;
      }
      const user = result.data && result.data.user ? result.data.user : null;
      setText(stateId, "Signed in.");
      setText(operatorId, `Operator: ${authStateLabel(user)}`);
      if (onAuthenticated) {
        await onAuthenticated(user);
      }
    });
    return null;
  }

  function buildSessionPayload(session, images, user) {
    const captureType = normalizeCaptureType(session.capture_type);
    const captureLayout = normalizeCaptureLayout(session.capture_layout);
    const sourceDevice = {
      ...(session.device || {}),
      capture_type: captureType,
      capture_layout: captureLayout
    };
    session.device = sourceDevice;
    return {
      capture_session_id: session.capture_session_id,
      etb_location: session.etb_location,
      etb_location_id: session.etb_location,
      created_at: session.created_at,
      updated_at: new Date().toISOString(),
      submitted_at: null,
      status: "UPLOADING",
      source: "MOBILE_WEB",
      operator: user ? user.email : "",
      operator_id: user ? user.id : null,
      user_id: user ? user.id : null,
      device: sourceDevice,
      source_device: sourceDevice,
      capture_type: captureType,
      image_count: images.length,
      original_image_locations: [],
      conversion_status: "UPLOADING",
      conversion_workstation: ""
    };
  }

  function storageObjectUrl(cfg, bucket, path) {
    const baseUrl = cfg.supabaseUrl.replace(/\/+$/, "");
    const safeBucket = encodeURIComponent(bucket);
    const safePath = String(path).split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/${safeBucket}/${safePath}`;
  }

  function validateUploadImage(image, path, user) {
    if (!user || !user.id) {
      throw new Error("Sign in required before upload.");
    }
    if (!image || !(image.file instanceof Blob)) {
      throw new Error("Upload original image failed. Code: invalid-file. Selected image is not a valid browser file. Auth: signed in.");
    }
    if (!String(image.type || image.file.type || "").startsWith("image/")) {
      throw new Error("Upload original image failed. Code: invalid-content-type. Selected file is not an image. Auth: signed in.");
    }
    if (!String(path || "").startsWith(`${user.id}/`) || path.includes("//")) {
      throw new Error("Upload original image failed. Code: invalid-path. Object path is not scoped to the signed-in operator. Auth: signed in.");
    }
  }

  async function uploadOriginalImage(cfg, path, image, user, session) {
    validateUploadImage(image, path, user);
    if (!session || !session.access_token) {
      throw new Error("Upload original image failed. Code: missing-auth-token. Sign in required before upload. Auth: signed in; user bearer token missing.");
    }
    const response = await fetch(storageObjectUrl(cfg, cfg.originalImageBucket, path), {
      method: "POST",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Cache-Control": "3600",
        "Content-Type": image.type || image.file.type || "image/jpeg",
        "x-upsert": "false"
      },
      body: image.file
    });
    if (response.ok) {
      return;
    }
    const responseText = await response.text();
    let body = responseText;
    try {
      body = JSON.parse(responseText);
    } catch (_exc) {
      body = responseText;
    }
    if (response.status === 400 && String(storageErrorDetails("Upload original image", response, body, user, session)).toLowerCase().includes("already exists")) {
      return;
    }
    throw new Error(storageErrorDetails("Upload original image", response, body, user, session));
  }

  async function findCanonicalLocationByDisplayCode(client, displayCode) {
    const result = await client
      .from("cardvector_storage_locations")
      .select("id,display_code")
      .eq("display_code", displayCode)
      .is("archived_at", null)
      .limit(1);
    if (result.error) {
      throw result.error;
    }
    return result.data && result.data.length ? result.data[0] : null;
  }

  async function upsertCanonicalCaptureSession(client, session, images, user, status) {
    const location = await findCanonicalLocationByDisplayCode(client, session.etb_location);
    const payload = {
      owner_user_id: user.id,
      source_application: "CardVector.app",
      originating_device: session.device || {},
      location_id: location ? location.id : null,
      status,
      photo_count: images.length,
      processed_count: 0,
      recognized_count: 0,
      failed_count: 0,
      sync_state: "synced",
      legacy_session_id: session.capture_session_id,
      legacy_capture_type: normalizeCaptureType(session.capture_type),
      legacy_etb_location_id: session.etb_location,
      migration_metadata: {
        compatibility_table: "mobile_capture_sessions"
      },
      created_by: user.id,
      updated_by: user.id,
      created_at: session.created_at,
      updated_at: new Date().toISOString()
    };
    const result = await client
      .from("cardvector_capture_sessions")
      .upsert(payload, { onConflict: "owner_user_id,legacy_session_id" })
      .select("id")
      .single();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  async function upsertCanonicalCaptureImage(client, canonicalSession, image, uploaded, user, index) {
    if (!canonicalSession || !canonicalSession.id) {
      return;
    }
    const result = await client
      .from("cardvector_capture_images")
      .upsert({
        capture_session_id: canonicalSession.id,
        owner_user_id: user.id,
        storage_bucket: uploaded.bucket,
        storage_object_path: uploaded.path,
        original_filename: image.name,
        sequence_number: index + 1,
        upload_status: "uploaded",
        processing_status: "pending",
        byte_size: image.size || 0,
        legacy_image_id: image.id,
        migration_metadata: {
          compatibility_table: "mobile_capture_images",
          side: uploaded.side,
          card_number: uploaded.card_number
        },
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString()
      }, { onConflict: "owner_user_id,storage_bucket,storage_object_path" });
    if (result.error) {
      throw result.error;
    }
  }

  async function tryCanonicalRegistry(operation, cfg, user, fallbackValue) {
    try {
      return await operation();
    } catch (error) {
      if (cfg.requireCanonicalRegistry || !isMissingCanonicalRegistry(error)) {
        throw new Error(supabaseErrorDetails("Canonical registry sync", error, user));
      }
      return fallbackValue;
    }
  }

  function tolerateLegacyCompatibilityWrite(operation, error, user, canonicalSession) {
    if (canonicalSession && isMissingCanonicalRegistry(error)) {
      return;
    }
    throw new Error(supabaseErrorDetails(operation, error, user));
  }

  async function submitCapture(client, session, images, cfg, user, authSession) {
    const captureLayout = normalizeCaptureLayout(session.capture_layout);
    const orderedImages = orderedCaptureImages(images, captureLayout);
    session.status = "UPLOADING";
    saveStoredSession(session.etb_location.split("-").slice(0, 2).join("-"), session.etb_location.split("-")[2], session);
    updateCaptureSummary(session);
    setProgress(5, "Creating capture session...");
    const sessionPayload = buildSessionPayload(session, orderedImages, user);
    const now = sessionPayload.updated_at;
    let canonicalSession = await tryCanonicalRegistry(
      () => upsertCanonicalCaptureSession(client, session, orderedImages, user, "uploading"),
      cfg,
      user,
      null
    );
    const upsert = await client.from("mobile_capture_sessions").upsert(sessionPayload, { onConflict: "capture_session_id" });
    if (upsert.error) {
      tolerateLegacyCompatibilityWrite("Create capture session", upsert.error, user, canonicalSession);
    }
    const uploaded = [];
    for (let index = 0; index < orderedImages.length; index += 1) {
      const image = orderedImages[index];
      const position = imageCapturePosition(image, index, captureLayout);
      const ext = (image.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${session.etb_location}/${session.capture_session_id}/${String(index + 1).padStart(4, "0")}-${image.id}.${ext}`;
      const progress = 10 + Math.round(((index + 1) / orderedImages.length) * 70);
      setProgress(progress, `Uploading ${index + 1} of ${orderedImages.length}...`);
      await uploadOriginalImage(cfg, path, image, user, authSession);
      const row = {
        image_id: image.id,
        capture_session_id: session.capture_session_id,
        storage_bucket: cfg.originalImageBucket,
        storage_path: path,
        original_filename: image.name,
        content_type: image.type || "image/jpeg",
        byte_size: image.size || 0,
        image_order: index + 1,
        sequence_number: index + 1,
        upload_status: "UPLOADED",
        created_at: now,
        removed_at: null,
        user_id: user ? user.id : null
      };
      const uploadedRecord = {
        bucket: cfg.originalImageBucket,
        path,
        image_id: image.id,
        sequence_number: index + 1,
        card_number: position.cardNumber,
        side: position.side
      };
      uploaded.push(uploadedRecord);
      await tryCanonicalRegistry(
        () => upsertCanonicalCaptureImage(client, canonicalSession, image, uploadedRecord, user, index),
        cfg,
        user,
        null
      );
      const imageInsert = await client.from("mobile_capture_images").upsert(row, { onConflict: "image_id" });
      if (imageInsert.error) {
        tolerateLegacyCompatibilityWrite("Record uploaded image", imageInsert.error, user, canonicalSession);
      }
    }
    setProgress(90, "Submitting for conversion...");
    const submittedAt = new Date().toISOString();
    canonicalSession = await tryCanonicalRegistry(
      () => upsertCanonicalCaptureSession(client, session, orderedImages, user, "pending_processing"),
      cfg,
      user,
      canonicalSession
    );
    const update = await client
      .from("mobile_capture_sessions")
      .update({
        status: "PENDING_CONVERSION",
        capture_type: normalizeCaptureType(session.capture_type),
        updated_at: submittedAt,
        submitted_at: submittedAt,
        image_count: orderedImages.length,
        original_image_locations: uploaded,
        conversion_status: "PENDING_CONVERSION"
      })
      .eq("capture_session_id", session.capture_session_id)
      .in("status", ["UPLOADING", "PENDING_CONVERSION"]);
    if (update.error) {
      tolerateLegacyCompatibilityWrite("Submit capture session", update.error, user, canonicalSession);
    }
    session.status = "PENDING_CONVERSION";
    session.submitted_at = submittedAt;
    session.image_count = orderedImages.length;
    session.card_count = captureCardCount(orderedImages, captureLayout);
    session.original_image_locations = uploaded;
    session.conversion_status = "PENDING_CONVERSION";
    saveStoredSession(session.etb_location.split("-").slice(0, 2).join("-"), session.etb_location.split("-")[2], session);
    await clearDraftImages(session.capture_session_id);
    updateCaptureSummary(session);
    setProgress(100, "Uploaded. Pending conversion.");
  }

  function stopCamera() {
    if (cameraController && cameraController.stream) {
      cameraController.stream.getTracks().forEach((track) => track.stop());
    }
    cameraController = null;
  }

  const cameraPreferenceKey = "cardvector.mobileCapture.cameraDeviceId";

  function selectedCameraDeviceId() {
    try {
      return localStorage.getItem(cameraPreferenceKey) || "";
    } catch (_exc) {
      return "";
    }
  }

  function saveSelectedCameraDeviceId(deviceId) {
    try {
      if (deviceId) {
        localStorage.setItem(cameraPreferenceKey, deviceId);
      } else {
        localStorage.removeItem(cameraPreferenceKey);
      }
    } catch (_exc) {
      // Camera choice is a convenience preference; capture should continue.
    }
  }

  function cameraVideoConstraints(deviceId = "") {
    const base = {
      width: { ideal: 1920 },
      height: { ideal: 2560 }
    };
    if (deviceId) {
      return { ...base, deviceId: { exact: deviceId } };
    }
    return { ...base, facingMode: { ideal: "environment" } };
  }

  async function listCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  }

  function cameraDeviceLabel(device, index) {
    return device.label || `Camera ${index + 1}`;
  }

  function updateCameraPicker(devices, activeDeviceId = "") {
    const controls = document.getElementById("camera-controls");
    const select = document.getElementById("camera-device-select");
    const status = document.getElementById("camera-device-status");
    if (!controls || !select || !status) {
      return;
    }
    if (!devices.length) {
      controls.hidden = true;
      select.innerHTML = "";
      status.textContent = "No camera devices found.";
      return;
    }
    controls.hidden = false;
    select.innerHTML = devices.map((device, index) => {
      const value = escapeHtml(device.deviceId || "");
      const selected = device.deviceId && device.deviceId === activeDeviceId ? " selected" : "";
      return `<option value="${value}"${selected}>${escapeHtml(cameraDeviceLabel(device, index))}</option>`;
    }).join("");
    if (activeDeviceId && Array.from(select.options).some((option) => option.value === activeDeviceId)) {
      select.value = activeDeviceId;
    }
    select.disabled = devices.length <= 1;
    status.textContent = devices.length > 1
      ? "Choose the camera to use for this capture session."
      : "Only one camera is available.";
  }

  function bindCameraPicker() {
    const select = document.getElementById("camera-device-select");
    if (!select || select.dataset.bound === "true") {
      return;
    }
    select.dataset.bound = "true";
    select.addEventListener("change", async () => {
      const deviceId = select.value || "";
      saveSelectedCameraDeviceId(deviceId);
      select.disabled = true;
      setProgress(0, "Switching camera...");
      await startCamera(deviceId);
    });
  }

  async function startCamera(preferredDeviceId = selectedCameraDeviceId()) {
    const video = document.getElementById("capture-video");
    const fallback = document.getElementById("camera-fallback");
    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = "Camera is not available in this browser. Use Photo Library instead.";
      }
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraVideoConstraints(preferredDeviceId),
        audio: false
      });
      video.srcObject = stream;
      cameraController = { stream };
      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || preferredDeviceId || "";
      if (activeDeviceId) {
        saveSelectedCameraDeviceId(activeDeviceId);
      }
      try {
        updateCameraPicker(await listCameraDevices(), activeDeviceId);
      } catch (_deviceExc) {
        updateCameraPicker([], "");
      }
      bindCameraPicker();
      if (fallback) {
        fallback.hidden = true;
        fallback.textContent = "";
      }
    } catch (exc) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = `Camera unavailable: ${sanitizeErrorMessage(exc.message || exc)}. Use Photo Library instead.`;
      }
      try {
        updateCameraPicker(await listCameraDevices(), preferredDeviceId);
      } catch (_deviceExc) {
        updateCameraPicker([], "");
      }
      bindCameraPicker();
    }
  }

  async function captureStillFromVideo() {
    const video = document.getElementById("capture-video");
    const canvas = document.getElementById("capture-canvas");
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      throw new Error("Camera preview is not ready yet.");
    }
    const preview = video.getBoundingClientRect();
    const crop = window.CardVectorCaptureMath.calculateCoverCrop(
      video.videoWidth,
      video.videoHeight,
      preview.width,
      preview.height
    );
    const output = window.CardVectorCaptureMath.calculateCaptureOutputSize(crop, egressSafeLimits.captureMaxEdge);
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      video,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to capture camera image."));
          return;
        }
        resolve(blob);
      }, "image/jpeg", egressSafeLimits.captureJpegQuality);
    });
  }

  async function initializeCapture(etbId, location, captureType, captureLayout) {
    const normalizedType = normalizeCaptureType(captureType);
    const normalizedLayout = normalizeCaptureLayout(captureLayout);
    const cfg = captureConfig();
    const client = configuredSupabase();
    let session = getStoredSession(etbId, location, normalizedType, normalizedLayout);
    if (!session || session.status === "PENDING_CONVERSION") {
      session = newDraft(etbId, location, normalizedType, normalizedLayout);
      saveStoredSession(etbId, location, session);
    }
    updateCaptureSummary(session);
    if (session) {
      renderThumbnails(session);
    }
    if (!client) {
      setProgress(0, "Mobile capture backend is not configured.");
      const auth = document.getElementById("capture-auth");
      if (auth) {
        auth.innerHTML = `<span class="capture-auth-state">Configure Supabase before uploads are enabled.</span>`;
      }
    } else {
      ensureAuth(client, {
        onAuthenticated: async (user) => {
          if (!session || !user) {
            return;
          }
          session.operator_id = user.id;
          session.operator = user.email || "";
          saveStoredSession(etbId, location, session);
        }
      });
    }
    await startCamera();
    document.getElementById("capture-back").addEventListener("click", () => {
      stopCamera();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign(`/location/${encodeURIComponent(etbId)}/${encodeURIComponent(location)}`);
      }
    });
    document.getElementById("camera-shutter").addEventListener("click", async () => {
      try {
        if (!session || session.status !== "DRAFT") {
          session = newDraft(etbId, location, normalizedType, normalizedLayout);
        }
        const blob = await captureStillFromVideo();
        const imageNumber = (await loadDraftImages(session.capture_session_id)).length + 1;
        await saveDraftBlob(
          session.capture_session_id,
          blob,
          `${session.capture_session_id}-${String(imageNumber).padStart(4, "0")}.jpg`,
          "LIVE_CAMERA",
          normalizedLayout
        );
        session.image_count = (await loadDraftImages(session.capture_session_id)).length;
        saveStoredSession(etbId, location, session);
        updateCaptureSummary(session);
        await renderThumbnails(session);
        const images = await loadDraftImages(session.capture_session_id);
        const next = nextCapturePosition(images, normalizedLayout);
        setProgress(0, `Captured Card ${next.side === "back" ? next.cardNumber : Math.max(1, next.cardNumber - 1)}. Next: Card ${next.cardNumber} ${next.side}.`);
      } catch (exc) {
        setProgress(0, exc.message || String(exc));
      }
    });
    document.getElementById("capture-files").addEventListener("change", async (event) => {
      if (!session || session.status !== "DRAFT") {
        session = newDraft(etbId, location, normalizedType, normalizedLayout);
      }
      const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) {
        setProgress(0, "No images selected.");
        return;
      }
      await saveDraftImages(session.capture_session_id, files, normalizedLayout);
      session.image_count = (await loadDraftImages(session.capture_session_id)).length;
      saveStoredSession(etbId, location, session);
      updateCaptureSummary(session);
      await renderThumbnails(session);
      setProgress(0, "Images staged on this phone.");
      event.target.value = "";
    });
    document.getElementById("upload-capture").addEventListener("click", async () => {
      try {
        if (!client) {
          throw new Error("Mobile capture backend is not configured.");
        }
        if (!session) {
          throw new Error("Start a capture session first.");
        }
        if (session.status === "PENDING_CONVERSION") {
          throw new Error("This session is already pending conversion.");
        }
        const auth = await client.auth.getSession();
        const authSession = auth.data && auth.data.session ? auth.data.session : null;
        const user = authSession ? authSession.user : null;
        if (!user) {
          setText("capture-operator", "Operator: not signed in");
          setProgress(0, "Sign in required before upload.");
          return;
        }
        if (!authSession.access_token) {
          setProgress(0, "Sign in required before upload.");
          return;
        }
        setText("capture-operator", `Operator: ${authStateLabel(user)}`);
        const images = await loadDraftImages(session.capture_session_id);
        if (!images.length) {
          throw new Error("Capture at least one image before upload.");
        }
        if (!captureLayoutIsComplete(images, normalizedLayout)) {
          setProgress(0, "Capture the back of the current card, or remove its incomplete front image, before finishing.");
          return;
        }
        await submitCapture(client, session, images, cfg, user, authSession);
        stopCamera();
      } catch (exc) {
        if (session) {
          session.status = "FAILED";
          saveStoredSession(etbId, location, session);
          updateCaptureSummary(session);
        }
        setProgress(0, exc.message || String(exc));
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopCamera();
      } else if (session && session.status === "DRAFT") {
        startCamera();
      }
    });
    window.addEventListener("pagehide", stopCamera);
    window.addEventListener("beforeunload", stopCamera);
  }

  if (route === "operator" || route === "operator-dashboard") {
    if (parts[1] && ["registry", "locations", "location-registry"].includes(parts[1].toLowerCase())) {
      renderOperatorRegistry();
      return;
    }
    if (parts[1] && ["batches", "batch-workflow"].includes(parts[1].toLowerCase())) {
      renderOperatorBatchWorkflow();
      return;
    }
    if (parts[1] && ["listings", "listing-reconciliation", "existing-listing-review"].includes(parts[1].toLowerCase())) {
      renderOperatorListingReconciliation();
      return;
    }
    if (parts[1] && ["repricing", "price-review"].includes(parts[1].toLowerCase())) {
      renderOperatorRepricingReview();
      return;
    }
    renderOperatorDashboard();
    return;
  }

  if (route === "registry" || route === "location-registry") {
    renderOperatorRegistry();
    return;
  }

  if (route === "shop") {
    renderDirectStorePage();
    return;
  }

  if (route === "cart") {
    renderDirectStoreCartPage();
    return;
  }

  if (route === "batches" || route === "batch-workflow") {
    renderOperatorBatchWorkflow();
    return;
  }

  if (route === "listings" || route === "listing-reconciliation" || route === "existing-listing-review") {
    renderOperatorListingReconciliation();
    return;
  }

  if (route === "repricing" || route === "price-review") {
    renderOperatorRepricingReview();
    return;
  }

  if (sellRoutes.has(route)) {
    renderSellCollectionPage();
    return;
  }

  if (route === "contact") {
    renderContactPage();
    return;
  }

  if (marketBriefRoutes.has(route)) {
    if (parts[1]) {
      renderMarketBriefPost(parts[1].toLowerCase());
    } else {
      renderMarketBriefsPage();
    }
    return;
  }

  function renderRetiredMobileCapturePage(contextTitle = "Mobile Capture") {
    renderQrView(
      `${contextTitle} Retired`,
      "CardVector mobile capture has moved to CardUploader.",
      detailRow("Status", "Retired") +
        detailRow("Current Capture Workflow", '<a href="https://carduploader.com/dashboard/history" target="_blank" rel="noopener noreferrer">Use CardUploader batches</a>') +
        detailRow("CardVector Role", "Market briefs, seller tools, batch references, and controlled pricing review") +
        detailRow("Home", '<a href="/">Return to Putnam Collectibles</a>'),
      `<section class="operator-side-panel" aria-labelledby="capture-retired-title">
        <h2 id="capture-retired-title">Use CardUploader for photo capture</h2>
        <p>Phone and camera-roll capture now belongs in CardUploader, which owns recognition, batch creation, managed inventory, and eBay synchronization.</p>
        <p>CardVector no longer stages new mobile capture sessions, uploads mobile originals, or downloads mobile capture queues.</p>
        <div class="operator-toolbar-actions">
          <a class="button primary" href="https://carduploader.com/dashboard/history" target="_blank" rel="noopener noreferrer">Open CardUploader Batches</a>
          <a class="button secondary" href="/operator">Operator Dashboard</a>
        </div>
      </section>`
    );
    document.title = `${contextTitle} Retired | CardVector`;
  }

  if (route === "etb" && parts[1]) {
    const etbId = parts[1].toUpperCase();
    renderRetiredMobileCapturePage(etbId);
    return;
  }

  if (route === "location" && parts[1] && parts[2]) {
    const etbId = parts[1].toUpperCase();
    const location = parts[2].toUpperCase();
    renderRetiredMobileCapturePage(`${etbId} Location ${location}`);
    return;
  }

  if ((route === "capture" && !parts[1]) || route === "mobile-capture" || route === "mobile") {
    renderRetiredMobileCapturePage("Mobile Capture");
    return;
  }

  if (route === "capture" && parts[1] && parts[2]) {
    const etbId = parts[1].toUpperCase();
    const location = parts[2].toUpperCase();
    renderRetiredMobileCapturePage(`${etbId} Location ${location}`);
    return;
  }

  if (route === "lot" && parts[1]) {
    const lotId = parts[1].toUpperCase();
    renderQrView(
      lotId,
      "Putnam Collectibles acquisition lot.",
      detailRow("Type", "Acquisition Lot") + detailRow("Lot ID", escapeHtml(lotId)) + detailRow("Powered By", "CardVector")
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
