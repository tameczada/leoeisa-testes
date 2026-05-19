/* ══ TOAST ══ */
let toastTimer;
function showToast(msg, type = "ok") {
  clearTimeout(toastTimer);
  const el = document.getElementById("toast");
  const msg_el = document.getElementById("toastMsg");
  const dot = document.getElementById("toastDot");
  if (!el || !msg_el || !dot) return;
  msg_el.textContent = msg;
  dot.className = "toast-dot" + (type === "warn" ? " warn" : type === "err" ? " err" : "");
  el.classList.add("show");
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ══ CONFIRM MODAL ══ */
let pendingOk = null;

function showConfirm(title, msg, cb) {
  pendingOk = cb;

  // Tenta usar o modal HTML
  const modal = document.getElementById("confirmModal");
  if (modal) {
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMsg");
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    modal.classList.add("open");
    return;
  }

  // Fallback: executa direto sem confirmação (mobile não tem confirm confiável)
  cb();
}

function closeConfirm() {
  const modal = document.getElementById("confirmModal");
  if (modal) modal.classList.remove("open");
  pendingOk = null;
}

// Bind no botão confirmar — direto, sem DOMContentLoaded
const _confirmOkBtn = document.getElementById("confirmOkBtn");
if (_confirmOkBtn) {
  _confirmOkBtn.addEventListener("click", () => {
    const fn = pendingOk;
    closeConfirm();
    if (fn) fn();
  });
}

const _confirmCancelBtn = document.querySelector("#confirmModal .btn-cancel");
if (_confirmCancelBtn) {
  _confirmCancelBtn.addEventListener("click", closeConfirm);
}

/* ══ VOTE ADJUST ══ */
async function adjustVotes(id, title, delta) {
  try {
    const res = await fetch(`/api/admin/movies/${id}/adjust-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const movie = await res.json();

    [`vadj-${id}`, `vadj2-${id}`].forEach(elId => {
      const el = document.getElementById(elId);
      if (el) el.textContent = movie.voteCount.toLocaleString("pt-BR");
    });
    const vcount = document.getElementById(`vcount-${id}`);
    if (vcount) vcount.textContent = `${movie.voteCount.toLocaleString("pt-BR")} votos`;

    showToast(`${title}: ${movie.voteCount} votos`);
  } catch (err) {
    console.error("adjustVotes error:", err);
    showToast("Erro ao ajustar votos.", "err");
  }
}

/* ══ RESET VOTES ══ */
function resetVotes(id, title) {
  showConfirm("Zerar Votos", `Zerar os votos de "${title}"?`, async () => {
    try {
      const res = await fetch(`/api/admin/movies/${id}/reset-votes`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      [`vadj-${id}`, `vadj2-${id}`].forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.textContent = "0";
      });
      const vcount = document.getElementById(`vcount-${id}`);
      if (vcount) vcount.textContent = "0 votos";

      showToast(`Votos de "${title}" zerados.`, "warn");
    } catch (err) {
      console.error("resetVotes error:", err);
      showToast("Erro ao zerar votos.", "err");
    }
  });
}

/* ══ DELETE MOVIE ══ */
function deleteMovie(id, title) {
  showConfirm("Apagar Filme", `Apagar "${title}"? Esta ação é irreversível.`, async () => {
    try {
      const res = await fetch(`/api/admin/movies/${id}`, {
        method: "DELETE",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const row = document.getElementById(`row-${id}`);
      if (row) row.remove();
      showToast(`"${title}" apagado.`, "warn");
    } catch (err) {
      console.error("deleteMovie error:", err);
      showToast("Erro ao apagar filme.", "err");
    }
  });
}

/* ══ RESET ALL VOTES ══ */
async function resetAllVotes() {
  showConfirm("Zerar TODOS os Votos", "Isso vai zerar os votos de todos os filmes e liberar todos os usuários para votar novamente.", async () => {
    try {
      const res = await fetch("/api/admin/reset-all-votes", {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      document.querySelectorAll("[id^='vadj-'], [id^='vadj2-']").forEach(el => el.textContent = "0");
      document.querySelectorAll("[id^='vcount-']").forEach(el => el.textContent = "0 votos");
      showToast("Todos os votos zerados! Usuários podem votar novamente.", "warn");
    } catch (err) {
      console.error("resetAllVotes error:", err);
      showToast("Erro ao zerar votos.", "err");
    }
  });
}

/* ══ EXPORT JSON ══ */
async function exportJson() {
  try {
    const res = await fetch("/api/admin/movies", { credentials: "same-origin" });
    const movies = await res.json();
    const blob = new Blob([JSON.stringify(movies, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cinevote-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("JSON exportado!");
  } catch {
    showToast("Erro ao exportar.", "err");
  }
}

/* ══ APPLY URL PREVIEW ══ */
function applyUrl() {
  const urlInput = document.getElementById("posterUrlInput");
  if (!urlInput) return;
  const url = urlInput.value.trim();
  if (!url) return;
  const preview = document.getElementById("imgPreview");
  const placeholder = document.getElementById("imgPlaceholder");
  if (preview) { preview.src = url; preview.style.display = "block"; }
  if (placeholder) placeholder.style.display = "none";
  const fileInput = document.getElementById("fImgFile");
  if (fileInput) fileInput.value = "";
}

/* ══ EVENT DELEGATION ══ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delta]");
  const resetBtn = e.target.closest("[data-action='reset']");
  const deleteBtn = e.target.closest("[data-action='delete']");
  const resetAllBtn = e.target.closest("[data-action='reset-all']");

  if (btn) {
    const { id, title, delta } = btn.dataset;
    if (id) adjustVotes(id, title || "", parseInt(delta));
    return;
  }
  if (resetBtn) {
    const { id, title } = resetBtn.dataset;
    if (id) resetVotes(id, title || "");
    return;
  }
  if (deleteBtn) {
    const { id, title } = deleteBtn.dataset;
    if (id) deleteMovie(id, title || "");
    return;
  }
  if (resetAllBtn) {
    resetAllVotes();
    return;
  }
});

/* ══ ADD MOVIE FORM ══ */
const addForm = document.getElementById("addMovieForm");
if (addForm) {
  const fImgFile = document.getElementById("fImgFile");

  if (fImgFile) {
    fImgFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast("Arquivo muito grande (max 5 MB).", "err"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById("imgPreview");
        const placeholder = document.getElementById("imgPlaceholder");
        if (preview) { preview.src = ev.target.result; preview.style.display = "block"; }
        if (placeholder) placeholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    });
  }

  const area = document.getElementById("imgUploadArea");
  if (area && fImgFile) {
    area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag"); });
    area.addEventListener("dragleave", () => area.classList.remove("drag"));
    area.addEventListener("drop", (e) => {
      e.preventDefault(); area.classList.remove("drag");
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const dt = new DataTransfer(); dt.items.add(file);
      fImgFile.files = dt.files;
      fImgFile.dispatchEvent(new Event("change"));
    });
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = addForm.querySelector("[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";

    try {
      const formData = new FormData(addForm);
      const fileInput = document.getElementById("fImgFile");
      if (fileInput && !fileInput.files[0]) formData.delete("poster");

      const res = await fetch("/api/admin/movies", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      const movie = await res.json();
      showToast(`"${movie.title}" adicionado!`);
      setTimeout(() => { window.location.href = "/admin?tab=movies"; }, 1200);
    } catch (err) {
      showToast(err.message || "Erro ao salvar.", "err");
      submitBtn.disabled = false;
      submitBtn.textContent = "Adicionar Filme";
    }
  });
}
