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
          createdAt: new Date().toISOString()
        });
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function saveDraftBlob(sessionId, blob, name) {
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
          <div class="camera-fallback" id="camera-fallback">Camera not started.</div>
        </div>
        <div class="capture-actions capture-actions-main">
          <button class="button primary capture-button shutter-button" id="camera-shutter" type="button">Capture Photo</button>
          <label class="button secondary capture-file-label" for="capture-files">Choose from Photo Library</label>
          <input id="capture-files" class="capture-file-input" type="file" accept="image/*" multiple>
          <button class="button primary capture-button" id="upload-capture" type="button">Finish Session</button>
        </div>
        <div class="capture-progress" aria-live="polite">
          <progress id="capture-progress" max="100" value="0"></progress>
          <span id="capture-progress-text">Ready</span>
        </div>
        <div class="capture-thumbs" id="capture-thumbs" aria-label="Captured photo thumbnails"></div>
      </section>`;
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
    setTimeout(() => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    }, 30000);
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

  async function ensureAuth(client) {
    const auth = document.getElementById("capture-auth");
    if (!client || !auth) {
      return null;
    }
    const current = await client.auth.getSession();
    if (current.data && current.data.session) {
      auth.innerHTML = `<span class="capture-auth-state">Signed in</span>`;
      setText("capture-operator", `Operator: ${authStateLabel(current.data.session.user)}`);
      return current.data.session.user;
    }
    auth.innerHTML = `
      <label>Email <input id="capture-email" type="email" autocomplete="email" placeholder="operator@example.com"></label>
      <label>Password <input id="capture-password" type="password" autocomplete="current-password" placeholder="Password"></label>
      <button class="button secondary" id="capture-sign-in" type="button">Sign In</button>
      <span class="capture-auth-state" id="capture-auth-state">Sign in before upload.</span>`;
    document.getElementById("capture-sign-in").addEventListener("click", async () => {
      const email = document.getElementById("capture-email").value.trim();
      const password = document.getElementById("capture-password").value;
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        setText("capture-auth-state", supabaseErrorDetails("Sign in", result.error, null));
        return;
      }
      const user = result.data && result.data.user ? result.data.user : null;
      setText("capture-auth-state", "Signed in.");
      setText("capture-operator", `Operator: ${authStateLabel(user)}`);
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
    const maxEdge = 1800;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
      ensureAuth(client);
    }
    await startCamera();
    document.getElementById("camera-shutter").addEventListener("click", async () => {
      try {
        if (!session || session.status !== "DRAFT") {
          session = newDraft(etbId, location, normalizedType);
        }
        const blob = await captureStillFromVideo();
        const imageNumber = (await loadDraftImages(session.capture_session_id)).length + 1;
        await saveDraftBlob(session.capture_session_id, blob, `${session.capture_session_id}-${String(imageNumber).padStart(4, "0")}.jpg`);
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
