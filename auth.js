/* ClayHand 3D · Auth / Perfil
 * Google Identity Services + perfil local.
 * IMPORTANTE: para producción, verificar el credential de Google en servidor.
 */
window.CLAYHAND_CONFIG = Object.assign({
  GOOGLE_CLIENT_ID: "383549486388-9sopp2762s5s2j9fts2mvoa8o4ucsocf.apps.googleusercontent.com",
  MERCADOPAGO_CHECKOUT_URL: "https://mpago.la/2xWiBBK",
  API_BASE_URL: "" // opcional: backend futuro; el flujo actual usa el link de Mercado Pago + WhatsApp
}, window.CLAYHAND_CONFIG || {});

const CH_AUTH_KEY = "clayhand_auth_v1";
const CH_PROFILE_KEY = "clayhand_profile_v1";
const CH_ORDERS_KEY = "clayhand_orders_v1";

/* ---------------------------------------------------------------------
 * Conexión con Firestore (la base de datos de Firebase).
 * auth.js se carga como <script> clásico (no type="module") en todas las
 * páginas, así que usamos import() dinámico para traer el SDK modular de
 * Firebase y reutilizar la instancia de la app/Firestore que ya inicializa
 * firebaseConfig.js (evita inicializar Firebase dos veces).
 * localStorage se sigue usando como caché rápida y como respaldo por si el
 * usuario está sin conexión, pero ahora todo se sincroniza también con
 * Firestore, que es lo que antes faltaba por completo.
 * ------------------------------------------------------------------- */
let _fsDb = null;
let _fs = null;
const _dbReady = (async () => {
  try {
    const [{ db }, firestoreModule] = await Promise.all([
      import("./firebaseConfig.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    ]);
    _fsDb = db;
    _fs = firestoreModule;
    window.ClayHandDB = _fsDb;
    return _fsDb;
  } catch (e) {
    console.error("ClayHand: no se pudo conectar con la base de datos de Firebase (Firestore). Se sigue usando el almacenamiento local como respaldo.", e);
    return null;
  }
})();

async function fsSaveProfile(uid, profile) {
  await _dbReady;
  if (!_fsDb || !_fs || !uid) return;
  try {
    await _fs.setDoc(_fs.doc(_fsDb, "users", uid), profile, { merge: true });
  } catch (e) {
    console.error("ClayHand: error guardando el perfil en Firestore", e);
  }
}

async function fsLoadProfile(uid) {
  await _dbReady;
  if (!_fsDb || !_fs || !uid) return null;
  try {
    const snap = await _fs.getDoc(_fs.doc(_fsDb, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("ClayHand: error leyendo el perfil desde Firestore", e);
    return null;
  }
}

async function fsSaveOrder(uid, order) {
  await _dbReady;
  if (!_fsDb || !_fs || !uid || !order?.id) return;
  try {
    await _fs.setDoc(_fs.doc(_fsDb, "users", uid, "orders", order.id), order, { merge: true });
  } catch (e) {
    console.error("ClayHand: error guardando el pedido en Firestore", e);
  }
}

async function fsLoadOrders(uid) {
  await _dbReady;
  if (!_fsDb || !_fs || !uid) return [];
  try {
    const snap = await _fs.getDocs(_fs.collection(_fsDb, "users", uid, "orders"));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error("ClayHand: error leyendo los pedidos desde Firestore", e);
    return [];
  }
}

window.ClayHandAuth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem(CH_AUTH_KEY) || "null"); } catch { return null; }
  },
  getProfile() {
    try { return JSON.parse(localStorage.getItem(CH_PROFILE_KEY) || "null"); } catch { return null; }
  },
  isLoggedIn() { return !!this.getUser(); },
  isProfileComplete() {
    const p = this.getProfile();
    return !!(p && p.fullName && p.phone && p.address && p.postalCode);
  },
  saveProfile(profile) {
    const current = this.getProfile() || {};
    const merged = Object.assign({}, current, profile, { updatedAt: new Date().toISOString() });
    localStorage.setItem(CH_PROFILE_KEY, JSON.stringify(merged));
    this.refreshUI();
    const user = this.getUser();
    if (user?.sub) fsSaveProfile(user.sub, Object.assign({ email: user.email || "" }, merged));
    return merged;
  },
  logout() {
    localStorage.removeItem(CH_AUTH_KEY);
    localStorage.removeItem(CH_PROFILE_KEY);
    this.refreshUI();
    location.href = "index.html";
  },
  orders() {
    try { return JSON.parse(localStorage.getItem(CH_ORDERS_KEY) || "[]"); } catch { return []; }
  },
  saveOrder(order) {
    const orders = this.orders();
    orders.unshift(order);
    localStorage.setItem(CH_ORDERS_KEY, JSON.stringify(orders));
    const user = this.getUser();
    if (user?.sub) fsSaveOrder(user.sub, order);
    return order;
  },
  updateOrder(id, patch) {
    const orders = this.orders().map(o => o.id === id ? Object.assign({}, o, patch) : o);
    localStorage.setItem(CH_ORDERS_KEY, JSON.stringify(orders));
    const updated = orders.find(o => o.id === id);
    const user = this.getUser();
    if (user?.sub && updated) fsSaveOrder(user.sub, updated);
    return updated;
  },
  // Trae perfil y pedidos guardados en Firestore y los combina con lo que
  // ya hay en localStorage (por ejemplo, pedidos hechos en otro dispositivo
  // o antes de que existiera esta sincronización).
  async syncFromCloud(uid) {
    if (!uid) return;
    try {
      const [cloudProfile, cloudOrders] = await Promise.all([fsLoadProfile(uid), fsLoadOrders(uid)]);
      if (cloudProfile) {
        const current = this.getProfile() || {};
        const merged = Object.assign({}, cloudProfile, current);
        localStorage.setItem(CH_PROFILE_KEY, JSON.stringify(merged));
      }
      if (cloudOrders && cloudOrders.length) {
        const localOrders = this.orders();
        const merged = cloudOrders.slice();
        localOrders.forEach(lo => { if (!merged.some(o => o.id === lo.id)) merged.push(lo); });
        merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        localStorage.setItem(CH_ORDERS_KEY, JSON.stringify(merged));
      }
      this.refreshUI();
    } catch (e) {
      console.error("ClayHand: no se pudo sincronizar con la base de datos de Firebase", e);
    }
  },
  openAuth(options = {}) {
    const modal = document.getElementById("ch-auth-modal");
    if (!modal) return;
    modal.dataset.continueAction = options.continueAction || "";
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    this.renderGoogleButton();
  },
  closeAuth() {
    const modal = document.getElementById("ch-auth-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  },
  openProfile(options = {}) {
    const modal = document.getElementById("ch-profile-modal");
    if (!modal) return;
    modal.dataset.continueAction = options.continueAction || "";
    const p = this.getProfile() || {};
    ["fullName","phone","address","postalCode"].forEach(k => {
      const el = document.getElementById("ch-" + k);
      if (el) el.value = p[k] || "";
    });
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  },
  closeProfile() {
    const modal = document.getElementById("ch-profile-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  },
  refreshUI() {
    const user = this.getUser();
    document.querySelectorAll("[data-ch-logged-out]").forEach(el => el.classList.toggle("hidden", !!user));
    document.querySelectorAll("[data-ch-logged-in]").forEach(el => el.classList.toggle("hidden", !user));
    document.querySelectorAll("[data-ch-user-name]").forEach(el => el.textContent = user?.name || "Mi perfil");
    document.querySelectorAll("[data-ch-user-photo]").forEach(el => {
      if (user?.picture) { el.src = user.picture; el.classList.remove("hidden"); }
      else el.classList.add("hidden");
    });
    // Avisa a cada página (perfil.html, simulador.html, etc.) que la sesión o
    // el perfil cambiaron, para que puedan re-renderizar su propia UI sin
    // depender de un recargado manual de la página.
    document.dispatchEvent(new CustomEvent("ch:authchange", {
      detail: { user, profile: this.getProfile() }
    }));
  },
  renderGoogleButton() {
    const container = document.getElementById("google-signin-button");
    if (!container) return;
    container.innerHTML = "";
    if (!window.google?.accounts?.id) {
      container.innerHTML = '<p class="text-xs text-amber-300">Cargando inicio de sesión con Google…</p>';
      setTimeout(() => this.renderGoogleButton(), 500);
      return;
    }
    const configured = window.CLAYHAND_CONFIG.GOOGLE_CLIENT_ID &&
      !window.CLAYHAND_CONFIG.GOOGLE_CLIENT_ID.startsWith("REEMPLAZAR_");
    if (!configured) {
      container.innerHTML = '<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Falta configurar el <b>Google Client ID</b> en <code>auth.js</code>. La estructura de registro ya está preparada.</div>';
      return;
    }
    google.accounts.id.initialize({
      client_id: window.CLAYHAND_CONFIG.GOOGLE_CLIENT_ID,
      callback: window.ClayHandAuth.handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    google.accounts.id.renderButton(container, {
      theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 320
    });
  },
  async handleGoogleCredential(response) {
    try {
      const payload = JSON.parse(atob(response.credential.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
      const user = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || "",
        picture: payload.picture || "",
        loginAt: new Date().toISOString()
      };
      localStorage.setItem(CH_AUTH_KEY, JSON.stringify(user));
      // Antes de continuar, trae de Firestore el perfil/pedidos de este
      // usuario (si ya existían, por ejemplo desde otro dispositivo).
      await ClayHandAuth.syncFromCloud(user.sub);
      ClayHandAuth.closeAuth();
      ClayHandAuth.refreshUI();
      const authModal = document.getElementById("ch-auth-modal");
      const action = authModal?.dataset.continueAction || "";
      if (action === "generate" || action === "checkout") {
        ClayHandAuth.openProfile({continueAction: action});
      } else {
        ClayHandAuth.openProfile();
      }
    } catch (e) {
      console.error("No se pudo procesar el acceso con Google", e);
      alert("No se pudo completar el inicio de sesión con Google.");
    }
  },
  requireLogin(action) {
    if (!this.isLoggedIn()) { this.openAuth({continueAction: action}); return false; }
    if (!this.isProfileComplete()) { this.openProfile({continueAction: action}); return false; }
    return true;
  },
  continueAction(action) {
    if (action === "generate") {
      const btn = document.getElementById("btn-capture");
      if (btn) btn.click();
    }
    if (action === "checkout") {
      const btn = document.getElementById("btn-checkout");
      if (btn) btn.click();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ClayHandAuth.refreshUI();
  const loggedUser = ClayHandAuth.getUser();
  if (loggedUser?.sub) ClayHandAuth.syncFromCloud(loggedUser.sub);
  const authClose = document.getElementById("ch-auth-close");
  const profileClose = document.getElementById("ch-profile-close");
  authClose?.addEventListener("click", () => ClayHandAuth.closeAuth());
  profileClose?.addEventListener("click", () => ClayHandAuth.closeProfile());

  document.getElementById("ch-profile-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const fullName = document.getElementById("ch-fullName").value.trim();
    const phone = document.getElementById("ch-phone").value.trim();
    const address = document.getElementById("ch-address").value.trim();
    const postalCode = document.getElementById("ch-postalCode").value.trim();
    if (!fullName || !phone || !address || !postalCode) return;
    ClayHandAuth.saveProfile({fullName, phone, address, postalCode});
    const action = document.getElementById("ch-profile-modal").dataset.continueAction || "";
    ClayHandAuth.closeProfile();
    ClayHandAuth.continueAction(action);
  });

  document.querySelectorAll("[data-ch-open-auth]").forEach(btn => btn.addEventListener("click", e => {
    e.preventDefault(); ClayHandAuth.openAuth();
  }));
});
