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

  function captureConfig() {
    const cfg = window.CARDVECTOR_MOBILE_CAPTURE_CONFIG || {};
    return {
      supabaseUrl: String(cfg.supabaseUrl || "").trim(),
      supabaseAnonKey: String(cfg.supabaseAnonKey || "").trim(),
      originalImageBucket: String(cfg.originalImageBucket || "mobile-capture-originals").trim()
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

  function sessionKey(etbId, location, captureType) {
    return `cardvector.mobileCapture.${normalizeCaptureType(captureType)}.${etbId}.${location}`;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getStoredSession(etbId, location, captureType) {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey(etbId, location, captureType)) || "null");
      if (session) {
        session.capture_type = normalizeCaptureType(session.capture_type || captureType);
      }
      return session;
    } catch (_exc) {
      return null;
    }
  }

  function saveStoredSession(etbId, location, session) {
    const captureType = normalizeCaptureType(session && session.capture_type);
    localStorage.setItem(sessionKey(etbId, location, captureType), JSON.stringify(session));
  }

  function newDraft(etbId, location, captureType) {
    const createdAt = new Date().toISOString();
    const normalizedType = normalizeCaptureType(captureType);
    return {
      capture_session_id: uuid(),
      etb_location: `${etbId}-${location}`,
      capture_type: normalizedType,
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
        capture_type: normalizedType
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

  async function saveDraftImages(sessionId, files) {
    const db = await openCaptureDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(captureStoreName, "readwrite");
      const store = tx.objectStore(captureStoreName);
      Array.from(files).forEach((file) => {
        const id = uuid();
        store.put({
          id,
          sessionId,
          file,
          name: file.name || `${id}.jpg`,
          type: file.type || "image/jpeg",
          size: file.size || 0,
          origin: "PHOTO_LIBRARY",
          createdAt: new Date().toISOString()
        });
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function saveDraftBlob(sessionId, blob, name, origin = "LIVE_CAMERA") {
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

  function captureScreenHtml(etbId, location, captureType) {
    const type = captureTypeConfig[normalizeCaptureType(captureType)];
    return `
      <section class="mobile-capture capture-screen" aria-labelledby="capture-title">
        <div class="capture-header">
          <div>
            <p class="eyebrow">Mobile Capture</p>
            <h2 id="capture-title">${escapeHtml(type.title)}</h2>
            <p>Use the rear camera when available. Each shutter press saves one still to this phone before upload.</p>
          </div>
          <span class="capture-status" id="capture-status">DRAFT</span>
        </div>
        <div class="capture-summary" aria-live="polite">
          <div><span>ETB Location</span><strong id="capture-location">${escapeHtml(etbId)}-${escapeHtml(location)}</strong></div>
          <div><span>Capture Type</span><strong id="capture-type-label">${escapeHtml(type.shortLabel)}</strong></div>
          <div><span>Session</span><strong id="capture-session-id">Not started</strong></div>
          <div><span>Images</span><strong id="capture-image-count">0</strong></div>
        </div>
        <div class="capture-operator" id="capture-operator" aria-live="polite">Operator: not signed in</div>
        <div class="capture-auth" id="capture-auth"></div>
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

  function captureRoute(etbId, location, captureType) {
    const type = captureTypeConfig[normalizeCaptureType(captureType)];
    return `/capture/${encodeURIComponent(mobileCore.normalizeEtbId(etbId))}/${encodeURIComponent(mobileCore.normalizeLocationCode(location))}/${type.slug}`;
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
    return `
      <div class="entry-summary">
        <div><span>Capture Type</span><strong>${escapeHtml(type)}</strong></div>
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

  async function listCloudEtbs(client, user) {
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

  async function listCloudLocations(client, user, etbId) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
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

  async function createCloudNextLocation(client, user, etbId, expectedCode) {
    const canonicalEtb = mobileCore.normalizeEtbId(etbId);
    const expected = mobileCore.normalizeLocationCode(expectedCode);
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
    target.innerHTML = `
      <aside class="draft-resume">
        <div>
          <strong>Unfinished Draft</strong>
          <span>${escapeHtml(draft.session.etb_location)} · ${images.length} image${images.length === 1 ? "" : "s"}</span>
        </div>
        <div class="entry-actions">
          <a class="button primary" href="${captureRoute(draft.etbId, draft.location, type)}">Resume Draft</a>
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

    async function refreshLocations() {
      state.locations = await listCloudLocations(client, state.user, state.etbId);
      return state.locations;
    }

    function renderTypeSelection(backTarget = "") {
      state.location = "";
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
        const occupancy = `${Number(location.stored_count || 0)}/${Number(location.capacity || 40)}`;
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
      target.innerHTML = `
        ${entrySummaryHtml(state)}
        <h3>Review Destination</h3>
        <div class="location-proposal"><span>${escapeHtml(type.label)}</span><strong>${escapeHtml(canonicalId)}</strong></div>
        <div class="entry-actions">
          <button class="button primary" id="entry-start-capture" type="button">Start Capture</button>
          <button class="button secondary" id="entry-back" type="button">Back</button>
        </div>`;
      bind("#entry-start-capture", () => window.location.assign(captureRoute(state.etbId, state.location, state.captureType)));
      bind("#entry-back", renderLocationSelection);
    }

    function renderEtbLanding() {
      state.captureType = "";
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
            renderTypeSelection();
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
    images.forEach((image, index) => {
      const url = URL.createObjectURL(image.file);
      urls.push(url);
      const item = document.createElement("figure");
      item.className = "capture-thumb";
      item.innerHTML = `
        <img src="${url}" alt="Captured card ${index + 1}">
        <figcaption>
          <span>${index + 1}</span>
          <button type="button" data-remove-image="${escapeHtml(image.id)}" aria-label="Remove image ${index + 1}">Remove</button>
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
      device: session.device,
      source_device: session.device,
      capture_type: normalizeCaptureType(session.capture_type),
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

  async function submitCapture(client, session, images, cfg, user, authSession) {
    session.status = "UPLOADING";
    saveStoredSession(session.etb_location.split("-").slice(0, 2).join("-"), session.etb_location.split("-")[2], session);
    updateCaptureSummary(session);
    setProgress(5, "Creating capture session...");
    const sessionPayload = buildSessionPayload(session, images, user);
    const now = sessionPayload.updated_at;
    const upsert = await client.from("mobile_capture_sessions").upsert(sessionPayload, { onConflict: "capture_session_id" });
    if (upsert.error) {
      throw new Error(supabaseErrorDetails("Create capture session", upsert.error, user));
    }
    const uploaded = [];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const ext = (image.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${session.etb_location}/${session.capture_session_id}/${String(index + 1).padStart(4, "0")}-${image.id}.${ext}`;
      const progress = 10 + Math.round(((index + 1) / images.length) * 70);
      setProgress(progress, `Uploading ${index + 1} of ${images.length}...`);
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
      const imageInsert = await client.from("mobile_capture_images").upsert(row, { onConflict: "image_id" });
      if (imageInsert.error) {
        throw new Error(supabaseErrorDetails("Record uploaded image", imageInsert.error, user));
      }
      uploaded.push({ bucket: cfg.originalImageBucket, path, image_id: image.id, sequence_number: index + 1 });
    }
    setProgress(90, "Submitting for conversion...");
    const submittedAt = new Date().toISOString();
    const update = await client
      .from("mobile_capture_sessions")
      .update({
        status: "PENDING_CONVERSION",
        capture_type: normalizeCaptureType(session.capture_type),
        updated_at: submittedAt,
        submitted_at: submittedAt,
        image_count: images.length,
        original_image_locations: uploaded,
        conversion_status: "PENDING_CONVERSION"
      })
      .eq("capture_session_id", session.capture_session_id)
      .in("status", ["UPLOADING", "PENDING_CONVERSION"]);
    if (update.error) {
      throw new Error(supabaseErrorDetails("Submit capture session", update.error, user));
    }
    session.status = "PENDING_CONVERSION";
    session.submitted_at = submittedAt;
    session.image_count = images.length;
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

  async function startCamera() {
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
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 2560 }
        },
        audio: false
      });
      video.srcObject = stream;
      cameraController = { stream };
      if (fallback) {
        fallback.hidden = true;
        fallback.textContent = "";
      }
    } catch (exc) {
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = `Camera unavailable: ${sanitizeErrorMessage(exc.message || exc)}. Use Photo Library instead.`;
      }
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

  async function initializeCapture(etbId, location, captureType) {
    const normalizedType = normalizeCaptureType(captureType);
    const cfg = captureConfig();
    const client = configuredSupabase();
    let session = getStoredSession(etbId, location, normalizedType);
    if (!session || session.status === "PENDING_CONVERSION") {
      session = newDraft(etbId, location, normalizedType);
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
          session = newDraft(etbId, location, normalizedType);
        }
        const blob = await captureStillFromVideo();
        const imageNumber = (await loadDraftImages(session.capture_session_id)).length + 1;
        await saveDraftBlob(
          session.capture_session_id,
          blob,
          `${session.capture_session_id}-${String(imageNumber).padStart(4, "0")}.jpg`,
          "LIVE_CAMERA"
        );
        session.image_count = (await loadDraftImages(session.capture_session_id)).length;
        saveStoredSession(etbId, location, session);
        updateCaptureSummary(session);
        await renderThumbnails(session);
        setProgress(0, `Captured ${session.image_count} image${session.image_count === 1 ? "" : "s"} on this phone.`);
      } catch (exc) {
        setProgress(0, exc.message || String(exc));
      }
    });
    document.getElementById("capture-files").addEventListener("change", async (event) => {
      if (!session || session.status !== "DRAFT") {
        session = newDraft(etbId, location, normalizedType);
      }
      const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) {
        setProgress(0, "No images selected.");
        return;
      }
      await saveDraftImages(session.capture_session_id, files);
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

  if (route === "capture" && !parts[1]) {
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
    const type = captureTypeConfig[captureType];
    renderQrView(
      type.title,
      `${etbId} Location ${location}`,
      detailRow("ETB ID", escapeHtml(etbId)) +
        detailRow("Location", escapeHtml(location)) +
        detailRow("Capture Type", escapeHtml(type.label)) +
        detailRow("Upload Status", "Private CardVector workflow"),
      captureScreenHtml(etbId, location, captureType)
    );
    document.title = `${type.title} | ${etbId} ${location}`;
    initializeCapture(etbId, location, captureType);
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
