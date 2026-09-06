/* ClayHand 3D · Auth / Perfil
 * Google Identity Services + Firebase Authentication + perfil local.
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
let _firebaseAuth = null;
let _firebaseAuthSdk = null;
let _firebaseSessionReady = Promise.resolve();
const _dbReady = (async () => {
  try {
    const [{ app, db }, firestoreModule, authModule] = await Promise.all([
      import("./firebaseConfig.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js")
    ]);
    _fsDb = db;
    _fs = firestoreModule;
    _firebaseAuthSdk = authModule;
    _firebaseAuth = authModule.getAuth(app);
    // Firebase restaura la sesión guardada de forma asíncrona al recargar la
    // página. Esperamos esa restauración antes de leer/escribir Firestore.
    _firebaseSessionReady = new Promise((resolve) => {
      authModule.onAuthStateChanged(_firebaseAuth, () => resolve(), () => resolve());
    });
    window.ClayHandDB = _fsDb;
    window.ClayHandFirebaseAuth = _firebaseAuth;
    return _fsDb;
  } catch (e) {
    console.error("ClayHand: no se pudo inicializar Firebase.", e);
    return null;
  }
})();

async function signInFirebaseWithGoogle(idToken) {
  await _dbReady;
  if (!_firebaseAuth || !_firebaseAuthSdk) {
    throw new Error("Firebase no pudo inicializarse. Revisá firebaseConfig.js y la conexión a internet.");
  }
  const credential = _firebaseAuthSdk.GoogleAuthProvider.credential(idToken);
  return _firebaseAuthSdk.signInWithCredential(_firebaseAuth, credential);
}

async function fsSaveProfile(uid, profile) {
  await _dbReady;
  await _firebaseSessionReady;
  if (!_fsDb || !_fs || !uid) return;
  try {
    await _fs.setDoc(_fs.doc(_fsDb, "users", uid), profile, { merge: true });
  } catch (e) {
    console.error("ClayHand: error guardando el perfil en Firestore", e);
  }
}

async function fsLoadProfile(uid) {
  await _dbReady;
  await _firebaseSessionReady;
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
  await _firebaseSessionReady;
  if (!_fsDb || !_fs || !uid || !order?.id) return;
  try {
    await _fs.setDoc(_fs.doc(_fsDb, "users", uid, "orders", order.id), order, { merge: true });
  } catch (e) {
    console.error("ClayHand: error guardando el pedido en Firestore", e);
  }
}

async function fsLoadOrders(uid) {
  await _dbReady;
  await _firebaseSessionReady;
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
  async logout() {
    try {
      await _dbReady;
      if (_firebaseAuth && _firebaseAuthSdk) await _firebaseAuthSdk.signOut(_firebaseAuth);
    } catch (e) {
      console.warn("ClayHand: no se pudo cerrar la sesión de Firebase", e);
    }
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
    // Usamos el popup del propio SDK de Firebase. El botón anterior de GIS
    // emitía un token para un Client ID externo y Firebase lo rechazaba como
    // `auth/invalid-credential` al intentar asociarlo a este proyecto.
    if (!_firebaseAuth || !_firebaseAuthSdk) {
      container.innerHTML = '<p class="text-xs text-amber-300">Cargando inicio de sesión seguro…</p>';
      _dbReady.then(() => this.renderGoogleButton());
      return;
    }
    container.innerHTML = '<button type="button" class="ch-firebase-google" style="width:320px;border:0;border-radius:999px;padding:13px 18px;background:#fff;color:#171717;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer" aria-label="Continuar con Google">Continuar con Google</button>';
    container.querySelector(".ch-firebase-google").addEventListener("click", () => this.signInWithFirebaseGoogle());
  },
  async finishFirebaseLogin(firebaseUser, fallback = {}) {
    const user = {
      sub: firebaseUser.uid,
      email: firebaseUser.email || fallback.email || "",
      name: firebaseUser.displayName || fallback.name || "",
      picture: firebaseUser.photoURL || fallback.picture || "",
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(CH_AUTH_KEY, JSON.stringify(user));
    await this.syncFromCloud(user.sub);
    this.closeAuth();
    this.refreshUI();
    const authModal = document.getElementById("ch-auth-modal");
    const action = authModal?.dataset.continueAction || "";
    if (action === "generate" || action === "checkout") this.openProfile({continueAction: action});
    else this.openProfile();
  },
  async signInWithFirebaseGoogle() {
    try {
      if (!_firebaseAuth || !_firebaseAuthSdk) throw new Error("Firebase todavía no terminó de inicializarse.");
      const provider = new _firebaseAuthSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await _firebaseAuthSdk.signInWithPopup(_firebaseAuth, provider);
      await this.finishFirebaseLogin(result.user);
    } catch (e) {
      console.error("No se pudo procesar el acceso con Google", e);
      const detail = e?.code === "auth/operation-not-allowed"
        ? "Activá Google en Firebase Console > Authentication > Sign-in method."
        : e?.code === "auth/unauthorized-domain"
          ? "Agregá este dominio en Firebase Console > Authentication > Settings > Authorized domains."
          : "Revisá la configuración de Firebase e intentá nuevamente.";
      alert("No se pudo completar el inicio de sesión con Google. " + detail);
    }
  },
  async handleGoogleCredential(response) {
    try {
      const payload = JSON.parse(atob(response.credential.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
      const firebaseResult = await signInFirebaseWithGoogle(response.credential);
      const firebaseUser = firebaseResult.user;
      await this.finishFirebaseLogin(firebaseUser, payload);
    } catch (e) {
      console.error("No se pudo procesar el acceso con Google", e);
      const detail = e?.code === "auth/operation-not-allowed"
        ? "Activá Google en Firebase Console > Authentication > Sign-in method."
        : e?.code === "auth/unauthorized-domain"
          ? "Agregá este dominio en Firebase Console > Authentication > Settings > Authorized domains."
          : "Revisá la configuración de Firebase e intentá nuevamente.";
      alert("No se pudo completar el inicio de sesión con Google. " + detail);
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
