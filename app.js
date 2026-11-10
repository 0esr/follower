const $ = selector => document.querySelector(selector);
let currentUser = null;
let myAccounts = [];

function message(target, text, good = false) {
  const el = $(target);
  el.textContent = text || "";
  el.style.color = good ? "#75e5b5" : "#ffb6a8";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "حدث خطأ غير متوقع.");
  return data;
}

function platformName(value) {
  return {instagram:"Instagram",tiktok:"TikTok",x:"X",youtube:"YouTube"}[value] || value;
}

function profileUrl(platform, username) {
  const roots = {
    instagram:"https://www.instagram.com/",
    tiktok:"https://www.tiktok.com/@",
    x:"https://x.com/",
    youtube:"https://www.youtube.com/@"
  };
  return roots[platform] + encodeURIComponent(username);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function showAuth(mode) {
  $("#loginForm").classList.toggle("hidden", mode !== "login");
  $("#registerForm").classList.toggle("hidden", mode !== "register");
  document.querySelectorAll(".auth-tab").forEach(button => button.classList.toggle("active", button.dataset.auth === mode));
  message("#authMessage", "");
}

document.querySelectorAll(".auth-tab").forEach(button => button.addEventListener("click", () => showAuth(button.dataset.auth)));

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/login", { method:"POST", body:JSON.stringify(Object.fromEntries(form)) });
    await loadApp();
  } catch (error) { message("#authMessage", error.message); }
});

$("#registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/register", { method:"POST", body:JSON.stringify(Object.fromEntries(form)) });
    await loadApp();
  } catch (error) { message("#authMessage", error.message); }
});

$("#logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", {method:"POST"}); }
  finally {
    currentUser = null;
    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    $("#logoutBtn").classList.add("hidden");
    $("#headerUser").textContent = "";
    showAuth("login");
  }
});

function showPage(name) {
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("hidden", page.id !== "page-" + name));
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.page === name));
  if (name === "tasks") loadTasks();
  if (name === "promote") loadAccounts();
  if (name === "account") loadHistory();
  if (name === "admin") loadAdmin();
}

document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));

async function loadApp() {
  try {
    const result = await api("/api/me");
    currentUser = result.user;
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#logoutBtn").classList.remove("hidden");
    $("#headerUser").textContent = currentUser.username;
    $("#welcomeName").textContent = currentUser.name;
    $("#profileName").textContent = currentUser.name;
    $("#profileUsername").textContent = "@" + currentUser.username;
    $("#profileEmail").textContent = currentUser.email;
    updatePoints(currentUser.points);
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", currentUser.role !== "admin"));
    await Promise.all([loadAccounts(), loadTasks(), loadHistory()]);
  } catch (error) {
    $("#authView").classList.remove("hidden");
    $("#appView").classList.add("hidden");
  }
}

function updatePoints(points) {
  currentUser.points = Number(points);
  $("#headerPoints").textContent = points;
  $("#mainPoints").textContent = points;
  $("#statPoints").textContent = points;
  $("#profilePoints").textContent = points;
}

async function loadAccounts() {
  const result = await api("/api/accounts");
  myAccounts = result.accounts;
  $("#statAccounts").textContent = myAccounts.length;
  const target = $("#myAccounts");
  if (!myAccounts.length) {
    target.innerHTML = '<div class="empty">لم تضف أي حساب حتى الآن.</div>';
    return;
  }
  target.innerHTML = myAccounts.map(account => `
    <div class="item">
      <div class="item-main"><b>@${escapeHtml(account.social_username)}</b><small>${platformName(account.platform)}</small></div>
      <div class="item-actions">
        <button class="task-link" data-open="${account.id}">فتح الحساب</button>
        <button class="claim" data-promote="${account.id}">ترويج 30 نقطة</button>
        <button class="secondary" data-delete="${account.id}">حذف</button>
      </div>
    </div>`).join("");

  target.querySelectorAll("[data-open]").forEach(button => {
    const account = myAccounts.find(item => String(item.id) === button.dataset.open);
    button.addEventListener("click", () => window.open(profileUrl(account.platform, account.social_username), "_blank", "noopener,noreferrer"));
  });
  target.querySelectorAll("[data-promote]").forEach(button => button.addEventListener("click", () => createPromotion(button.dataset.promote)));
  target.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteAccount(button.dataset.delete)));
}

$("#accountForm").addEventListener("submit", async event => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api("/api/accounts", {method:"POST",body:JSON.stringify(body)});
    event.currentTarget.reset();
    message("#appMessage", "تم حفظ الحساب في قاعدة البيانات.", true);
    await loadAccounts();
  } catch (error) { message("#appMessage", error.message); }
});

async function deleteAccount(id) {
  if (!confirm("هل تريد حذف هذا الحساب؟")) return;
  try {
    await api("/api/accounts/" + id, {method:"DELETE"});
    await loadAccounts();
  } catch (error) { message("#appMessage", error.message); }
}

async function createPromotion(accountId) {
  if (!confirm("سيتم خصم 30 نقطة لإنشاء حملة ترويج. متابعة؟")) return;
  try {
    const result = await api("/api/promotions", {method:"POST",body:JSON.stringify({account_id:Number(accountId)})});
    updatePoints(result.points);
    message("#appMessage", "تم إنشاء حملة الترويج.", true);
    await loadTasks();
    await loadHistory();
  } catch (error) { message("#appMessage", error.message); }
}

async function loadTasks() {
  const target = $("#tasksList");
  try {
    const result = await api("/api/tasks");
    if (!result.tasks.length) {
      target.innerHTML = '<div class="empty">لا توجد مهام متاحة حالياً. أضف حساباً وأنشئ حملة ترويج.</div>';
      return;
    }
    target.innerHTML = result.tasks.map(task => `
      <div class="item">
        <div class="item-main"><b>@${escapeHtml(task.social_username)}</b><small>${platformName(task.platform)} · المكافأة 10 نقاط</small></div>
        <div class="item-actions">
          <button class="task-link" data-visit="${task.promotion_id}">زيارة الحساب</button>
          <button class="claim" data-claim="${task.promotion_id}">تابعت – أرسل للمراجعة</button>
        </div>
      </div>`).join("");
    result.tasks.forEach(task => {
      target.querySelector(`[data-visit="${task.promotion_id}"]`).addEventListener("click", () => window.open(profileUrl(task.platform, task.social_username), "_blank", "noopener,noreferrer"));
      target.querySelector(`[data-claim="${task.promotion_id}"]`).addEventListener("click", async () => {
        if (!confirm("تأكد أنك تابعت الحساب فعلاً. سيتم إرسال طلب للمسؤول لمراجعته.")) return;
        try {
          const response = await api(`/api/tasks/${task.promotion_id}/claim`, {method:"POST",body:"{}"});
          message("#appMessage", response.message, true);
          await loadTasks();
          await loadHistory();
        } catch (error) { message("#appMessage", error.message); }
      });
    });
  } catch (error) { target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

$("#refreshTasks").addEventListener("click", loadTasks);

async function loadHistory() {
  const result = await api("/api/history");
  $("#statClaims").textContent = result.history.filter(item => item.reason.includes("مهمة")).length;
  const target = $("#historyList");
  if (!result.history.length) {
    target.innerHTML = '<div class="empty">لا يوجد سجل نقاط حتى الآن.</div>';
    return;
  }
  target.innerHTML = result.history.map(item => `
    <div class="item">
      <div class="item-main"><b>${escapeHtml(item.reason)}</b><small>${new Date(item.created_at).toLocaleString("ar-SA")}</small></div>
      <strong style="color:${item.amount >= 0 ? "#75e5b5" : "#ffb6a8"}">${item.amount > 0 ? "+" : ""}${item.amount}</strong>
    </div>`).join("");
  await refreshMe();
}

async function refreshMe() {
  const result = await api("/api/me");
  currentUser = result.user;
  updatePoints(currentUser.points);
}

async function loadAdmin() {
  if (!currentUser || currentUser.role !== "admin") return;
  try {
    const [claims, summary] = await Promise.all([api("/api/admin/claims"),api("/api/admin/summary")]);
    $("#adminSummary").innerHTML = Object.entries({
      "المستخدمون":summary.summary.users,
      "الحسابات":summary.summary.accounts,
      "الحملات النشطة":summary.summary.promotions,
      "طلبات المراجعة":summary.summary.pending_claims
    }).map(([label,value]) => `<div><small>${label}</small><b>${value}</b></div>`).join("");
    const target = $("#adminClaims");
    if (!claims.claims.length) {
      target.innerHTML = '<div class="empty">لا توجد طلبات معلقة.</div>';
      return;
    }
    target.innerHTML = claims.claims.map(claim => `
      <div class="item">
        <div class="item-main"><b>${escapeHtml(claim.worker_name)} (@${escapeHtml(claim.worker_username)})</b><small>تابع @${escapeHtml(claim.social_username)} · ${platformName(claim.platform)}</small></div>
        <div class="item-actions">
          <button class="claim" data-approve="${claim.id}">اعتماد +10</button>
          <button class="secondary" data-reject="${claim.id}">رفض</button>
        </div>
      </div>`).join("");
    target.querySelectorAll("[data-approve]").forEach(button => button.addEventListener("click", () => reviewClaim(button.dataset.approve,"approve")));
    target.querySelectorAll("[data-reject]").forEach(button => button.addEventListener("click", () => reviewClaim(button.dataset.reject,"reject")));
  } catch (error) { message("#appMessage", error.message); }
}

async function reviewClaim(id, decision) {
  const promptText = decision === "approve" ? "اعتماد الطلب وإضافة 10 نقاط؟" : "رفض هذا الطلب؟";
  if (!confirm(promptText)) return;
  try {
    await api(`/api/admin/claims/${id}/review`, {method:"POST",body:JSON.stringify({decision})});
    await loadAdmin();
    message("#appMessage", "تمت مراجعة الطلب.", true);
  } catch (error) { message("#appMessage", error.message); }
}

loadApp();
