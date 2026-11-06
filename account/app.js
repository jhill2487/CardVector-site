/* Collector authentication: only the public Supabase publishable key is embedded here. */
(function () {
  "use strict";
  const projectUrl = "https://iqdpfgpkagjxzedfxrvn.supabase.co";
  const publishableKey = "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH";
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  let mode = "login";
  let client;
  let recoveryMode = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";

  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("error", isError);
  }
  function setMode(next) {
    mode = next;
    const register = next === "register";
    $("tab-login").setAttribute("aria-pressed", String(!register));
    $("tab-register").setAttribute("aria-pressed", String(register));
    $("registration-fields").hidden = !register;
    $("display-name").required = register;
    $("password").autocomplete = register ? "new-password" : "current-password";
    $("auth-heading").textContent = register ? "Create your account" : "Sign in";
    $("submit-auth").textContent = register ? "Create account" : "Sign in";
    $("forgot-password").hidden = register;
    message("");
  }
  async function loadAccount(user) {
    $("auth-panel").hidden = true;
    $("account-panel").hidden = false;
    $("account-email").textContent = user.email || "";
    $("dashboard-name").textContent = user.user_metadata?.display_name || "Collector";
    const { data, error } = await client.from("cv_profiles")
      .select("display_name,favorite_tcg").eq("user_id", user.id).maybeSingle();
    if (error) { message("Profile could not be loaded. " + error.message, true); return; }
    $("profile-name").value = data?.display_name || user.user_metadata?.display_name || "";
    $("dashboard-name").textContent = data?.display_name || user.user_metadata?.display_name || "Collector";
    $("favorite-tcg").value = data?.favorite_tcg || "";
    message(data ? "" : "Welcome! Save your display name to finish setting up your profile.");
    await loadWantedRequests(user.id);
  }
  async function loadWantedRequests(userId) {
    const target = $("wanted-list");
    target.textContent = "Loading your requests…";
    const { data, error } = await client.from("cv_wanted_requests")
      .select("id,card_name,set_name,card_number,minimum_condition,max_price_usd,quantity,consider_lower_condition,created_at")
      .eq("user_id", userId).eq("status", "active").order("created_at", {ascending:false}).limit(50);
    if (error) {
      target.textContent = "Could not load requests: " + error.message;
      $("wanted-count").textContent = "Unavailable";
      return;
    }
    $("wanted-count").textContent = data.length + (data.length === 50 ? "+" : "") + " active";
    target.replaceChildren();
    if (!data.length) {
      const p = document.createElement("p"); p.className = "hint";
      p.textContent = "No open requests yet. Search for a card to add your first.";
      target.append(p);
      return;
    }
    for (const request of data) {
      const row = document.createElement("div"); row.className = "wanted-item";
      const details = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = request.card_name + " · " + request.set_name;
      const terms = document.createElement("p"); terms.className = "hint";
      terms.textContent = "#" + request.card_number + " · " + request.minimum_condition + " or better · Qty " +
        request.quantity + " · Max $" + Number(request.max_price_usd).toFixed(2) +
        (request.consider_lower_condition ? " · Open to lower-condition offers" : "");
      details.append(name,terms);
      const close = document.createElement("button");
      close.type = "button"; close.className = "secondary"; close.textContent = "Close request";
      close.addEventListener("click", async () => {
        close.disabled = true;
        const { error: closeError } = await client.from("cv_wanted_requests")
          .update({status:"closed",updated_at:new Date().toISOString()}).eq("id",request.id).eq("user_id",userId);
        if (closeError) { message("Could not close request: " + closeError.message,true); close.disabled = false; }
        else await loadWantedRequests(userId);
      });
      row.append(details,close); target.append(row);
    }
  }
  function showRecovery() {
    recoveryMode = true;
    $("auth-panel").hidden = true;
    $("account-panel").hidden = true;
    $("recovery-panel").hidden = false;
    message("Choose a new password to secure your CardVector account.");
  }
  async function refresh() {
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      message("Could not check sign-in status. Please try again.", true);
    }
    if (data?.user && recoveryMode) showRecovery();
    else if (data?.user) await loadAccount(data.user);
    else { $("auth-panel").hidden = false; $("account-panel").hidden = true; }
  }
  async function submitAuth(event) {
    event.preventDefault();
    $("submit-auth").disabled = true;
    message("");
    try {
      const email = $("email").value.trim();
      const password = $("password").value;
      if (mode === "register") {
        const displayName = $("display-name").value.trim();
        if (!displayName) throw new Error("Enter a display name.");
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { data: { display_name: displayName }, emailRedirectTo: location.origin + "/account/" }
        });
        if (error) throw error;
        if (data.session) await refresh();
        else message("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refresh();
      }
    } catch (error) { message(error.message || "Unable to sign in.", true); }
    finally { $("submit-auth").disabled = false; }
  }
  async function saveProfile(event) {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const display_name = $("profile-name").value.trim();
      if (!display_name) throw new Error("Display name is required.");
      const { error } = await client.from("cv_profiles").upsert({
        user_id: user.id, display_name, favorite_tcg: $("favorite-tcg").value,
        onboarding_completed_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) throw error;
      $("dashboard-name").textContent = display_name;
      message("Your collector profile has been saved.");
    } catch (error) { message(error.message || "Could not save profile.", true); }
    finally { button.disabled = false; }
  }
  async function resetPassword() {
    const email = $("email").value.trim();
    if (!email) { message("Enter your email address first.", true); return; }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + "/account/"
    });
    message(error ? error.message : "If this email is registered, a password reset link has been sent.", Boolean(error));
  }
  async function submitRecovery(event) {
    event.preventDefault();
    const button = $("save-new-password");
    const password = $("new-password").value;
    if (password !== $("confirm-password").value) {
      message("Passwords do not match.", true);
      return;
    }
    button.disabled = true;
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) throw new Error("Recovery link has expired. Request a new password reset email.");
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryMode = false;
      $("recovery-panel").hidden = true;
      history.replaceState(null, "", "/account/");
      await refresh();
      message("Password updated successfully. Your CardVector account is ready.");
    } catch (error) {
      message(error.message || "Unable to update your password.", true);
    } finally {
      button.disabled = false;
    }
  }
  async function init() {
    if (!window.supabase?.createClient) {
      message("Account service is unavailable. Please reload this page.", true);
      return;
    }
    client = window.supabase.createClient(projectUrl, publishableKey);
    $("tab-login").addEventListener("click", () => setMode("login"));
    $("tab-register").addEventListener("click", () => setMode("register"));
    $("auth-form").addEventListener("submit", submitAuth);
    $("profile-form").addEventListener("submit", saveProfile);
    $("recovery-form").addEventListener("submit", submitRecovery);
    $("forgot-password").addEventListener("click", resetPassword);
    $("sign-out").addEventListener("click", async () => {
      const { error } = await client.auth.signOut();
      if (error) message(error.message, true);
      else { await refresh(); message("Signed out."); }
    });
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") showRecovery();
    });
    await refresh();
  }
  init();
})();