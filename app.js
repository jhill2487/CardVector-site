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

  const mobileHashRoutes = new Set(["mobile", "mobile-capture", "operator", "operator-dashboard", "registry", "location-registry"]);
  function currentHashRoute() {
    return window.location.hash.replace(/^#\/?/, "").toLowerCase();
  }
  window.addEventListener("hashchange", () => {
    if (mobileHashRoutes.has(currentHashRoute())) {
      window.location.reload();
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
    COLLECTION_INQUIRY_URL: "https://tally.so/r/ob1ABN"
  });
  if (route === "contact") {
    window.location.replace(siteLinks.COLLECTION_INQUIRY_URL);
    return;
  }

  const sellRoutes = new Set(["sell", "bulk", "buylist"]);
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

  async function loadOperatorRegistry(client, user) {
    await requireLocationAuthorization(client, user);
    const locationsResult = await queryOptionalTable(
      client,
      "cardvector_storage_locations",
      "id,name,display_code,parent_location_id,location_type,status,capacity,stored_count,sync_state,legacy_id,legacy_etb_id,legacy_location_code,metadata,updated_at,archived_at",
      (query) => query.is("archived_at", null).order("display_code", { ascending: true })
    );
    const sessionsResult = await queryOptionalTable(
      client,
      "cardvector_capture_sessions",
      "id,legacy_session_id,legacy_etb_location_id,location_id,status,source_application,photo_count,processed_count,recognized_count,failed_count,sync_state,migration_metadata,created_at,updated_at,completed_at,archived_at",
      (query) => query.is("archived_at", null).order("updated_at", { ascending: false }).limit(40)
    );
    const batchesResult = await queryOptionalTable(
      client,
      "cardvector_location_carduploader_batches_v",
      "id,location_id,canonical_location_display_code,location_display_code,etb_display_code,carduploader_batch_id,carduploader_batch_url,carduploader_batch_name,batch_label,event_type,card_count,batch_date,updated_at",
      (query) => query.order("batch_date", { ascending: false }).limit(80)
    );
    return {
      locations: locationsResult.data,
      sessions: sessionsResult.data,
      batches: batchesResult.data,
      missing: {
        locations: locationsResult.missing,
        sessions: sessionsResult.missing,
        batches: batchesResult.missing
      }
    };
  }

  function renderOperatorDashboard() {
    main.innerHTML = `
      <section class="operator-shell wrap" aria-labelledby="operator-title">
        <div class="operator-hero">
          <p class="eyebrow">CardVector workspace</p>
          <h1 id="operator-title">Operator Dashboard</h1>
          <p>Use CardVector.app as the primary operating surface for capture, ETB locations, batch work, price review, and existing listing review.</p>
        </div>
        <div class="operator-grid" aria-label="Operator workflows">
          <a class="operator-card operator-card-primary" href="/operator/registry">
            <span>Live Registry</span>
            <strong>ETB / Location Registry</strong>
            <p>Review synchronized Supabase ETBs, slots, mobile captures, and CardUploader batch references.</p>
          </a>
          <a class="operator-card" href="/#mobile-capture">
            <span>Capture</span>
            <strong>Mobile Capture</strong>
            <p>Start card capture from a workstation, tablet, or phone without scanning a QR code.</p>
          </a>
          <article class="operator-card is-disabled" aria-label="Batch workflow coming next">
            <span>Next</span>
            <strong>Batch Workflow</strong>
            <p>CardUploader batch assignment and batch status controls will move here next.</p>
          </article>
          <article class="operator-card is-disabled" aria-label="Price review coming next">
            <span>Next</span>
            <strong>Price Review</strong>
            <p>Marketplace Intelligence recommendations and review queues will live in this workspace.</p>
          </article>
          <article class="operator-card is-disabled" aria-label="Existing listing review coming next">
            <span>Next</span>
            <strong>Existing Listing Review</strong>
            <p>eBay listing checks will be staged here before any automated marketplace updates exist.</p>
          </article>
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

  function renderOperatorRegistryView(registry, user) {
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
          </div>
          <div class="operator-toolbar-actions">
            <a class="button secondary" href="/operator">Operator Dashboard</a>
            <a class="button primary" href="/#mobile-capture">Start Mobile Capture</a>
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
          const registry = await loadOperatorRegistry(client, user);
          renderOperatorRegistryView(registry, user);
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
    const output = window.CardVectorCaptureMath.calculateCaptureOutputSize(crop, 1800);
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
      }, "image/jpeg", 0.9);
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
    renderOperatorDashboard();
    return;
  }

  if (route === "registry" || route === "location-registry") {
    renderOperatorRegistry();
    return;
  }

  if (sellRoutes.has(route)) {
    renderSellCollectionPage();
    return;
  }

  if (route === "etb" && parts[1]) {
    const etbId = parts[1].toUpperCase();
    renderQrView(
      etbId,
      "Putnam Collectibles inventory location check.",
      detailRow("Type", "Storage Label") +
        detailRow("ETB ID", escapeHtml(etbId)) +
        detailRow("Inventory Details", "Private") +
        detailRow("Owner", "Putnam Collectibles") +
        detailRow("Powered By", "CardVector"),
      captureEntryShellHtml(`Capture from ${etbId}`)
    );
    document.title = `${etbId} | Putnam Collectibles`;
    initializeCaptureEntry({ fixedEtb: etbId, landing: true });
    return;
  }

  if (route === "location" && parts[1] && parts[2]) {
    const etbId = parts[1].toUpperCase();
    const location = parts[2].toUpperCase();
    renderQrView(
      `Location ${location}`,
      "Putnam Collectibles inventory location check.",
      detailRow("Type", "Location Label") +
        detailRow("ETB ID", escapeHtml(etbId)) +
      detailRow("Location", escapeHtml(location)) +
        detailRow("Inventory Details", "Private") +
        detailRow("Owner", "Putnam Collectibles") +
        detailRow("Powered By", "CardVector"),
      captureChoiceHtml(etbId, location)
    );
    document.title = `${etbId} Location ${location} | Putnam Collectibles`;
    return;
  }

  if ((route === "capture" && !parts[1]) || route === "mobile-capture" || route === "mobile") {
    renderQrView(
      "Mobile Capture",
      "Start a CardVector capture session without scanning a location QR.",
      detailRow("Workflow", "Authenticated operator") +
        detailRow("Camera", "Starts only after destination review") +
        detailRow("Powered By", "CardVector"),
      captureEntryShellHtml("Start Mobile Capture")
    );
    document.title = "Mobile Capture | CardVector";
    initializeCaptureEntry();
    return;
  }

  if (route === "capture" && parts[1] && parts[2]) {
    const etbId = parts[1].toUpperCase();
    const location = parts[2].toUpperCase();
    const captureType = captureTypeFromSlug(parts[3] || "physical-inventory");
    const captureLayout = captureLayoutFromSlug(parts[4] || "");
    const type = captureTypeConfig[captureType];
    if (!captureLayout) {
      renderQrView(
        type.title,
        `${etbId} Location ${location}`,
        detailRow("ETB ID", escapeHtml(etbId)) +
          detailRow("Location", escapeHtml(location)) +
          detailRow("Capture Type", escapeHtml(type.label)) +
          detailRow("Camera", "Starts after photo mode selection"),
        captureLayoutChoiceHtml(etbId, location, captureType)
      );
      document.getElementById("capture-layout-back").addEventListener("click", () => window.history.back());
      document.title = `Choose Photo Mode | ${etbId} ${location}`;
      return;
    }
    const layout = captureLayoutConfig[captureLayout];
    renderQrView(
      type.title,
      `${etbId} Location ${location}`,
      detailRow("ETB ID", escapeHtml(etbId)) +
        detailRow("Location", escapeHtml(location)) +
        detailRow("Capture Type", escapeHtml(type.label)) +
        detailRow("Photo Mode", escapeHtml(layout.label)) +
        detailRow("Upload Status", "Private CardVector workflow"),
      captureScreenHtml(etbId, location, captureType, captureLayout)
    );
    document.title = `${type.title} | ${etbId} ${location}`;
    initializeCapture(etbId, location, captureType, captureLayout);
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
