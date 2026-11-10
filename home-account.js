/* CardVector homepage session status, no private data in public responses. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const primary = $("nav-account-primary");
  const menu = $("nav-account-menu");
  if (!primary || !menu || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(
    "https://iqdpfgpkagjxzedfxrvn.supabase.co",
    "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH"
  );
  let requestNumber = 0;
  async function refresh() {
    const request = ++requestNumber;
    const {data:{user},error} = await client.auth.getUser();
    if(request !== requestNumber) return;
    if(error || !user) {
      primary.textContent = "Sign in";
      primary.href = "/account/";
      primary.removeAttribute("title");
      menu.hidden = true;
      return;
    }
    const {data:profile} = await client.from("cv_profiles")
      .select("display_name").eq("user_id",user.id).maybeSingle();
    if(request !== requestNumber) return;
    const name = (profile?.display_name || user.user_metadata?.display_name || "Collector").trim();
    primary.textContent = "Account: " + name;
    primary.href = "/dashboard/";
    primary.title = "Signed in as " + (user.email || name);
    $("nav-account-name").textContent = name;
    $("nav-account-email").textContent = user.email || "Signed in";
    menu.hidden = false;
  }
  $("nav-account-signout").addEventListener("click",async () => {
    const button = $("nav-account-signout");
    button.disabled = true;
    const {error} = await client.auth.signOut();
    button.disabled = false;
    if(error){button.textContent="Sign out failed — retry";return;}
    await refresh();
  });
  client.auth.onAuthStateChange(() => {void refresh();});
  void refresh();
})();