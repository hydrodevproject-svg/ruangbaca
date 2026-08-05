let currentUserData = null;
let currentAvatarBase64 = null;
let currentCustomAudioBase64 = null;
let currentBookCoverBase64 = null;
let editBookCoverBase64 = null;
let newPostImageBase64 = null;
let editPostImageBase64 = null;
let selectedNotifDocId = null;
let currentSelectedBookForBorrow = null;

let html5QrCodeStaff = null;
let html5QrCodeUser = null;
let html5QrCodeVerify = null;
let cachedLogs = [];
let booksCacheMap = {}; 
let postsCacheMap = {};
let activePostsList = [];
let selectedTagKodes = [];
let notificationsCacheList = [];
let currentNotifFilter = 'semua';
let currentBerandaPanel = 'info';

let MAX_PINJAM = 3;
let LAMA_PINJAM_HARI = 7;
let MAX_POSTS_PER_STAFF = 10;
let POST_EXPIRY_DAYS = 0;
let selectedRating = 5;

let cropperInstance = null;
let cropperTargetType = null;

let unsubscribeBorrowings = null;
let unsubscribeBooks = null;
let unsubscribePosts = null;
let unsubscribeNotifs = null;

const PRIMARY_ADMIN_EMAILS = [
  "admin@pojokbaca.com", 
  "admin_it@pojokbaca.com", 
  "fatinsafryansyah@pojokbaca.com"
];

function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const titleElem = document.getElementById("confirmModalTitle");
    const msgElem = document.getElementById("confirmModalMessage");
    const btnOk = document.getElementById("btnConfirmOk");
    const btnCancel = document.getElementById("btnConfirmCancel");

    if (!modal || !titleElem || !msgElem || !btnOk || !btnCancel) {
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }

    titleElem.innerText = title;
    msgElem.innerText = message;

    modal.classList.remove("hidden");
    updateIcons();

    const handleOk = () => { cleanup(); resolve(true); };
    const handleCancel = () => { cleanup(); resolve(false); };

    function cleanup() {
      modal.classList.add("hidden");
      btnOk.removeEventListener("click", handleOk);
      btnCancel.removeEventListener("click", handleCancel);
    }

    btnOk.addEventListener("click", handleOk);
    btnCancel.addEventListener("click", handleCancel);
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
    const btnLight = document.getElementById("btnThemeLight");
    const btnDark = document.getElementById("btnThemeDark");
    if (btnLight) btnLight.className = "p-2.5 rounded-xl border border-[#5288c1] bg-[#5288c1]/10 text-[#5288c1] flex items-center justify-center gap-2 text-xs font-semibold transition";
    if (btnDark) btnDark.className = "p-2.5 rounded-xl border border-card-border bg-input text-slate-400 flex items-center justify-center gap-2 text-xs font-normal transition";
  } else {
    document.body.classList.remove('theme-light');
    const btnLight = document.getElementById("btnThemeLight");
    const btnDark = document.getElementById("btnThemeDark");
    if (btnDark) btnDark.className = "p-2.5 rounded-xl border border-[#5288c1] bg-[#5288c1]/10 text-[#5288c1] flex items-center justify-center gap-2 text-xs font-semibold transition";
    if (btnLight) btnLight.className = "p-2.5 rounded-xl border border-card-border bg-input text-slate-400 flex items-center justify-center gap-2 text-xs font-normal transition";
  }
}

const initialSavedTheme = localStorage.getItem('pojokbaca_theme') || 'dark';
applyTheme(initialSavedTheme);

async function setThemeMode(mode) {
  applyTheme(mode);
  localStorage.setItem('pojokbaca_theme', mode);
  const user = auth.currentUser;
  if (user) {
    try {
      await db.collection("users").doc(user.uid).set({ theme: mode }, { merge: true });
    } catch (e) {
      console.error("Gagal menyimpan tema ke Firestore:", e);
    }
  }
}

function cleanText(text) {
  if (!text) return "";
  return text.replace(/🌸/g, '').trim();
}

function timeAgo(timestamp) {
  if (!timestamp) return "1 menit lalu";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "1 menit lalu";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  const years = Math.floor(months / 12);
  return `${years} tahun lalu`;
}

function handleImageCropperSelect(event, targetType) {
  const file = event.target.files[0];
  if (!file) return;

  cropperTargetType = targetType;
  const reader = new FileReader();
  reader.onload = (e) => {
    const targetImg = document.getElementById("cropperImageTarget");
    targetImg.src = e.target.result;

    document.getElementById("cropperModal").classList.remove("hidden");

    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(targetImg, {
      aspectRatio: 3 / 4,
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true
    });
  };
  reader.readAsDataURL(file);
}

function closeCropperModal() {
  document.getElementById("cropperModal").classList.add("hidden");
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
}

function applyCroppedImage() {
  if (!cropperInstance) return;
  const canvas = cropperInstance.getCroppedCanvas({
    width: 600,
    height: 800,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  const croppedBase64 = canvas.toDataURL('image/jpeg', 0.7);

  if (cropperTargetType === 'book') currentBookCoverBase64 = croppedBase64;
  else if (cropperTargetType === 'editBook') editBookCoverBase64 = croppedBase64;
  else if (cropperTargetType === 'post') newPostImageBase64 = croppedBase64;
  else if (cropperTargetType === 'editPost') editPostImageBase64 = croppedBase64;

  showToastNotification("Gambar Dipotong", "Gambar berhasil dipotong rasio 3:4!");
  closeCropperModal();
}

function compressImage(file, maxWidth = 300, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

function showToastNotification(title, message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "w-full bg-card border border-[#5288c1]/40 text-app p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 transform transition-all duration-300 translate-y-[-20px] opacity-0 pointer-events-auto backdrop-blur-md";
  toast.innerHTML = `<div class="p-2 bg-[#5288c1]/20 text-[#5288c1] rounded-xl shrink-0"><i data-feather="bell" class="w-4 h-4"></i></div><div class="flex-1"><h5 class="text-xs font-bold text-[#5288c1]">${title}</h5><p class="text-[11px] text-slate-300 mt-0.5">${message}</p></div>`;
  container.appendChild(toast);
  updateIcons();
  setTimeout(() => toast.classList.remove("translate-y-[-20px]", "opacity-0"), 50);
  setTimeout(() => { toast.classList.add("opacity-0", "translate-y-[-20px]"); setTimeout(() => toast.remove(), 300); }, 4000);
}

document.addEventListener("DOMContentLoaded", () => { 
  if (typeof feather !== "undefined") feather.replace(); 
  history.pushState(null, "", window.location.href);
});

function updateIcons() { setTimeout(() => { if (typeof feather !== "undefined") feather.replace(); }, 100); }

function createLog(action, detail) {
  const userEmail = auth.currentUser ? auth.currentUser.email : "System";
  db.collection("logs").add({ user: userEmail, action, detail, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
}

function generateMemberId() {
  return `PB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function checkUserProfileComplete(userData) {
  if (!userData) return false;
  return (userData.displayName?.trim() && userData.phoneNumber?.trim() && userData.memberId?.trim() && userData.address?.trim());
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) selectedTab.classList.remove('hidden');

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('text-[#5288c1]'); btn.classList.add('text-slate-300');
  });

  const activeNavMap = { 
    'dashboardPeminjam': 'mobileNavPeminjam', 
    'dashboardNotifikasi': 'mobileNavNotifikasi', 
    'dashboardStaff': 'mobileNavStaff', 
    'dashboardIT': 'mobileNavAdmin', 
    'dashboardProfil': 'mobileNavProfil' 
  };
  if (activeNavMap[tabId]) {
    const activeBtn = document.getElementById(activeNavMap[tabId]);
    if (activeBtn) { activeBtn.classList.remove('text-slate-300'); activeBtn.classList.add('text-[#5288c1]'); }
  }

  const titleMap = {
    'dashboardIT': ['Admin IT System', 'Pengguna, kontrol & database'],
    'dashboardStaff': ['Sirkulasi Perpustakaan', 'Kelola postingan, stok buku & status'],
    'dashboardNotifikasi': ['Notifikasi & Siaran', 'Pesan masuk dan informasi penting'],
    'dashboardProfil': ['Profil Pengguna', 'Kelola kelengkapan data diri & tema'],
    'dashboardPeminjam': ['pojokbaca', 'by Leni Suspidayanti']
  };

  if (titleMap[tabId]) {
    document.getElementById('currentTabTitle').innerText = titleMap[tabId][0];
    document.getElementById('currentTabSubtitle').innerText = titleMap[tabId][1];
  }

  if (tabId === 'dashboardProfil') loadUserProfileForm();
  if (tabId === 'dashboardIT') calculateDatabaseUsage();
  updateIcons();
}

function switchBerandaPanel(panelName) {
  currentBerandaPanel = panelName;

  const btnInfo = document.getElementById("tabBtnBerandaInfo"), btnKatalog = document.getElementById("tabBtnBerandaKatalog"), btnRiwayat = document.getElementById("tabBtnBerandaRiwayat");
  const panelInfo = document.getElementById("panelBerandaInfo"), panelKatalog = document.getElementById("panelBerandaKatalog"), panelRiwayat = document.getElementById("panelBerandaRiwayat");

  [btnInfo, btnKatalog, btnRiwayat].forEach(b => { if (b) b.className = "py-2 rounded-xl text-[10px] sm:text-[11px] font-medium transition text-slate-400 hover:text-app hover:bg-white/5 flex items-center justify-center gap-1"; });
  [panelInfo, panelKatalog, panelRiwayat].forEach(p => { if (p) p.classList.add("hidden"); });

  if (panelName === 'info' && panelInfo) { panelInfo.classList.remove("hidden"); btnInfo.className = "py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'katalog' && panelKatalog) { panelKatalog.classList.remove("hidden"); btnKatalog.className = "py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'riwayat' && panelRiwayat) { panelRiwayat.classList.remove("hidden"); btnRiwayat.className = "py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }

  handleUniversalSearch();
  updateIcons();
}

function handleUniversalSearch() {
  const query = (document.getElementById("searchFeedPostsInput")?.value || "").toLowerCase().trim();

  if (currentBerandaPanel === 'info') {
    filterFeedPostsList();
  } else if (currentBerandaPanel === 'katalog') {
    filterCatalogBooksCustom(query);
  } else if (currentBerandaPanel === 'riwayat') {
    filterUserBorrowingsCustom(query);
  }
}

function filterCatalogBooksCustom(query) {
  document.querySelectorAll("#peminjamBookGrid > div.book-card-clean").forEach(card => {
    card.style.display = card.innerText.toLowerCase().includes(query) ? "flex" : "none";
  });
}

function filterUserBorrowingsCustom(query) {
  document.querySelectorAll("#userBorrowCardList > div.borrow-card").forEach(card => {
    card.style.display = card.innerText.toLowerCase().includes(query) ? "flex" : "none";
  });
}

function switchAdminPanel(panelName) {
  const btnUsers = document.getElementById("tabBtnAdminUsers"), btnRegister = document.getElementById("tabBtnAdminRegister"), btnLogs = document.getElementById("tabBtnAdminLogs");
  const panelUsers = document.getElementById("panelAdminUsers"), panelRegister = document.getElementById("panelAdminRegister"), panelLogs = document.getElementById("panelAdminLogs");

  [btnUsers, btnRegister, btnLogs].forEach(b => { if (b) b.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition text-slate-400 hover:text-app hover:bg-white/5 flex items-center justify-center gap-1"; });
  [panelUsers, panelRegister, panelLogs].forEach(p => { if (p) p.classList.add("hidden"); });

  if (panelName === 'users' && panelUsers) { panelUsers.classList.remove("hidden"); btnUsers.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'register' && panelRegister) { panelRegister.classList.remove("hidden"); btnRegister.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'logs' && panelLogs) { panelLogs.classList.remove("hidden"); btnLogs.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }

  updateIcons();
}

function switchStaffPanel(panelName) {
  const btnPosting = document.getElementById("tabBtnPosting"), btnDaftar = document.getElementById("tabBtnDaftar"), btnBuku = document.getElementById("tabBtnBuku"), btnStatus = document.getElementById("tabBtnStatus");
  const panelPosting = document.getElementById("panelPosting"), panelDaftar = document.getElementById("panelDaftar"), panelBuku = document.getElementById("panelBuku"), panelStatus = document.getElementById("panelStatus");

  [btnPosting, btnDaftar, btnBuku, btnStatus].forEach(b => { if (b) b.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition text-slate-400 hover:text-app hover:bg-white/5 flex items-center justify-center gap-1"; });
  [panelPosting, panelDaftar, panelBuku, panelStatus].forEach(p => { if (p) p.classList.add("hidden"); });

  if (panelName === 'posting' && panelPosting) { panelPosting.classList.remove("hidden"); btnPosting.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'daftar' && panelDaftar) { panelDaftar.classList.remove("hidden"); btnDaftar.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'buku' && panelBuku) { panelBuku.classList.remove("hidden"); btnBuku.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }
  else if (panelName === 'status' && panelStatus) { panelStatus.classList.remove("hidden"); btnStatus.className = "py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition bg-[#5288c1] text-white flex items-center justify-center gap-1 shadow"; }

  updateIcons();
}

function clearAllListeners() {
  if (unsubscribeBorrowings) { unsubscribeBorrowings(); unsubscribeBorrowings = null; }
  if (unsubscribeBooks) { unsubscribeBooks(); unsubscribeBooks = null; }
  if (unsubscribePosts) { unsubscribePosts(); unsubscribePosts = null; }
  if (unsubscribeNotifs) { unsubscribeNotifs(); unsubscribeNotifs = null; }
}

auth.onAuthStateChanged(async (user) => {
  clearAllListeners();
  if (user) {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("appContainer").classList.remove("hidden");
    document.getElementById("appContainer").classList.add("flex");

    try {
      const configDoc = await db.collection("settings").doc("circulation").get();
      if (configDoc.exists) {
        MAX_PINJAM = configDoc.data().maxPinjam || 3;
        LAMA_PINJAM_HARI = configDoc.data().lamaPinjam || 7;
      }

      await loadITPostSettings();

      const userRef = db.collection("users").doc(user.uid);
      const doc = await userRef.get();

      if (doc.exists) {
        currentUserData = doc.data();
        if (currentUserData.theme) applyTheme(currentUserData.theme);
        if (!currentUserData.memberId) {
          const autoId = generateMemberId();
          await userRef.set({ memberId: autoId }, { merge: true });
          currentUserData.memberId = autoId;
        }
        setupUserUI(user, currentUserData);
      } else {
        const autoId = generateMemberId();
        currentUserData = { role: "peminjam", email: user.email, displayName: cleanText(user.email.split('@')[0]), memberId: autoId };
        await userRef.set(currentUserData);
        setupUserUI(user, currentUserData);
      }
    } catch (err) { console.error("Err Auth:", err); }
  } else {
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("appContainer").classList.add("hidden");
  }
  updateIcons();
});

function setupUserUI(user, userData) {
  const name = cleanText(userData.displayName || user.email.split('@')[0]);
  const email = user.email || 'user@email.com';
  
  document.getElementById("sidebarUserName").innerText = name;
  document.getElementById("userRoleBadge").innerText = (userData.role || 'peminjam').toUpperCase();

  if (document.getElementById("headerUserDisplayName")) document.getElementById("headerUserDisplayName").innerText = name;
  if (document.getElementById("headerUserEmail")) document.getElementById("headerUserEmail").innerText = email;
  if (document.getElementById("profileViewName")) document.getElementById("profileViewName").innerText = name;
  if (document.getElementById("profileViewEmail")) document.getElementById("profileViewEmail").innerText = email;

  const avatarImg = document.getElementById("userAvatarImg"), avatarText = document.getElementById("userAvatarText");
  const headerAvatarImg = document.getElementById("headerAvatarImg"), headerAvatarText = document.getElementById("headerAvatarText");

  if (userData.avatarBase64) {
    avatarImg.src = userData.avatarBase64; headerAvatarImg.src = userData.avatarBase64;
    avatarImg.classList.remove("hidden"); headerAvatarImg.classList.remove("hidden");
    avatarText.classList.add("hidden"); headerAvatarText.classList.add("hidden");
  } else {
    avatarImg.classList.add("hidden"); headerAvatarImg.classList.add("hidden");
    avatarText.classList.remove("hidden"); headerAvatarText.classList.remove("hidden");
    const init = name.substring(0, 2).toUpperCase();
    avatarText.innerText = init; headerAvatarText.innerText = init;
  }

  const role = userData.role;
  document.getElementById("menuAdminIT").classList.add("hidden");
  document.getElementById("menuStaff").classList.add("hidden");
  document.getElementById("mobileNavAdmin").classList.add("hidden");
  document.getElementById("mobileNavStaff").classList.add("hidden");

  const warningBanner = document.getElementById("profileWarningBanner");
  if (role === "peminjam") {
    if (warningBanner) warningBanner.classList.toggle("hidden", checkUserProfileComplete(userData));
  } else {
    if (warningBanner) warningBanner.classList.add("hidden");
  }

  const staffSettingsBox = document.getElementById("staffCirculationSettings");
  if (staffSettingsBox) staffSettingsBox.classList.toggle("hidden", !(role === "staff" || role === "admin_it"));

  if (role === "admin_it") {
    document.getElementById("menuAdminIT").classList.remove("hidden");
    document.getElementById("mobileNavAdmin").classList.remove("hidden");
    loadLogs(); loadUserListAdmin(); calculateDatabaseUsage();
  } else if (role === "staff") {
    document.getElementById("menuStaff").classList.remove("hidden");
    document.getElementById("mobileNavStaff").classList.remove("hidden");
    loadBooksStaff(); loadBorrowingsStaff(); loadStaffPostsList();
  }

  loadPeminjamView();
  loadPostsCarouselRealtime();
  syncNotificationsRealtime();
  switchTab('dashboardPeminjam');
  checkAndShowNotificationPrompt();
}

function checkAndShowNotificationPrompt() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      const modal = document.getElementById("permissionNotifModal");
      if (modal) modal.classList.remove("hidden");
      updateIcons();
    }, 1500);
  }
}

function closePermissionNotifModal() {
  const modal = document.getElementById("permissionNotifModal");
  if (modal) modal.classList.add("hidden");
}

async function acceptWebNotificationPermission() {
  closePermissionNotifModal();
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showToastNotification("Notifikasi Aktif", "Notifikasi perangkat berhasil diaktifkan!");
      }
    } catch (err) {
      console.error("Gagal meminta izin notifikasi:", err);
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    createLog("LOGIN", `User ${email} login.`);
  } catch (err) { 
    showToastNotification("Login Gagal", "Email atau password yang Anda masukkan salah."); 
  }
}

function logout() {
  if (html5QrCodeStaff) { html5QrCodeStaff.stop().then(() => html5QrCodeStaff.clear()).catch(() => {}); html5QrCodeStaff = null; }
  if (html5QrCodeUser) { html5QrCodeUser.stop().then(() => html5QrCodeUser.clear()).catch(() => {}); html5QrCodeUser = null; }
  if (html5QrCodeVerify) { html5QrCodeVerify.stop().then(() => html5QrCodeVerify.clear()).catch(() => {}); html5QrCodeVerify = null; }

  closeResetPasswordModal();
  clearAllListeners();
  if (auth.currentUser) createLog("LOGOUT", `User ${auth.currentUser.email} logout.`);
  auth.signOut();
}

function loadUserProfileForm() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection("users").doc(user.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById("settingDisplayName").value = cleanText(data.displayName || "");
      document.getElementById("settingPhoneNumber").value = data.phoneNumber || "";
      document.getElementById("settingMemberId").value = data.memberId || generateMemberId();
      document.getElementById("settingAddress").value = data.address || "";
      document.getElementById("settingMaxPinjam").value = MAX_PINJAM;
      document.getElementById("settingLamaPinjam").value = LAMA_PINJAM_HARI;

      const previewContainer = document.getElementById("settingsAvatarPreview");
      if (data.avatarBase64) {
        currentAvatarBase64 = data.avatarBase64;
        previewContainer.innerHTML = `<img src="${data.avatarBase64}" class="w-full h-full object-cover rounded-full" />`;
      } else { previewContainer.innerHTML = `<i data-feather="user" class="w-6 h-6 text-slate-400"></i>`; }

      const isComplete = checkUserProfileComplete(data);
      const statusBadge = document.getElementById("profileStatusBadge");
      if (statusBadge) {
        statusBadge.className = isComplete ? "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse";
        statusBadge.innerText = isComplete ? "Lengkap" : "Belum Lengkap";
      }
    }
  });
  updateIcons();
}

function openResetPasswordModal() {
  document.getElementById("modalNewPassword").value = "";
  document.getElementById("modalConfirmPassword").value = "";
  document.getElementById("resetPasswordModal").classList.remove("hidden");
  updateIcons();
}

function closeResetPasswordModal() { document.getElementById("resetPasswordModal").classList.add("hidden"); }

async function handleResetPassword(e) {
  e.preventDefault();
  const user = auth.currentUser;
  const pass1 = document.getElementById("modalNewPassword").value;
  const pass2 = document.getElementById("modalConfirmPassword").value;
  if (pass1 !== pass2) { showToastNotification("Peringatan", "Konfirmasi password tidak cocok!"); return; }
  if (pass1.length < 6) { showToastNotification("Peringatan", "Password minimal 6 karakter!"); return; }

  try {
    await user.updatePassword(pass1);
    createLog("CHANGE_PASSWORD", `User ${user.email} mengubah password.`);
    showToastNotification("Berhasil", "Password akun berhasil diperbarui!");
    closeResetPasswordModal();
  } catch (err) { showToastNotification("Gagal", "Gagal ubah password: " + err.message); }
}

async function previewAvatarImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    currentAvatarBase64 = await compressImage(file, 200, 0.7);
    document.getElementById("settingsAvatarPreview").innerHTML = `<img src="${currentAvatarBase64}" class="w-full h-full object-cover rounded-full" />`;
  } catch (e) {}
}

async function saveUserSettings() {
  const user = auth.currentUser;
  if (!user) return;

  const displayName = cleanText(document.getElementById("settingDisplayName").value);
  const phoneNumber = document.getElementById("settingPhoneNumber").value.trim();
  const memberId = document.getElementById("settingMemberId").value.trim() || generateMemberId();
  const address = document.getElementById("settingAddress").value.trim();

  if (!displayName || !phoneNumber || !memberId || !address) {
    showToastNotification("Data Belum Lengkap", "Semua kolom kelengkapan profil wajib diisi!");
    return;
  }

  try {
    const payload = { displayName, phoneNumber, memberId, address };
    if (currentAvatarBase64) payload.avatarBase64 = currentAvatarBase64;
    if (currentCustomAudioBase64) payload.customAudioBase64 = currentCustomAudioBase64;

    await db.collection("users").doc(user.uid).set(payload, { merge: true });

    if (currentUserData?.role === "staff" || currentUserData?.role === "admin_it") {
      const maxPinjamVal = parseInt(document.getElementById("settingMaxPinjam").value) || 3;
      const lamaPinjamVal = parseInt(document.getElementById("settingLamaPinjam").value) || 7;
      await db.collection("settings").doc("circulation").set({ maxPinjam: maxPinjamVal, lamaPinjam: lamaPinjamVal }, { merge: true });
      MAX_PINJAM = maxPinjamVal; LAMA_PINJAM_HARI = lamaPinjamVal;
    }

    showToastNotification("Berhasil Disimpan", "Pengaturan profil Anda berhasil diperbarui!");
    const updatedDoc = await db.collection("users").doc(user.uid).get();
    setupUserUI(user, updatedDoc.data());
  } catch (err) { showToastNotification("Gagal", "Gagal menyimpan: " + err.message); }
}

function openTagBookModal() {
  const container = document.getElementById("tagBookListContainer");
  if (!container) return;
  container.innerHTML = "";
  const booksList = Object.values(booksCacheMap);
  if (booksList.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">Belum ada data buku.</p>`;
  } else {
    booksList.forEach(b => {
      const isChecked = selectedTagKodes.includes(b.kode);
      container.innerHTML += `
        <label class="tag-book-item cursor-pointer block" onclick="toggleBookTagSelection('${b.kode}')">
          <div class="p-3 rounded-xl border ${isChecked ? 'border-[#5288c1] bg-[#5288c1]/10' : 'border-card-border bg-input'} hover:border-[#5288c1]/50 flex items-center justify-between transition">
            <div class="truncate">
              <h5 class="text-xs font-bold text-app truncate">${b.title}</h5>
              <p class="text-[10px] text-slate-400 font-mono">[${b.kode}] ${b.author ? '• ' + b.author : ''}</p>
            </div>
            <span class="w-5 h-5 rounded-full border ${isChecked ? 'border-[#5288c1] bg-[#5288c1] text-white' : 'border-slate-600 bg-transparent'} flex items-center justify-center shrink-0 transition">
              ${isChecked ? '<i data-feather="check" class="w-3.5 h-3.5"></i>' : ''}
            </span>
          </div>
        </label>`;
    });
  }
  document.getElementById("searchTagBookInput").value = "";
  document.getElementById("tagBookModal").classList.remove("hidden");
  updateIcons();
}

function toggleBookTagSelection(kode) {
  if (selectedTagKodes.includes(kode)) {
    selectedTagKodes = selectedTagKodes.filter(k => k !== kode);
  } else {
    selectedTagKodes.push(kode);
  }
  openTagBookModal();
  renderSelectedTagsPreview();
}

function closeTagBookModal() { document.getElementById("tagBookModal").classList.add("hidden"); }

function filterTagBookList() {
  const query = document.getElementById("searchTagBookInput").value.toLowerCase();
  document.querySelectorAll("#tagBookListContainer > label.tag-book-item").forEach(item => {
    item.style.display = item.innerText.toLowerCase().includes(query) ? "block" : "none";
  });
}

function confirmSelectedBookTags() {
  renderSelectedTagsPreview();
  closeTagBookModal();
}

function removeTagKode(kode) {
  selectedTagKodes = selectedTagKodes.filter(k => k !== kode);
  renderSelectedTagsPreview();
}

function renderSelectedTagsPreview() {
  const container = document.getElementById("postSelectedTagsContainer");
  if (!container) return;
  if (selectedTagKodes.length === 0) { container.innerHTML = ""; container.classList.add("hidden"); return; }

  container.classList.remove("hidden");
  container.innerHTML = selectedTagKodes.map(kode => {
    const book = Object.values(booksCacheMap).find(b => b.kode === kode);
    return `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#5288c1]/20 border border-[#5288c1]/40 text-[#5288c1] rounded-xl text-xs font-bold shadow-sm">
        <span>${book ? book.title : kode}</span>
        <button type="button" onclick="removeTagKode('${kode}')" class="hover:text-rose-400 p-0.5"><i data-feather="x" class="w-3 h-3"></i></button>
      </span>`;
  }).join('');
  updateIcons();
}

async function loadITPostSettings() {
  try {
    const doc = await db.collection("settings").doc("postsConfig").get();
    if (doc.exists) {
      const data = doc.data();
      MAX_POSTS_PER_STAFF = data.maxPostsPerStaff || 10;
      POST_EXPIRY_DAYS = data.postExpiryDays || 0;

      const inputMax = document.getElementById("settingMaxPostsPerStaff");
      const selectExpiry = document.getElementById("settingPostExpiryDays");
      if (inputMax) inputMax.value = MAX_POSTS_PER_STAFF;
      if (selectExpiry) selectExpiry.value = POST_EXPIRY_DAYS;
    }
  } catch (err) {
    console.error("Gagal memuat konfigurasi post:", err);
  }
}

async function saveITPostSettings() {
  if (currentUserData?.role !== 'admin_it') {
    showToastNotification("Akses Ditolak", "Hanya Admin IT yang berhak mengubah aturan!");
    return;
  }

  const maxVal = parseInt(document.getElementById("settingMaxPostsPerStaff").value) || 10;
  const expiryVal = parseInt(document.getElementById("settingPostExpiryDays").value) || 0;

  try {
    await db.collection("settings").doc("postsConfig").set({
      maxPostsPerStaff: maxVal,
      postExpiryDays: expiryVal
    }, { merge: true });

    MAX_POSTS_PER_STAFF = maxVal;
    POST_EXPIRY_DAYS = expiryVal;

    createLog("UPDATE_POST_CONFIG", `Admin IT mengubah max post (${maxVal}) & kadaluarsa (${expiryVal} hari).`);
    showToastNotification("Berhasil Disimpan", "Aturan batasan postingan diperbarui!");
  } catch (err) {
    showToastNotification("Gagal", "Gagal menyimpan aturan: " + err.message);
  }
}

async function addNewPostInfo(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  if (currentUserData?.role !== 'admin_it') {
    const staffPostsSnap = await db.collection("libraryPosts")
      .where("authorUid", "==", user.uid)
      .get();

    if (staffPostsSnap.size >= MAX_POSTS_PER_STAFF) {
      showToastNotification("Batas Postingan", `Maksimal postingan per Staff adalah ${MAX_POSTS_PER_STAFF} post.`);
      return;
    }
  }

  const title = document.getElementById("postInfoTitle").value.trim();
  const manualAuthor = cleanText(document.getElementById("postInfoAuthor").value);
  const desc = document.getElementById("postInfoDesc").value.trim();
  const staffAccountName = cleanText(currentUserData?.displayName || user.email.split('@')[0]);

  const postPayload = {
    title, author: manualAuthor || staffAccountName,
    postedByStaff: staffAccountName, postedByAvatar: currentUserData?.avatarBase64 || null,
    authorEmail: user.email, authorUid: user.uid,
    taggedBookKodes: selectedTagKodes, description: desc,
    type: "post",
    likesList: [],
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (newPostImageBase64) postPayload.imageUrl = newPostImageBase64;

  try {
    await db.collection("libraryPosts").add(postPayload);
    createLog("ADD_POST", `Membuat postingan info: ${title}`);
    showToastNotification("Terbit", "Postingan berhasil dipublikasikan!");
    e.target.reset(); newPostImageBase64 = null; selectedTagKodes = []; renderSelectedTagsPreview();
  } catch (err) { showToastNotification("Gagal", "Gagal publikasi: " + err.message); }
}

function loadPostsCarouselRealtime() {
  if (unsubscribePosts) unsubscribePosts();
  unsubscribePosts = db.collection("libraryPosts").orderBy("timestamp", "desc").onSnapshot(async (snapshot) => {
    activePostsList = [];
    const now = new Date();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      data.id = doc.id;

      if (POST_EXPIRY_DAYS > 0 && data.timestamp) {
        const postDate = data.timestamp.toDate();
        const diffDays = (now - postDate) / (1000 * 60 * 60 * 24);

        if (diffDays >= POST_EXPIRY_DAYS) {
          db.collection("libraryPosts").doc(doc.id).delete().catch(() => {});
          continue;
        }
      }

      activePostsList.push(data);
    }

    renderFeedPostsList();
  });
}

function filterFeedPostsList() { renderFeedPostsList(); }

function renderFeedPostsList() {
  const container = document.getElementById("feedPostContainer");
  if (!container) return;
  if (activePostsList.length === 0) { 
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6 font-medium">Belum ada postingan terbaru.</p>`; 
    return; 
  }

  const currentUser = auth.currentUser;
  const searchQuery = (document.getElementById("searchFeedPostsInput")?.value || "").toLowerCase().trim();

  const filteredPosts = activePostsList.filter(post => {
    if (searchQuery !== "") {
      const titleText = (post.title || "").toLowerCase();
      const authorText = (post.author || "").toLowerCase();
      const descText = (post.description || "").toLowerCase();
      const staffText = (post.postedByStaff || "").toLowerCase();
      return titleText.includes(searchQuery) || authorText.includes(searchQuery) || descText.includes(searchQuery) || staffText.includes(searchQuery);
    }
    return true;
  });

  if (filteredPosts.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8 font-medium">Tidak ada postingan yang sesuai pencarian.</p>`;
    return;
  }

  container.innerHTML = "";
  filteredPosts.forEach((post) => {
    const postTimeStr = timeAgo(post.timestamp);
    const staffName = cleanText(post.postedByStaff || 'Staff Perpustakaan');
    const displayAuthor = cleanText(post.author || staffName);
    const canEdit = currentUser && (post.authorEmail === currentUser.email || currentUserData?.role === 'admin_it');

    const postBadgeText = (post.type === "book") ? "BUKU" : "POST";

    let avatarHtml = `<div class="w-9 h-9 rounded-full bg-input text-[#5288c1] border border-[#5288c1]/30 flex items-center justify-center font-bold text-xs shrink-0 shadow">${staffName.substring(0, 2).toUpperCase()}</div>`;
    if (post.postedByAvatar) avatarHtml = `<img src="${post.postedByAvatar}" class="w-9 h-9 rounded-full object-cover border border-[#5288c1]/30 shrink-0 shadow" />`;

    const taggedKodes = post.taggedBookKodes || (post.taggedBookKode ? [post.taggedBookKode] : []);
    let tagBadgeContent = '';
    if (taggedKodes.length > 0) {
      const tagsHtmlArr = taggedKodes.map(kode => {
        const bookRef = Object.values(booksCacheMap).find(b => b.kode === kode);
        const bookTitle = bookRef ? bookRef.title : kode;
        const bookDocId = bookRef ? bookRef.docId : '';
        return `
          <div onclick="event.stopPropagation(); ${bookDocId ? `openBookDetailModal('${bookDocId}')` : ''}" class="inline-flex items-center gap-1.5 px-3 py-1 bg-input/80 border border-[#5288c1]/30 rounded-xl text-[11px] font-semibold text-[#5288c1] hover:bg-[#5288c1]/20 cursor-pointer transition">
            <i data-feather="book" class="w-3.5 h-3.5"></i>
            <span>${bookTitle}</span>
          </div>`;
      });
      tagBadgeContent = `<div class="flex flex-wrap gap-2 my-1">${tagsHtmlArr.join('')}</div>`;
    }

    let imageContentHtml = '';
    if (post.imageUrl) {
      imageContentHtml = `
        <div class="w-full flex justify-center bg-transparent rounded-2xl p-0 my-2">
          <div class="w-full aspect-[3/4] rounded-2xl overflow-hidden relative shadow-lg border border-card-border">
            <img src="${post.imageUrl}" class="w-full h-full object-cover" alt="Post Cover 3:4" />
          </div>
        </div>`;
    }

    const isLovedByMe = currentUser && post.likesList && post.likesList.includes(currentUser.uid);
    const loveCount = (post.likesList || []).length;

    container.innerHTML += `
      <div onclick="openReadPostModal('${post.id}')" class="bg-card border border-card-border rounded-3xl p-4 sm:p-5 space-y-2.5 shadow-md relative cursor-pointer hover:bg-white/5 active:scale-[0.99] transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            ${avatarHtml}
            <div>
              <h5 class="text-xs font-bold text-app flex items-center gap-1 leading-none">
                <span>${staffName}</span>
                <i data-feather="check-circle" class="w-3.5 h-3.5 text-[#5288c1] fill-[#5288c1]/20"></i>
              </h5>
              <p class="text-[10px] text-slate-400 mt-0.5 truncate font-normal">${post.authorEmail || 'Staff Perpustakaan'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest bg-[#5288c1]/20 text-[#5288c1] border border-[#5288c1]/30">${postBadgeText}</span>
            <span class="text-[10px] text-slate-400 font-medium">${postTimeStr}</span>
            ${canEdit ? `<button onclick="event.stopPropagation(); openEditPostModal('${post.id}')" title="Edit Postingan" class="p-1.5 bg-input hover:bg-white/10 text-[#5288c1] rounded-lg transition"><i data-feather="edit-2" class="w-3.5 h-3.5"></i></button>` : ''}
          </div>
        </div>

        <div class="pt-0.5 space-y-0.5">
          <h3 class="tiktok-title text-app">${post.title}</h3>
          <p class="tiktok-author">${displayAuthor}</p>
          <p class="tiktok-caption text-slate-300 mt-1 line-clamp-2">${post.description}</p>
        </div>

        ${tagBadgeContent}
        ${imageContentHtml}

        <div class="flex items-center justify-between pt-2.5 border-t border-card-border">
          <div class="flex items-center gap-4">
            <button onclick="event.stopPropagation(); toggleCardPostLove('${post.id}')" class="flex items-center gap-1.5 text-xs font-bold ${isLovedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'} transition active:scale-90">
              <i data-feather="heart" class="w-4 h-4 ${isLovedByMe ? 'fill-rose-500' : ''}"></i>
              <span>${loveCount}</span>
            </button>
            <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <i data-feather="message-square" class="w-4 h-4 text-[#5288c1]"></i>
              <span>Komentar</span>
            </div>
          </div>
          <span class="text-[10px] text-[#5288c1] font-semibold flex items-center gap-1">
            Klik untuk membaca <i data-feather="chevron-right" class="w-3 h-3"></i>
          </span>
        </div>
      </div>`;
  });
  updateIcons();
}

async function toggleCardPostLove(postDocId) {
  const user = auth.currentUser;
  if (!user) return;
  const post = activePostsList.find(p => p.id === postDocId);
  if (!post) return;

  const likes = post.likesList || [];
  const isLoved = likes.includes(user.uid);
  const postRef = db.collection("libraryPosts").doc(postDocId);

  try {
    if (isLoved) {
      await postRef.update({ likesList: firebase.firestore.FieldValue.arrayRemove(user.uid) });
    } else {
      await postRef.update({ likesList: firebase.firestore.FieldValue.arrayUnion(user.uid) });
    }
  } catch (err) { console.error("Gagal update love:", err); }
}

function openReadPostModal(docId) {
  const post = postsCacheMap[docId] || activePostsList.find(p => p.id === docId);
  if (!post) return;

  document.getElementById("activePostDocId").value = docId;
  document.getElementById("modalPostTitle").innerText = post.title;
  document.getElementById("modalPostAuthor").innerText = cleanText(post.author || `by ${post.postedByStaff || "Staff Perpustakaan"}`);
  document.getElementById("modalPostDescription").innerText = post.description;

  const badgeElem = document.getElementById("modalPostTypeBadge");
  if (badgeElem) badgeElem.innerText = (post.type === "book") ? "BUKU" : "POST";

  const timeBadgeText = document.getElementById("postReadTimeText");
  if (timeBadgeText) timeBadgeText.innerText = timeAgo(post.timestamp);

  const imgContainer = document.getElementById("modalPostImageContainer"), imgElem = document.getElementById("modalPostImage");
  if (post.imageUrl) { imgElem.src = post.imageUrl; imgContainer.classList.remove("hidden"); } else { imgContainer.classList.add("hidden"); }

  updateModalLoveUI(post);
  loadPostCommentsRealtime(docId);
  
  const modalElem = document.getElementById("readPostModal");
  modalElem.classList.remove("hidden");

  window.history.pushState({ modalOpen: true }, "Read Post");
  updateIcons();
}

function updateModalLoveUI(post) {
  const user = auth.currentUser;
  const countElem = document.getElementById("countPostLove");
  const iconElem = document.getElementById("iconPostLove");
  const btnLove = document.getElementById("btnPostLove");
  if (!countElem || !iconElem) return;

  const likes = post.likesList || [];
  countElem.innerText = likes.length;

  if (user && likes.includes(user.uid)) {
    btnLove.className = "flex items-center gap-1.5 text-xs font-semibold text-rose-500 transition active:scale-90";
    iconElem.setAttribute("class", "w-4 h-4 fill-rose-500");
  } else {
    btnLove.className = "flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 transition active:scale-90";
    iconElem.setAttribute("class", "w-4 h-4");
  }
}

async function togglePostLove() {
  const postDocId = document.getElementById("activePostDocId").value;
  if (!postDocId) return;
  await toggleCardPostLove(postDocId);
  const post = activePostsList.find(p => p.id === postDocId);
  if (post) updateModalLoveUI(post);
}

function closeReadPostModal() {
  const modalElem = document.getElementById("readPostModal");
  if (modalElem && !modalElem.classList.contains("hidden")) {
    modalElem.classList.add("hidden");
  }
}

// Logika Navigasi Tombol Back HP Terpadu
window.addEventListener('popstate', async (event) => {
  const readPostModal = document.getElementById("readPostModal");
  const bookDetailModal = document.getElementById("bookDetailModal");
  const cropperModal = document.getElementById("cropperModal");
  const qrModal = document.getElementById("qrApprovalModal");

  if (readPostModal && !readPostModal.classList.contains("hidden")) {
    readPostModal.classList.add("hidden");
    history.pushState(null, "", window.location.href);
    return;
  }
  if (bookDetailModal && !bookDetailModal.classList.contains("hidden")) {
    bookDetailModal.classList.add("hidden");
    history.pushState(null, "", window.location.href);
    return;
  }
  if (cropperModal && !cropperModal.classList.contains("hidden")) {
    cropperModal.classList.add("hidden");
    history.pushState(null, "", window.location.href);
    return;
  }
  if (qrModal && !qrModal.classList.contains("hidden")) {
    qrModal.classList.add("hidden");
    history.pushState(null, "", window.location.href);
    return;
  }

  const activeTab = document.querySelector('.tab-content:not(.hidden)')?.id;
  if (activeTab && activeTab !== 'dashboardPeminjam') {
    switchTab('dashboardPeminjam');
    switchBerandaPanel('info');
    history.pushState(null, "", window.location.href);
    return;
  }

  history.pushState(null, "", window.location.href);
  const exitConfirmed = await showCustomConfirm("Keluar Aplikasi", "Apakah anda ingin keluar dari pojokbaca?");
  if (exitConfirmed) {
    window.close();
  }
});

function loadPostCommentsRealtime(postDocId) {
  db.collection("libraryPosts").doc(postDocId).collection("comments").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
    const list = document.getElementById("postCommentsList");
    const countDisplay = document.getElementById("countPostComments");
    if (countDisplay) countDisplay.innerText = snapshot.size;

    if (!list) return;
    list.innerHTML = "";
    if (snapshot.empty) { 
      list.innerHTML = `<p class="text-[11px] text-slate-400 italic text-center py-2">Belum ada komentar.</p>`; 
      return; 
    }

    const currentUser = auth.currentUser;
    const canManageComment = currentUserData?.role === 'admin_it' || currentUserData?.role === 'staff';

    snapshot.forEach((doc) => {
      const c = doc.data(); 
      const commentId = doc.id;
      const text = c.text || "";
      const isLongText = text.length > 120;
      const shortText = isLongText ? text.substring(0, 120) + "..." : text;

      const likesList = c.likesList || [];
      const isLovedByMe = currentUser && likesList.includes(currentUser.uid);
      const loveCount = likesList.length;

      let actionButtons = canManageComment || (currentUser && c.userId === currentUser.uid) ? `
        <div class="flex items-center gap-1.5">
          <button onclick="openEditCommentModal('${postDocId}', '${commentId}', '${text.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-[#5288c1] p-1 transition"><i data-feather="edit-2" class="w-3 h-3"></i></button>
          <button onclick="deletePostComment('${postDocId}', '${commentId}')" class="text-slate-400 hover:text-rose-400 p-1 transition"><i data-feather="trash-2" class="w-3 h-3"></i></button>
        </div>` : '';

      list.innerHTML += `
        <div class="bg-card p-3 rounded-xl border border-card-border space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-[#5288c1]">${cleanText(c.userName) || 'Anggota'}</span>
            <div class="flex items-center gap-2">
              <span class="text-[9px] text-slate-400">${c.timestamp ? c.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}</span>
              ${actionButtons}
            </div>
          </div>

          <div class="text-xs text-app leading-relaxed">
            <span id="commentText-${commentId}">${shortText}</span>
            ${isLongText ? `<button onclick="toggleCommentExpand('${commentId}', \`${text.replace(/`/g, '\\`')}\`)" id="btnExpand-${commentId}" class="text-[#5288c1] font-semibold ml-1 hover:underline text-[11px]">Selengkapnya</button>` : ''}
          </div>

          <div class="flex items-center gap-4 pt-1">
            <button onclick="toggleCommentLove('${postDocId}', '${commentId}')" class="flex items-center gap-1 text-[11px] font-semibold ${isLovedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'} transition">
              <i data-feather="heart" class="w-3.5 h-3.5 ${isLovedByMe ? 'fill-rose-500' : ''}"></i>
              <span>${loveCount}</span>
            </button>
            <button onclick="toggleReplyBox('${commentId}')" class="text-[11px] font-semibold text-slate-400 hover:text-[#5288c1] transition flex items-center gap-1">
              <i data-feather="corner-down-right" class="w-3 h-3"></i> Balas
            </button>
          </div>

          <div id="replyBox-${commentId}" class="hidden pt-2 space-y-1.5 border-t border-card-border/40 mt-2">
            <div class="flex items-center gap-1.5">
              <input type="text" id="replyInput-${commentId}" placeholder="Tulis balasan..." class="flex-1 bg-input border border-input-border focus:border-[#5288c1] rounded-lg px-2.5 py-1 text-[11px] font-normal text-app outline-none">
              <button onclick="submitCommentReply('${postDocId}', '${commentId}')" class="px-2.5 py-1 bg-[#5288c1] text-white rounded-lg text-[10px] font-medium transition">Kirim</button>
            </div>
          </div>

          <div id="repliesList-${commentId}" class="space-y-1.5 pl-3 border-l-2 border-[#5288c1]/30 mt-2"></div>
        </div>`;

      loadCommentRepliesRealtime(postDocId, commentId);
    });
    updateIcons();
  });
}

function toggleCommentExpand(commentId, fullText) {
  const spanElem = document.getElementById(`commentText-${commentId}`);
  const btnElem = document.getElementById(`btnExpand-${commentId}`);
  const isExpanded = btnElem.innerText === "Sembunyikan";

  if (isExpanded) {
    spanElem.innerText = fullText.substring(0, 120) + "...";
    btnElem.innerText = "Selengkapnya";
  } else {
    spanElem.innerText = fullText;
    btnElem.innerText = "Sembunyikan";
  }
}

async function toggleCommentLove(postDocId, commentId) {
  const user = auth.currentUser;
  if (!user) return;
  const commentRef = db.collection("libraryPosts").doc(postDocId).collection("comments").doc(commentId);
  
  try {
    const doc = await commentRef.get();
    if (!doc.exists) return;
    const data = doc.data();
    const likesList = data.likesList || [];

    if (likesList.includes(user.uid)) {
      await commentRef.update({ likesList: firebase.firestore.FieldValue.arrayRemove(user.uid) });
    } else {
      await commentRef.update({ likesList: firebase.firestore.FieldValue.arrayUnion(user.uid) });
    }
  } catch (err) {
    console.error("Gagal menyukai komentar:", err);
  }
}

function toggleReplyBox(commentId) {
  const box = document.getElementById(`replyBox-${commentId}`);
  if (box) box.classList.toggle("hidden");
}

async function submitCommentReply(postDocId, commentId) {
  const input = document.getElementById(`replyInput-${commentId}`);
  const text = input.value.trim();
  const user = auth.currentUser;
  if (!text || !user) return;

  try {
    await db.collection("libraryPosts").doc(postDocId).collection("comments").doc(commentId).collection("replies").add({
      text,
      userId: user.uid,
      userName: cleanText(currentUserData?.displayName || user.email.split('@')[0]),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = "";
    document.getElementById(`replyBox-${commentId}`).classList.add("hidden");
  } catch (err) {
    showToastNotification("Gagal", "Gagal mengirim balasan: " + err.message);
  }
}

function loadCommentRepliesRealtime(postDocId, commentId) {
  db.collection("libraryPosts").doc(postDocId).collection("comments").doc(commentId).collection("replies").orderBy("timestamp", "asc").onSnapshot((snapshot) => {
    const repliesContainer = document.getElementById(`repliesList-${commentId}`);
    if (!repliesContainer) return;
    repliesContainer.innerHTML = "";

    snapshot.forEach(doc => {
      const r = doc.data();
      repliesContainer.innerHTML += `
        <div class="bg-input p-2 rounded-lg border border-card-border/60 space-y-0.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-[#5288c1]">${cleanText(r.userName) || 'Anggota'}</span>
            <span class="text-[8px] text-slate-400">${r.timestamp ? r.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}</span>
          </div>
          <p class="text-[11px] text-app leading-relaxed">${r.text}</p>
        </div>`;
    });
  });
}

async function submitPostComment() {
  const postDocId = document.getElementById("activePostDocId").value;
  const input = document.getElementById("postCommentInput");
  const text = input.value.trim();
  const user = auth.currentUser;
  if (!postDocId || !text || !user) return;

  try {
    await db.collection("libraryPosts").doc(postDocId).collection("comments").add({
      text, 
      userId: user.uid, 
      userName: cleanText(currentUserData?.displayName || user.email.split('@')[0]),
      likesList: [],
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = "";
  } catch (err) { showToastNotification("Gagal", "Gagal kirim komentar: " + err.message); }
}

let activePostDocIdForComment = null;
function openEditCommentModal(postDocId, commentDocId, currentText) {
  activePostDocIdForComment = postDocId;
  document.getElementById("editCommentDocId").value = commentDocId;
  document.getElementById("editCommentInputText").value = currentText;
  document.getElementById("editCommentModal").classList.remove("hidden");
}
function closeEditCommentModal() { document.getElementById("editCommentModal").classList.add("hidden"); }

async function saveEditComment() {
  const commentDocId = document.getElementById("editCommentDocId").value;
  const newText = document.getElementById("editCommentInputText").value.trim();
  if (!activePostDocIdForComment || !commentDocId || !newText) return;

  try {
    await db.collection("libraryPosts").doc(activePostDocIdForComment).collection("comments").doc(commentDocId).update({ text: newText });
    showToastNotification("Berhasil", "Komentar diperbarui!");
    closeEditCommentModal();
  } catch (err) { showToastNotification("Gagal", "Gagal update komentar: " + err.message); }
}

async function deletePostComment(postDocId, commentDocId) {
  const confirmed = await showCustomConfirm("Hapus Komentar", "Apakah Anda yakin ingin menghapus komentar ini?");
  if (!confirmed) return;

  try {
    await db.collection("libraryPosts").doc(postDocId).collection("comments").doc(commentDocId).delete();
    showToastNotification("Dihapus", "Komentar berhasil dihapus.");
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus: " + err.message); }
}

function loadStaffPostsList() {
  db.collection("libraryPosts").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    const container = document.getElementById("staffPostCardList");
    if (!container) return;
    container.innerHTML = ""; postsCacheMap = {};
    if (snapshot.empty) { container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada postingan info.</p>`; return; }

    const currentUser = auth.currentUser;
    snapshot.forEach((doc) => {
      const data = doc.data(); data.id = doc.id; postsCacheMap[doc.id] = data;
      const isOwner = !data.authorEmail || (currentUser && data.authorEmail === currentUser.email);
      const isAdmin = currentUserData?.role === 'admin_it';

      if (isOwner || isAdmin) {
        container.innerHTML += `
          <div onclick="openEditPostModal('${doc.id}')" class="post-card bg-input border border-card-border hover:border-[#5288c1]/50 p-3 rounded-xl flex items-center justify-between shadow-sm gap-3 transition cursor-pointer group">
            <div class="flex items-center gap-3 overflow-hidden">
              ${data.imageUrl ? `<img src="${data.imageUrl}" class="w-12 h-12 object-cover rounded-lg shrink-0 border border-card-border" />` : `<div class="w-10 h-10 rounded-lg bg-card border border-card-border flex items-center justify-center shrink-0 text-[#5288c1]"><i data-feather="image" class="w-4 h-4"></i></div>`}
              <div class="truncate">
                <h5 class="text-xs font-bold text-app truncate group-hover:text-[#5288c1] transition">${data.title}</h5>
                <p class="text-[10px] text-slate-400 truncate">${cleanText(data.author) || 'Staff'}</p>
              </div>
            </div>
            <button onclick="event.stopPropagation(); deletePostInfo('${doc.id}', '${data.title.replace(/'/g, "\\'")}')" class="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0" title="Hapus Postingan">
              <i data-feather="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>`;
      }
    });
    updateIcons();
  });
}

function filterStaffPostsList() {
  const query = document.getElementById("searchStaffPostsInput").value.toLowerCase();
  document.querySelectorAll("#staffPostCardList > div.post-card").forEach(card => {
    card.style.display = card.innerText.toLowerCase().includes(query) ? "flex" : "none";
  });
}

function openEditPostModal(docId) {
  const post = postsCacheMap[docId];
  if (!post) return;
  document.getElementById("editPostDocId").value = docId;
  document.getElementById("editPostTitle").value = post.title || "";
  document.getElementById("editPostAuthor").value = cleanText(post.author) || "";
  document.getElementById("editPostDesc").value = post.description || "";
  editPostImageBase64 = null;
  document.getElementById("editPostModal").classList.remove("hidden");
  updateIcons();
}

function closeEditPostModal() { document.getElementById("editPostModal").classList.add("hidden"); }

async function updatePostInfo(e) {
  e.preventDefault();
  const docId = document.getElementById("editPostDocId").value;
  if (!docId) return;

  const updatePayload = {
    title: document.getElementById("editPostTitle").value.trim(),
    author: cleanText(document.getElementById("editPostAuthor").value),
    description: document.getElementById("editPostDesc").value.trim()
  };
  if (editPostImageBase64) updatePayload.imageUrl = editPostImageBase64;

  try {
    await db.collection("libraryPosts").doc(docId).update(updatePayload);
    createLog("UPDATE_POST", `Memperbarui postingan: ${updatePayload.title}`);
    showToastNotification("Diperbarui", "Perubahan postingan berhasil disimpan.");
    closeEditPostModal();
  } catch (err) { showToastNotification("Gagal", "Gagal update postingan: " + err.message); }
}

async function deletePostInfo(docId, title) {
  const confirmed = await showCustomConfirm("Hapus Postingan", `Apakah Anda yakin ingin menghapus postingan "${title}"?`);
  if (!confirmed) return;

  try {
    await db.collection("libraryPosts").doc(docId).delete();
    createLog("DELETE_POST", `Menghapus postingan: ${title}`);
    showToastNotification("Dihapus", "Postingan berhasil dihapus.");
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus: " + err.message); }
}

async function deleteAllPostsByAdmin() {
  if (currentUserData?.role !== 'admin_it') {
    showToastNotification("Akses Ditolak", "Hanya Admin IT yang dapat menghapus semua postingan!");
    return;
  }

  const confirmed = await showCustomConfirm(
    "HAPUS SEMUA POSTINGAN", 
    "Apakah Anda YAKIN ingin menghapus SELURUH postingan di sistem secara permanen?"
  );
  if (!confirmed) return;

  try {
    const snap = await db.collection("libraryPosts").get();
    const batch = db.batch();

    snap.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    createLog("DELETE_ALL_POSTS", `Admin IT menghapus seluruh postingan (${snap.size} post).`);
    showToastNotification("Berhasil", "Semua postingan berhasil dibersihkan!");
  } catch (err) {
    showToastNotification("Gagal", "Gagal menghapus postingan: " + err.message);
  }
}

function toggleStaffScanner() {
  const container = document.getElementById("staffReaderContainer"), btn = document.getElementById("btnStaffScanner"), icon = document.getElementById("iconStaffScanner"), label = document.getElementById("labelStaffScanner");
  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden");
    btn.className = "px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition shadow-md active:scale-95 flex items-center gap-1.5 shrink-0";
    icon.setAttribute("data-feather", "x"); label.innerText = "Tutup"; updateIcons();
    html5QrCodeStaff = new Html5Qrcode("staffReader");
    html5QrCodeStaff.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 160 } }, (decodedText) => {
      document.getElementById("bookKode").value = decodedText; toggleStaffScanner(); showToastNotification("Scan Berhasil", `Kode: ${decodedText}`);
    }, () => {}).catch(err => { showToastNotification("Gagal Kamera", err); toggleStaffScanner(); });
  } else {
    if (html5QrCodeStaff) html5QrCodeStaff.stop().then(() => html5QrCodeStaff.clear()).catch(() => {});
    container.classList.add("hidden");
    btn.className = "px-3.5 py-1.5 bg-gradient-to-r from-[#5288c1] to-[#3a6fa0] text-white font-semibold rounded-xl text-xs transition shadow-md active:scale-95 flex items-center gap-1.5 shrink-0";
    icon.setAttribute("data-feather", "camera"); label.innerText = "Scan Kode"; updateIcons();
  }
}

function toggleUserScanner() {
  const container = document.getElementById("userReaderContainer"), btn = document.getElementById("btnUserScanner"), icon = document.getElementById("iconUserScanner"), label = document.getElementById("labelUserScanner");
  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden");
    btn.className = "w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-[10px] transition shadow flex items-center justify-center gap-1.5 shrink-0";
    icon.setAttribute("data-feather", "x"); label.innerText = "Tutup Scanner"; updateIcons();
    html5QrCodeUser = new Html5Qrcode("userReader");
    html5QrCodeUser.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 160 } }, (decodedText) => {
      document.getElementById("searchFeedPostsInput").value = decodedText; handleUniversalSearch(); toggleUserScanner();
    }, () => {}).catch(err => { showToastNotification("Gagal Kamera", err); toggleUserScanner(); });
  } else {
    if (html5QrCodeUser) html5QrCodeUser.stop().then(() => html5QrCodeUser.clear()).catch(() => {});
    container.classList.add("hidden");
    btn.className = "w-full py-2 bg-gradient-to-r from-[#5288c1] to-[#3a6fa0] text-white font-medium rounded-xl text-[10px] transition shadow flex items-center justify-center gap-1.5 shrink-0";
    icon.setAttribute("data-feather", "camera"); label.innerText = "Scan Kode"; updateIcons();
  }
}

function toggleVerifyScanner() {
  const container = document.getElementById("verifyReaderContainer"), btn = document.getElementById("btnVerifyScanner");
  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden");
    btn.className = "py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 border border-rose-500/40 shadow-md";
    btn.innerHTML = `<i data-feather="x" class="w-4 h-4 text-white"></i> <span>Tutup</span>`;
    html5QrCodeVerify = new Html5Qrcode("verifyReader");
    html5QrCodeVerify.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 160 } }, (decodedText) => {
      document.getElementById("staffVerifyCodeInput").value = decodedText; verifyBorrowCode(decodedText); toggleVerifyScanner();
    }, () => {}).catch(err => { showToastNotification("Gagal Kamera", err); toggleVerifyScanner(); });
  } else {
    if (html5QrCodeVerify) html5QrCodeVerify.stop().then(() => html5QrCodeVerify.clear()).catch(() => {});
    container.classList.add("hidden");
    btn.className = "py-2.5 bg-[#5288c1] hover:bg-[#4676a9] text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 border border-[#5288c1]/40";
    btn.innerHTML = `<i data-feather="camera" class="w-4 h-4 text-white"></i> <span>Scan QR</span>`;
    updateIcons();
  }
}

async function addBook(e) {
  e.preventDefault();
  const user = auth.currentUser;
  const kode = document.getElementById("bookKode").value;
  const title = document.getElementById("bookTitle").value;
  const author = document.getElementById("bookAuthor").value;
  const category = document.getElementById("bookCategory").value;
  const stock = parseInt(document.getElementById("bookStock").value);
  const synopsis = document.getElementById("bookSynopsis").value.trim();

  const newBookPayload = {
    kode, title, author, category, stock,
    synopsis: synopsis || "Belum ada sinopsis singkat untuk buku ini.",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (currentBookCoverBase64) newBookPayload.coverBase64 = currentBookCoverBase64;

  try {
    await db.collection("books").add(newBookPayload);
    const staffAccountName = cleanText(currentUserData?.displayName || user.email.split('@')[0]);

    await db.collection("libraryPosts").add({
      title: title, author: `Karya: ${author}`,
      postedByStaff: staffAccountName, postedByAvatar: currentUserData?.avatarBase64 || null,
      authorEmail: user.email, authorUid: user.uid, taggedBookKodes: [kode],
      description: synopsis || `Kini hadir buku terbaru "${title}" karya ${author} di koleksi perpustakaan. Mari pinjam dan baca sekarang juga!`,
      imageUrl: currentBookCoverBase64 || null, 
      type: "book",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    createLog("ADD_BOOK", `Buku baru [${kode}] ${title}`);
    sendSystemNotification("Buku Baru Tersedia!", `Buku "${title}" karya ${author} telah ditambahkan ke katalog.`, "siaran");
    showToastNotification("Berhasil", "Data buku & postingan feed berhasil ditambahkan!");
    e.target.reset(); currentBookCoverBase64 = null;
  } catch (err) { showToastNotification("Gagal", "Gagal menambah buku: " + err.message); }
}

async function createBorrowerUser(e) {
  e.preventDefault();
  const email = document.getElementById("newBorrowerEmail").value.trim();
  const pass = document.getElementById("newBorrowerPassword").value.trim();
  if (pass.length < 6) { showToastNotification("Peringatan", "Password minimal 6 karakter!"); return; }

  try {
    let secondaryApp = firebase.apps.find(app => app.name === "SecondaryApp") || firebase.initializeApp(firebaseConfig, "SecondaryApp");
    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
    await secondaryApp.auth().signOut();
    await secondaryApp.delete();

    const autoId = generateMemberId();
    await db.collection("users").doc(userCredential.user.uid).set({
      email: email, role: "peminjam", displayName: cleanText(email.split('@')[0]),
      memberId: autoId, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    createLog("CREATE_USER", `Staff (${auth.currentUser.email}) mendaftarkan peminjam baru: ${email}`);
    showToastNotification("Akun Berhasil Dibuat", `Akun peminjam [${email}] terdaftar! ID: ${autoId}`);
    e.target.reset();
  } catch (err) { showToastNotification("Gagal", "Gagal membuat akun peminjam: " + err.message); }
}

function openEditBookModal(docId) {
  const book = booksCacheMap[docId];
  if (!book) return;
  document.getElementById("editBookDocId").value = docId;
  document.getElementById("editBookKode").value = book.kode || "";
  document.getElementById("editBookTitle").value = book.title || "";
  document.getElementById("editBookAuthor").value = book.author || "";
  document.getElementById("editBookCategory").value = book.category || "";
  document.getElementById("editBookSynopsis").value = book.synopsis || book.description || "";
  editBookCoverBase64 = null;
  document.getElementById("editBookModal").classList.remove("hidden");
  updateIcons();
}

function closeEditBookModal() { document.getElementById("editBookModal").classList.add("hidden"); }

async function updateBook(e) {
  e.preventDefault();
  const docId = document.getElementById("editBookDocId").value;
  if (!docId) return;

  const updatePayload = {
    kode: document.getElementById("editBookKode").value,
    title: document.getElementById("editBookTitle").value,
    author: document.getElementById("editBookAuthor").value,
    category: document.getElementById("editBookCategory").value,
    synopsis: document.getElementById("editBookSynopsis").value.trim()
  };
  if (editBookCoverBase64) updatePayload.coverBase64 = editBookCoverBase64;

  try {
    await db.collection("books").doc(docId).update(updatePayload);
    createLog("UPDATE_BOOK", `Memperbarui buku [${updatePayload.kode}] ${updatePayload.title}`);
    showToastNotification("Diperbarui", "Data buku berhasil diperbarui.");
    closeEditBookModal();
  } catch (err) { showToastNotification("Gagal", "Gagal update data buku: " + err.message); }
}

async function deleteBook() {
  const docId = document.getElementById("editBookDocId").value;
  const book = booksCacheMap[docId];
  if (!docId || !book) return;

  const confirmed = await showCustomConfirm("Hapus Buku", `Apakah Anda yakin ingin menghapus buku "${book.title}" [${book.kode}]?`);
  if (!confirmed) return;

  try {
    await db.collection("books").doc(docId).delete();
    createLog("DELETE_BOOK", `Menghapus buku [${book.kode}] ${book.title}`);
    showToastNotification("Dihapus", "Data buku telah dihapus.");
    closeEditBookModal();
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus buku: " + err.message); }
}

function loadBooksStaff() {
  db.collection("books").onSnapshot((snapshot) => {
    const tbody = document.getElementById("bookTableBody");
    if (tbody) tbody.innerHTML = "";
    booksCacheMap = {};
    snapshot.forEach((doc) => {
      const data = doc.data(); data.docId = doc.id; booksCacheMap[doc.id] = data;
      if (tbody) {
        tbody.innerHTML += `
          <tr onclick="openEditBookModal('${doc.id}')" class="book-row hover:bg-white/5 transition cursor-pointer group">
            <td class="p-2.5 font-mono font-bold text-[#5288c1] group-hover:underline">${data.kode}</td>
            <td class="p-2.5 font-medium text-app flex items-center gap-2">
              ${data.coverBase64 ? `<img src="${data.coverBase64}" class="w-6 aspect-[3/4] object-cover rounded shrink-0" />` : ''}
              <span>${data.title}</span>
            </td>
            <td class="p-2.5 font-bold ${data.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}">${data.stock}</td>
          </tr>`;
      }
    });
  });
}

function filterStaffStockBooks() {
  const query = document.getElementById("searchStaffStockInput").value.toLowerCase();
  document.querySelectorAll("#bookTableBody > tr.book-row").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
  });
}

function loadBorrowingsStaff() {
  db.collection("borrowings").onSnapshot((snapshot) => {
    const tbody = document.getElementById("staffBorrowTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
      const b = doc.data();
      let actionBtn = `<span class="text-slate-400">-</span>`;
      if (b.status === "Menunggu Persetujuan") actionBtn = `<button onclick="approveBorrowByDocId('${doc.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-2.5 py-1 rounded-xl text-[11px] transition shadow">Setujui</button>`;
      else if (b.status === "Menunggu Pengembalian") actionBtn = `<button onclick="approveReturnByDocId('${doc.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded-xl text-[11px] transition shadow">Terima Kembali</button>`;
      else if (b.status === "Dipinjam") actionBtn = `<span class="text-emerald-400 text-[10px] font-bold">Aktif Dipinjam</span>`;
      else if (b.status === "Dikembalikan") actionBtn = `<span class="text-slate-400 text-[10px] font-bold">Selesai</span>`;

      let statusBadge = `bg-input text-slate-400 border border-card-border`;
      if (b.status === 'Menunggu Persetujuan') statusBadge = `bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse`;
      if (b.status === 'Menunggu Pengembalian') statusBadge = `bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse`;
      if (b.status === 'Dipinjam') statusBadge = `bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`;
      if (b.status === 'Dikembalikan') statusBadge = `bg-input text-slate-400 border border-card-border`;

      tbody.innerHTML += `
        <tr class="borrow-table-row hover:bg-white/5 transition">
          <td class="p-2.5 text-slate-300 truncate max-w-[100px]">${b.userEmail}</td>
          <td class="p-2.5 font-mono text-app">
            <span class="text-[#5288c1] font-bold block">${b.pinKode || b.returnKode || '-'}</span>
            <span class="text-[10px] text-slate-400">${b.bookKode}</span>
          </td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusBadge}">${b.status}</span></td>
          <td class="p-2.5 text-right">${actionBtn}</td>
        </tr>`;
    });
  });
}

function filterStaffBorrowTable() {
  const query = document.getElementById("searchStaffBorrowTableInput").value.toLowerCase();
  document.querySelectorAll("#staffBorrowTableBody > tr.borrow-table-row").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
  });
}

function verifyBorrowCodeFromInput() {
  const code = document.getElementById("staffVerifyCodeInput").value.trim();
  if (!code) { showToastNotification("Peringatan", "Masukkan kode verifikasi terlebih dahulu!"); return; }
  verifyBorrowCode(code);
}

async function verifyBorrowCode(codeStr) {
  try {
    let snap = await db.collection("borrowings").where("pinKode", "==", codeStr).get();
    if (!snap.empty) { await approveBorrowByDocId(snap.docs[0].id); document.getElementById("staffVerifyCodeInput").value = ""; return; }
    snap = await db.collection("borrowings").where("returnKode", "==", codeStr).get();
    if (!snap.empty) { await approveReturnByDocId(snap.docs[0].id); document.getElementById("staffVerifyCodeInput").value = ""; return; }
    showToastNotification("Gagal", `Kode verifikasi [${codeStr}] tidak ditemukan!`);
  } catch (err) { showToastNotification("Gagal", "Gagal verifikasi kode: " + err.message); }
}

async function approveBorrowByDocId(borrowDocId) {
  try {
    const borrowDoc = await db.collection("borrowings").doc(borrowDocId).get();
    if (!borrowDoc.exists) return;
    const bData = borrowDoc.data();

    const bookSnap = await db.collection("books").where("kode", "==", bData.bookKode).get();
    if (!bookSnap.empty) {
      const bookDoc = bookSnap.docs[0];
      if ((bookDoc.data().stock || 0) <= 0) { showToastNotification("Stok Habis", "Stok buku sudah habis!"); return; }
      await db.collection("books").doc(bookDoc.id).update({ stock: firebase.firestore.FieldValue.increment(-1) });
    }

    await db.collection("borrowings").doc(borrowDocId).update({ status: "Dipinjam" });
    sendSystemNotification("Pengambilan Disetujui", `Buku [${bData.bookKode}] disetujui staff. Jatuh tempo: ${bData.dueDate}`, "sistem", bData.userId);
    createLog("APPROVE_BORROW", `Menyetujui pinjam [${bData.pinKode}] untuk ${bData.userEmail}`);
    showToastNotification("Disetujui", `Permohonan [${bData.pinKode}] berhasil disetujui!`);
  } catch (err) { showToastNotification("Gagal", "Gagal menyetujui: " + err.message); }
}

async function approveReturnByDocId(borrowDocId) {
  try {
    const borrowDoc = await db.collection("borrowings").doc(borrowDocId).get();
    if (!borrowDoc.exists) return;
    const bData = borrowDoc.data();

    await db.collection("borrowings").doc(borrowDocId).update({ status: "Dikembalikan" });
    const bookSnap = await db.collection("books").where("kode", "==", bData.bookKode).get();
    if (!bookSnap.empty) {
      await db.collection("books").doc(bookSnap.docs[0].id).update({ stock: firebase.firestore.FieldValue.increment(1) });
    }

    sendSystemNotification("Pengembalian Diterima", `Pengembalian buku [${bData.bookKode}] dikonfirmasi. Terima kasih!`, "sistem", bData.userId);
    createLog("APPROVE_RETURN", `Menerima pengembalian [${bData.returnKode}] dari ${bData.userEmail}`);
    showToastNotification("Selesai", `Buku [${bData.bookKode}] berhasil dikembalikan!`);
  } catch (err) { showToastNotification("Gagal", "Gagal memproses pengembalian: " + err.message); }
}

function loadPeminjamView() {
  const user = auth.currentUser;
  if (!user) return;

  if (unsubscribeBorrowings) unsubscribeBorrowings();
  unsubscribeBorrowings = db.collection("borrowings").where("userId", "==", user.uid).onSnapshot((snapshot) => {
    const container = document.getElementById("userBorrowCardList");
    if (!container) return;
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Anda belum memiliki riwayat peminjaman buku.</p>`;
    } else {
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isWaitingBorrow = data.status === 'Menunggu Persetujuan';
        const isBorrowing = data.status === 'Dipinjam';
        const isWaitingReturn = data.status === 'Menunggu Pengembalian';
        const isReturned = data.status === 'Dikembalikan';

        // Visibilitas teks status kontras di tema terang/gelap
        let statusBadgeClass = 'bg-input text-app border border-card-border font-bold';
        if (isWaitingBorrow) statusBadgeClass = 'bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 font-bold';
        if (isBorrowing) statusBadgeClass = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-bold';
        if (isWaitingReturn) statusBadgeClass = 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-bold';
        if (isReturned) statusBadgeClass = 'bg-input text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 font-bold';

        let actionContent = '';
        if (isWaitingBorrow) {
          actionContent = `<button onclick="showApprovalTicket('${data.pinKode}', 'pinjam')" class="px-3 py-1.5 bg-[#5288c1]/20 hover:bg-[#5288c1]/30 text-[#5288c1] border border-[#5288c1]/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"><i data-feather="qr-code" class="w-3.5 h-3.5"></i> Tiket QR</button>`;
        } else if (isBorrowing) {
          actionContent = `<button onclick="requestReturnBook('${doc.id}', '${data.bookKode}')" class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0">Kembalikan</button>`;
        } else if (isWaitingReturn) {
          actionContent = `<button onclick="showApprovalTicket('${data.returnKode}', 'kembali')" class="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0"><i data-feather="qr-code" class="w-3.5 h-3.5"></i> QR Kembali</button>`;
        } else if (isReturned) {
          const hasUserReviewed = data.reviewedByUsers && data.reviewedByUsers.includes(user.uid);
          actionContent = `
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="openReviewModal('${doc.id}', '${data.bookKode}')" ${hasUserReviewed ? 'disabled' : ''} class="px-3 py-1.5 ${hasUserReviewed ? 'bg-input text-slate-400 cursor-not-allowed border border-card-border' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 dark:text-amber-300 border border-amber-500/30'} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1">
                <i data-feather="star" class="w-3.5 h-3.5"></i> ${hasUserReviewed ? 'Ulasan Terkirim ✓' : 'Beri Ulasan'}
              </button>
              <button onclick="deleteBorrowHistory('${doc.id}')" title="Hapus Riwayat" class="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs transition flex items-center justify-center">
                <i data-feather="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>`;
        }

        container.innerHTML += `
          <div class="borrow-card bg-input border border-card-border p-3.5 rounded-2xl flex items-center justify-between shadow-sm gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-[#5288c1]">${data.pinKode || data.returnKode || data.bookKode}</span>
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusBadgeClass}">${data.status}</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Kode Buku: <span class="text-app font-mono">${data.bookKode}</span> | Batas: <span class="text-rose-400 font-medium">${data.dueDate || '-'}</span></p>
            </div>
            ${actionContent}
          </div>`;
      });
    }
    updateIcons();
  });

  if (unsubscribeBooks) unsubscribeBooks();
  unsubscribeBooks = db.collection("books").onSnapshot(async (snapshot) => {
    const grid = document.getElementById("peminjamBookGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<p class="col-span-full text-xs text-slate-400 text-center py-6">Katalog buku masih kosong.</p>`;
      return;
    }

    const reviewsSnap = await db.collection("reviews").get();
    const ratingsMap = {};
    reviewsSnap.forEach(rDoc => {
      const r = rDoc.data();
      if (!ratingsMap[r.bookKode]) ratingsMap[r.bookKode] = { total: 0, count: 0 };
      ratingsMap[r.bookKode].total += (r.rating || 5);
      ratingsMap[r.bookKode].count += 1;
    });

    snapshot.forEach((doc) => {
      const b = doc.data(); b.docId = doc.id; booksCacheMap[doc.id] = b;
      const canBorrow = b.stock > 0;
      const rData = ratingsMap[b.kode];
      let ratingBadge = `<span class="text-[10px] text-slate-400 font-medium">Belum ada rating</span>`;
      if (rData && rData.count > 0) {
        ratingBadge = `<span class="text-[10px] text-amber-400 font-bold flex items-center gap-1">★ ${(rData.total / rData.count).toFixed(1)} <span class="text-slate-400 font-normal">(${rData.count})</span></span>`;
      }

      grid.innerHTML += `
        <div onclick="openBookDetailModal('${doc.id}')" class="book-card-clean bg-card rounded-2xl p-4 flex items-start gap-4 cursor-pointer group active:scale-[0.99] hover:bg-white/5 transition">
          <div class="w-20 aspect-[3/4] rounded-xl bg-input flex items-center justify-center shrink-0 text-[#5288c1] overflow-hidden shadow-lg relative">
            ${b.coverBase64 ? `<img src="${b.coverBase64}" class="w-full h-full object-cover" alt="Sampul Buku" />` : `<i data-feather="book" class="w-8 h-8"></i>`}
          </div>
          <div class="flex-1 overflow-hidden">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[9px] font-mono font-bold text-[#5288c1] bg-[#5288c1]/10 px-2 py-0.5 rounded">${b.kode}</span>
              <span class="text-[10px] ${canBorrow ? 'text-emerald-400' : 'text-rose-400'} font-bold">Stok: ${b.stock}</span>
            </div>
            <h4 class="font-bold text-app text-sm truncate mt-1 group-hover:text-[#5288c1] transition">${b.title}</h4>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <p class="text-[11px] text-slate-400 truncate">${b.author}</p>
              ${ratingBadge}
            </div>
            <p class="text-[11px] text-slate-300 mt-2 line-clamp-2 leading-relaxed">${b.synopsis || b.description || 'Belum ada sinopsis singkat.'}</p>
          </div>
        </div>`;
    });
    updateIcons();
  });
}

function openBookDetailModal(docId) {
  const book = booksCacheMap[docId];
  if (!book) return;
  currentSelectedBookForBorrow = book;

  document.getElementById("detailBookKodeBadge").innerText = book.kode || "-";
  document.getElementById("detailBookCategoryBadge").innerText = (book.category || "Umum").toUpperCase();
  document.getElementById("detailBookTitle").innerText = book.title || "Judul Buku";
  document.getElementById("detailBookAuthor").innerText = `Penulis: ${book.author || "-"}`;
  document.getElementById("detailBookSynopsis").innerText = book.synopsis || book.description || "Belum ada deskripsi / sinopsis.";

  const coverImg = document.getElementById("detailBookCover"), fallbackIcon = document.getElementById("detailBookCoverFallback");
  if (book.coverBase64) {
    coverImg.src = book.coverBase64; coverImg.classList.remove("hidden");
    if (fallbackIcon) fallbackIcon.classList.add("hidden");
  } else {
    coverImg.classList.add("hidden");
    if (fallbackIcon) fallbackIcon.classList.remove("hidden");
  }

  const stockBadge = document.getElementById("detailBookStock"), btnBorrow = document.getElementById("btnActionBorrow");
  if (book.stock > 0) {
    stockBadge.innerText = `Stok Tersedia: ${book.stock}`;
    btnBorrow.disabled = false; 
    btnBorrow.className = "w-full py-3 bg-[#5288c1] hover:bg-[#4676a9] text-white font-bold rounded-2xl text-xs transition shadow-lg active:scale-95 cursor-pointer";
    btnBorrow.innerText = "Pinjam Buku Ini";
  } else {
    stockBadge.innerText = "Stok Habis";
    btnBorrow.disabled = true; 
    btnBorrow.className = "w-full py-3 bg-input text-slate-400 font-bold rounded-2xl text-xs cursor-not-allowed border border-card-border";
    btnBorrow.innerText = "Stok Habis";
  }

  loadBookReviewsRealtime(book.kode);
  document.getElementById("bookDetailModal").classList.remove("hidden");
  window.history.pushState({ bookModalOpen: true }, "Detail Buku");
  updateIcons();
}

function closeBookDetailModal() {
  const modalElem = document.getElementById("bookDetailModal");
  if (modalElem && !modalElem.classList.contains("hidden")) {
    modalElem.classList.add("hidden");
    currentSelectedBookForBorrow = null;
  }
}

function loadBookReviewsRealtime(bookKode) {
  db.collection("reviews").where("bookKode", "==", bookKode).onSnapshot((snapshot) => {
    const reviewsContainer = document.getElementById("detailBookReviewsList");
    if (!reviewsContainer) return;
    reviewsContainer.innerHTML = "";

    if (snapshot.empty) {
      reviewsContainer.innerHTML = `<p class="text-[11px] text-slate-400 italic text-center py-2">Belum ada ulasan dari anggota.</p>`;
      return;
    }

    const reviewsList = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      data.docId = doc.id;
      reviewsList.push(data);
    });

    reviewsList.sort((a, b) => {
      const timeA = a.timestamp ? a.timestamp.toDate() : new Date(0);
      const timeB = b.timestamp ? b.timestamp.toDate() : new Date(0);
      return timeB - timeA;
    });

    const canDelete = currentUserData?.role === 'staff' || currentUserData?.role === 'admin_it';
    reviewsList.forEach(rev => {
      const reviewerName = cleanText(rev.userName || (rev.userEmail ? rev.userEmail.split('@')[0] : 'Anggota'));
      const deleteBtn = canDelete ? `
        <button onclick="deleteBookReview('${rev.docId}', '${bookKode}')" title="Hapus Ulasan (Khusus Staff/Admin)" class="text-slate-400 hover:text-rose-400 p-1 transition ml-2">
          <i data-feather="trash-2" class="w-3.5 h-3.5"></i>
        </button>` : '';

      reviewsContainer.innerHTML += `
        <div class="bg-card p-2.5 rounded-xl border border-card-border space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-[#5288c1]">${reviewerName}</span>
            <div class="flex items-center">
              <span class="text-amber-400 text-xs font-bold">${"★".repeat(rev.rating || 5)}</span>
              ${deleteBtn}
            </div>
          </div>
          ${rev.comment ? `<p class="text-xs text-app mt-1 leading-relaxed">${rev.comment}</p>` : ''}
        </div>`;
    });
    updateIcons();
  });
}

async function deleteBookReview(reviewDocId, bookKode) {
  if (currentUserData?.role !== 'staff' && currentUserData?.role !== 'admin_it') {
    showToastNotification("Akses Ditolak", "Hanya Staff dan Admin IT yang berhak menghapus ulasan!"); return;
  }
  
  const confirmed = await showCustomConfirm("Hapus Ulasan", "Apakah Anda yakin ingin menghapus ulasan ini?");
  if (!confirmed) return;

  try {
    await db.collection("reviews").doc(reviewDocId).delete();
    showToastNotification("Dihapus", "Ulasan berhasil dihapus pengelola.");
    loadBookReviewsRealtime(bookKode);
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus ulasan: " + err.message); }
}

function submitBorrowFromDetailModal() {
  if (!currentSelectedBookForBorrow) return;
  const book = currentSelectedBookForBorrow;
  closeBookDetailModal();
  requestBorrowBook(book.kode, book.stock);
}

async function deleteBorrowHistory(docId) {
  const confirmed = await showCustomConfirm("Hapus Riwayat", "Apakah Anda yakin ingin menghapus catatan riwayat peminjaman ini?");
  if (!confirmed) return;

  try {
    await db.collection("borrowings").doc(docId).delete();
    showToastNotification("Dihapus", "Catatan riwayat berhasil dihapus.");
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus: " + err.message); }
}

function openReviewModal(borrowDocId, bookKode) {
  document.getElementById("reviewBorrowDocId").value = borrowDocId;
  document.getElementById("reviewBookKode").value = bookKode;
  document.getElementById("reviewText").value = ""; setRating(5);
  document.getElementById("reviewModal").classList.remove("hidden");
}

function closeReviewModal() { document.getElementById("reviewModal").classList.add("hidden"); }

function setRating(val) {
  selectedRating = val;
  const stars = document.querySelectorAll("#starRatingContainer > button");
  const labels = ["Kecewa", "Kurang Bagus", "Cukup", "Bagus", "Sangat Bagus"];
  stars.forEach((star, index) => {
    star.className = index < val ? "p-1 text-2xl hover:scale-125 transition text-amber-400" : "p-1 text-2xl hover:scale-125 transition text-slate-600";
  });
  document.getElementById("ratingLabel").innerText = labels[val - 1];
}

async function submitReview() {
  const docId = document.getElementById("reviewBorrowDocId").value;
  const bookKode = document.getElementById("reviewBookKode").value;
  const reviewText = document.getElementById("reviewText").value.trim();
  const user = auth.currentUser;
  if (!docId || !user) return;

  try {
    await db.collection("reviews").add({
      borrowDocId: docId, bookKode, userId: user.uid, userEmail: user.email,
      userName: cleanText(currentUserData?.displayName || user.email.split('@')[0]),
      rating: selectedRating, comment: reviewText, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("borrowings").doc(docId).update({
      hasReviewed: true, reviewedByUsers: firebase.firestore.FieldValue.arrayUnion(user.uid)
    });

    showToastNotification("Terima Kasih", "Ulasan dan rating Anda terkirim!");
    closeReviewModal();
  } catch (err) { showToastNotification("Gagal", "Gagal mengirim ulasan: " + err.message); }
}

async function requestBorrowBook(bookKode, currentStock) {
  const user = auth.currentUser;
  if (!user) return;

  if (!checkUserProfileComplete(currentUserData)) {
    showToastNotification("Profil Belum Lengkap", "Diwajibkan melengkapi Data Diri Profil terlebih dahulu!");
    switchTab('dashboardProfil'); return;
  }

  const activeSnap = await db.collection("borrowings").where("userId", "==", user.uid).get();
  const activeBorrowingsCount = activeSnap.docs.filter(doc => {
    const status = doc.data().status;
    return status === "Dipinjam" || status === "Menunggu Persetujuan";
  }).length;

  if (activeBorrowingsCount >= MAX_PINJAM) { 
    showToastNotification("Batas Pinjam", `Batas pinjam maksimal adalah ${MAX_PINJAM} buku.`); 
    return; 
  }

  const randomPin = 'PIN-' + Math.floor(1000 + Math.random() * 9000);
  const today = new Date(), dueDate = new Date();
  dueDate.setDate(today.getDate() + LAMA_PINJAM_HARI);

  try {
    await db.collection("borrowings").add({
      userId: user.uid, userEmail: user.email, bookKode, pinKode: randomPin,
      borrowDate: today.toISOString().split('T')[0], dueDate: dueDate.toISOString().split('T')[0],
      status: "Menunggu Persetujuan"
    });

    createLog("REQUEST_BORROW", `Permohonan pinjam ${bookKode} kode ${randomPin}`);
    showApprovalTicket(randomPin, 'pinjam');
  } catch (err) { showToastNotification("Gagal", "Gagal mengajukan pinjaman: " + err.message); }
}

async function requestReturnBook(borrowDocId, bookKode) {
  const returnCode = 'KMB-' + Math.floor(1000 + Math.random() * 9000);
  try {
    await db.collection("borrowings").doc(borrowDocId).update({ returnKode: returnCode, status: "Menunggu Pengembalian" });
    createLog("REQUEST_RETURN", `Pengajuan pengembalian ${bookKode} kode ${returnCode}`);
    showApprovalTicket(returnCode, 'kembali');
  } catch (err) { showToastNotification("Gagal", "Gagal mengajukan pengembalian: " + err.message); }
}

function showApprovalTicket(codeStr, type = 'pinjam') {
  const headerTitle = document.getElementById("qrModalHeaderTitle"), subNotice = document.getElementById("qrModalSubNotice"), codeLabel = document.getElementById("qrModalCodeLabel");
  if (type === 'pinjam') {
    if (headerTitle) headerTitle.innerHTML = `<i data-feather="qr-code" class="w-4 h-4 text-[#5288c1]"></i> Tiket Persetujuan Pinjam`;
    if (subNotice) subNotice.innerText = "Tunjukkan QR Code / Kode ini kepada Staff saat mengambil buku.";
    if (codeLabel) codeLabel.innerText = "Kode Pinjam Unik";
  } else {
    if (headerTitle) headerTitle.innerHTML = `<i data-feather="qr-code" class="w-4 h-4 text-[#5288c1]"></i> Tiket Pengembalian Buku`;
    if (subNotice) subNotice.innerText = "Tunjukkan QR Code / Kode ini kepada Staff saat menyerahkan buku.";
    if (codeLabel) codeLabel.innerText = "Kode Pengembalian Unik";
  }

  document.getElementById("qrApprovalCodeText").innerText = codeStr;
  const container = document.getElementById("qrApprovalContainer");
  container.innerHTML = "";
  new QRCode(container, { text: codeStr, width: 140, height: 140, colorDark: "#0e1621", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
  document.getElementById("qrApprovalModal").classList.remove("hidden");
  updateIcons();
}

function closeQrApprovalModal() { document.getElementById("qrApprovalModal").classList.add("hidden"); }

function sendSystemNotification(title, content, type = 'sistem', targetUserId = null) {
  const notifData = { title, content, type, readBy: [], sender: type === 'siaran' ? "Staff Perpustakaan" : "Sistem pojokbaca", timestamp: firebase.firestore.FieldValue.serverTimestamp() };
  if (targetUserId) notifData.targetUser = targetUserId;
  db.collection("notifications").add(notifData);
}

function syncNotificationsRealtime() {
  const user = auth.currentUser;
  if (!user) return;

  if (unsubscribeNotifs) unsubscribeNotifs();
  unsubscribeNotifs = db.collection("notifications").orderBy("timestamp", "desc").limit(30).onSnapshot((snapshot) => {
    notificationsCacheList = [];
    let unreadCount = 0;
    snapshot.forEach(doc => {
      const data = doc.data(); data.id = doc.id;
      if (data.type === 'siaran' || (data.type === 'sistem' && (!data.targetUser || data.targetUser === user.uid))) {
        notificationsCacheList.push(data);
        if (!data.readBy || !data.readBy.includes(user.uid)) unreadCount++;
      }
    });

    const badgeMobile = document.getElementById("notifBadge"), badgeSidebar = document.getElementById("sidebarNotifBadge");
    if (badgeMobile) badgeMobile.classList.toggle("hidden", unreadCount === 0);
    if (badgeSidebar) badgeSidebar.classList.toggle("hidden", unreadCount === 0);
    renderNotificationsList();
  });
}

function filterNotifCategory(cat) {
  currentNotifFilter = cat;
  const btnSemua = document.getElementById("btnNotifSemua"), btnSistem = document.getElementById("btnNotifSistem"), btnSiaran = document.getElementById("btnNotifSiaran");
  [btnSemua, btnSistem, btnSiaran].forEach(b => { if (b) b.className = "py-2 rounded-lg text-[11px] font-medium transition text-center text-slate-400 hover:bg-white/5"; });
  if (cat === 'semua' && btnSemua) btnSemua.className = "py-2 rounded-lg text-[11px] font-semibold transition text-center bg-[#5288c1] text-white shadow";
  if (cat === 'sistem' && btnSistem) btnSistem.className = "py-2 rounded-lg text-[11px] font-semibold transition text-center bg-[#5288c1] text-white shadow";
  if (cat === 'siaran' && btnSiaran) btnSiaran.className = "py-2 rounded-lg text-[11px] font-semibold transition text-center bg-[#5288c1] text-white shadow";
  renderNotificationsList();
}

function renderNotificationsList() {
  const container = document.getElementById("notificationList");
  if (!container) return;
  container.innerHTML = "";

  const filtered = notificationsCacheList.filter(n => currentNotifFilter === 'semua' || n.type === currentNotifFilter);
  if (filtered.length === 0) { container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Tidak ada notifikasi.</p>`; return; }

  const userId = auth.currentUser ? auth.currentUser.uid : null;
  filtered.forEach(n => {
    const dateStr = (n.timestamp ? n.timestamp.toDate() : new Date()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const isRead = n.readBy && n.readBy.includes(userId);

    container.innerHTML += `
      <div onclick="openNotifDetailModal('${n.id}')" class="bg-card border ${isRead ? 'border-card-border opacity-80' : 'border-[#5288c1]/40'} p-4 rounded-2xl shadow-md flex items-start gap-3.5 cursor-pointer hover:bg-white/5 transition relative">
        <div class="w-10 h-10 rounded-full ${n.type === 'siaran' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#5288c1]/20 text-[#5288c1] border border-[#5288c1]/30'} flex items-center justify-center font-bold shrink-0">
          <i data-feather="${n.type === 'siaran' ? 'radio' : 'bell'}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300">${n.sender || 'Sistem'}</span>
            <span class="text-[10px] text-slate-400 font-mono">${dateStr}</span>
          </div>
          <h4 class="font-bold text-app text-xs mt-1 truncate">${n.title}</h4>
          <p class="text-xs text-slate-400 mt-1 line-clamp-2">${n.content}</p>
        </div>
        ${!isRead ? `<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0 self-center"></span>` : ''}
      </div>`;
  });
  updateIcons();
}

function openNotifDetailModal(docId) {
  const notif = notificationsCacheList.find(item => item.id === docId);
  if (!notif) return;
  selectedNotifDocId = docId;
  const user = auth.currentUser;

  document.getElementById("popupNotifCategory").innerText = (notif.type || 'Sistem').toUpperCase();
  document.getElementById("popupNotifTitle").innerText = notif.title || "";
  document.getElementById("popupNotifContent").innerText = notif.content || "";
  document.getElementById("popupNotifDate").innerText = (notif.timestamp ? notif.timestamp.toDate() : new Date()).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  document.getElementById("notifDetailModal").classList.remove("hidden");

  if (user && notif.readBy && !notif.readBy.includes(user.uid)) {
    db.collection("notifications").doc(docId).update({ readBy: firebase.firestore.FieldValue.arrayUnion(user.uid) });
  }
  updateIcons();
}

function closeNotifDetailModal() { document.getElementById("notifDetailModal").classList.add("hidden"); selectedNotifDocId = null; }

async function deleteSelectedNotification() {
  if (!selectedNotifDocId) return;
  const confirmed = await showCustomConfirm("Hapus Notifikasi", "Apakah Anda yakin ingin menghapus notifikasi ini?");
  if (!confirmed) return;

  try {
    await db.collection("notifications").doc(selectedNotifDocId).delete();
    showToastNotification("Dihapus", "Notifikasi berhasil dihapus.");
    closeNotifDetailModal();
  } catch (err) { showToastNotification("Gagal", "Gagal menghapus: " + err.message); }
}

async function createUser(e) {
  e.preventDefault();
  const email = document.getElementById("newUserEmail").value;
  const pass = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;

  try {
    let secondaryApp = firebase.apps.find(app => app.name === "SecondaryApp") || firebase.initializeApp(firebaseConfig, "SecondaryApp");
    const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
    await secondaryApp.auth().signOut();
    await secondaryApp.delete();

    const autoId = generateMemberId();
    await db.collection("users").doc(userCredential.user.uid).set({
      email, role, displayName: cleanText(email.split('@')[0]), memberId: autoId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    createLog("CREATE_USER", `Membuat akun baru: ${email}`);
    showToastNotification("Berhasil", `Akun (${email}) berhasil dibuat! ID: ${autoId}`);
    e.target.reset();
  } catch (err) { showToastNotification("Gagal", "Gagal membuat user: " + err.message); }
}

function filterUserList() {
  const query = document.getElementById("searchAccountInput").value.toLowerCase();
  document.querySelectorAll("#userListTableBody > tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
  });
}

function loadUserListAdmin() {
  db.collection("users").onSnapshot((snapshot) => {
    const tbody = document.getElementById("userListTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
      const u = doc.data();
      if (!u.email || u.email.toLowerCase().includes("unidentified")) return;

      const isPrimary = PRIMARY_ADMIN_EMAILS.includes(u.email?.toLowerCase());
      const btn = isPrimary ? `<span class="text-[9px] text-amber-400 font-bold">PROTECTED</span>` : `<button onclick="deleteUserDoc('${doc.id}', '${u.email}')" class="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-xs hover:bg-rose-500/30 transition">Hapus</button>`;

      tbody.innerHTML += `
        <tr class="hover:bg-white/5 transition">
          <td class="p-2.5 text-app">${u.email}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[9px] uppercase bg-[#5288c1]/20 text-[#5288c1]">${u.role || 'peminjam'}</span></td>
          <td class="p-2.5 text-right">${btn}</td>
        </tr>`;
    });
    filterUserList();
  });
}

async function deleteUserDoc(docId, userEmail) {
  const confirmed = await showCustomConfirm("Hapus Pengguna", `Apakah Anda yakin ingin menghapus pengguna ${userEmail}?`);
  if (!confirmed) return;

  await db.collection("users").doc(docId).delete();
  createLog("DELETE_USER", `Menghapus user: ${userEmail}`);
}

function loadLogs() {
  db.collection("logs").orderBy("timestamp", "desc").limit(50).onSnapshot((snapshot) => {
    cachedLogs = [];
    snapshot.forEach((doc) => cachedLogs.push(doc.data()));
    renderFilteredLogs();
  });
}

function renderFilteredLogs() {
  const container = document.getElementById("logList");
  if (!container) return;
  const searchQuery = (document.getElementById("searchLogInput")?.value || "").toLowerCase();
  const actionFilter = document.getElementById("filterLogAction")?.value || "ALL";
  const dateFilter = document.getElementById("filterLogDate")?.value || "";

  container.innerHTML = "";
  const filtered = cachedLogs.filter(d => {
    const matchesSearch = (d.user || "").toLowerCase().includes(searchQuery) || (d.action || "").toLowerCase().includes(searchQuery) || (d.detail || "").toLowerCase().includes(searchQuery);
    const matchesAction = actionFilter === "ALL" || d.action === actionFilter;
    let matchesDate = true;
    if (dateFilter && d.timestamp) matchesDate = d.timestamp.toDate().toISOString().split('T')[0] === dateFilter;
    return matchesSearch && matchesAction && matchesDate;
  });

  if (filtered.length === 0) { container.innerHTML = `<p class="text-slate-400 text-xs text-center py-4">Tidak ada log aktivitas.</p>`; return; }

  filtered.forEach(d => {
    const dateObj = d.timestamp ? d.timestamp.toDate() : new Date();
    container.innerHTML += `
      <div class="border-b border-card-border pb-2 transition hover:bg-white/5 rounded px-1">
        <div>
          <span class="text-slate-400">[${dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${dateObj.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span> 
          <span class="text-emerald-400 font-semibold">${d.user}</span>: 
          <span class="text-[#5288c1] font-bold">${d.action}</span>
        </div>
        <div class="text-slate-300 text-[11px] pl-2">${d.detail || 'Aktivitas sistem.'}</div>
      </div>`;
  });
}

function filterLogs() { renderFilteredLogs(); }

async function calculateDatabaseUsage() {
  if (currentUserData?.role !== 'admin_it') return;

  try {
    const [booksSnap, borrowSnap, postsSnap, usersSnap, logsSnap] = await Promise.all([
      db.collection("books").count().get(),
      db.collection("borrowings").count().get(),
      db.collection("libraryPosts").count().get(),
      db.collection("users").count().get(),
      db.collection("logs").count().get()
    ]);

    const totalBooks = booksSnap.data().count || 0;
    const totalBorrows = borrowSnap.data().count || 0;
    const totalPosts = postsSnap.data().count || 0;
    const totalUsers = usersSnap.data().count || 0;
    const totalLogs = logsSnap.data().count || 0;

    const totalDocs = totalBooks + totalBorrows + totalPosts + totalUsers + totalLogs;

    const estimatedSizeBytes = (totalPosts + totalBooks) * 20000 + (totalBorrows + totalUsers + totalLogs) * 1000;
    const estimatedMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);
    
    const MAX_STORAGE_MB = 1024;
    const storagePercent = Math.min(((estimatedMB / MAX_STORAGE_MB) * 100), 100).toFixed(1);

    const storageBar = document.getElementById("storageProgressBar");
    const storagePercentText = document.getElementById("storagePercentText");
    const storageDetailText = document.getElementById("storageDetailText");

    if (storageBar) storageBar.style.width = `${storagePercent}%`;
    if (storagePercentText) storagePercentText.innerText = `${storagePercent}%`;
    if (storageDetailText) storageDetailText.innerText = `${estimatedMB} MB / 1.024 MB Digunakan`;

    const MAX_SAFE_DOCS = 10000;
    const docPercent = Math.min(((totalDocs / MAX_SAFE_DOCS) * 100), 100).toFixed(1);

    const docBar = document.getElementById("docProgressBar");
    const docPercentText = document.getElementById("docPercentText");
    const docDetailText = document.getElementById("docDetailText");

    if (docBar) docBar.style.width = `${docPercent}%`;
    if (docPercentText) docPercentText.innerText = `${docPercent}%`;
    if (docDetailText) docDetailText.innerText = `${totalDocs.toLocaleString('id-ID')} Total Dokumen (Buku, User, Log, Post)`;

  } catch (err) {
    console.error("Gagal menghitung kapasitas database:", err);
  }
}

async function clearAppCacheAndReload() {
  const confirmed = await showCustomConfirm(
    "Pemeliharaan Aplikasi", 
    "Bersihkan cache browser dan muat ulang aplikasi?"
  );
  if (!confirmed) return;

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    const savedTheme = localStorage.getItem('pojokbaca_theme');
    localStorage.clear();
    if (savedTheme) localStorage.setItem('pojokbaca_theme', savedTheme);

    sessionStorage.clear();
    showToastNotification("Cache Dibersihkan", "Memuat ulang aplikasi...");
    
    setTimeout(() => {
      window.location.href = window.location.pathname + '?v=' + new Date().getTime();
    }, 1000);

  } catch (err) {
    console.error("Gagal membersihkan cache:", err);
    window.location.reload(true);
  }
}

function exportPdfKatalog() {
  db.collection("books").get().then((snapshot) => {
    let w = window.open('', '', 'height=600,width=800'), rows = '';
    snapshot.forEach(doc => { let b = doc.data(); rows += `<tr><td>${b.kode}</td><td>${b.title}</td><td>${b.author}</td><td>${b.stock}</td></tr>`; });
    w.document.write(`<html><body><h2>LAPORAN KATALOG BUKU</h2><table border="1" style="width:100%;border-collapse:collapse"><tr><th>Kode</th><th>Judul</th><th>Penulis</th><th>Stok</th></tr>${rows}</table></body></html>`);
    w.document.close(); w.print();
  });
}

function exportPdfPeminjaman() {
  db.collection("borrowings").get().then((snapshot) => {
    let w = window.open('', '', 'height=600,width=800'), rows = '';
    snapshot.forEach(doc => { let b = doc.data(); rows += `<tr><td>${b.userEmail}</td><td>${b.bookKode}</td><td>${b.borrowDate}</td><td>${b.status}</td></tr>`; });
    w.document.write(`<html><body><h2>LAPORAN SIRKULASI PEMINJAMAN</h2><table border="1" style="width:100%;border-collapse:collapse"><tr><th>Email</th><th>Kode Buku</th><th>Tgl Pinjam</th><th>Status</th></tr>${rows}</table></body></html>`);
    w.document.close(); w.print();
  });
}
