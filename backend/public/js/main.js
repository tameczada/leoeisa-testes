let toastTimer;
function showToast(msg, type = "ok") {
  clearTimeout(toastTimer);
  const toastMsg = document.getElementById("toastMsg");
  const dot      = document.getElementById("toastDot");
  const toast    = document.getElementById("toast");
  if (!toastMsg || !dot || !toast) return;
  toastMsg.textContent = msg;
  dot.className = "toast-dot" + (type === "warn" ? " warn" : type === "err" ? " err" : "");
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function castVote(btn) {
  const movieId    = btn.dataset.movieId;
  const movieTitle = btn.dataset.movieTitle;
  const hasVoted   = btn.classList.contains("voted");

  btn.classList.add("loading");
  btn.innerHTML = loadingIcon() + (hasVoted ? " Removendo..." : " Votando...");

  try {
    const res = await fetch(`/api/movies/${movieId}/vote`, {
      method:      hasVoted ? "DELETE" : "POST",
      headers:     { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      window.location.href = "/auth/twitch";
      return;
    }

    const data = await res.json();

    if (res.status === 401) { window.location.href = "/auth/twitch"; return; }

    if (res.ok) {
      btn.classList.remove("loading");
      const nowVoted = !hasVoted;
      btn.classList.toggle("voted", nowVoted);
      btn.dataset.hasVoted = nowVoted ? "1" : "";

      btn.innerHTML = nowVoted
        ? checkIcon() + " Votado!"
        : heartIcon()  + " Votar";

      // Atualiza contagem no card
      const card = btn.closest(".card");
      if (card && data.voteCount !== undefined) {
        const voteCountEl = card.querySelector(".vote-count");
        if (voteCountEl) voteCountEl.textContent = `${data.voteCount.toLocaleString("pt-BR")} votos`;
      }

      // Atualiza total no hero
      const totalEl = document.getElementById("totalVotesDisplay");
      if (totalEl) {
        const current = parseInt(totalEl.textContent.replace(/\D/g, "")) || 0;
        const next    = nowVoted ? current + 1 : Math.max(0, current - 1);
        totalEl.textContent = `${next.toLocaleString("pt-BR")} votos registrados`;
      }

      showToast(
        nowVoted
          ? `Voto em "${movieTitle}" registrado! 🎬`
          : `Voto em "${movieTitle}" removido.`,
        "ok"
      );
    } else {
      throw new Error(data.error || "Erro desconhecido");
    }
  } catch (err) {
    console.error(err);
    btn.classList.remove("loading");
    btn.innerHTML = heartIcon() + " Votar";
    showToast("Erro ao processar voto. Tente novamente.", "err");
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function loadingIcon() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 0116 0"/></svg>`;
}
function checkIcon() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
}
function heartIcon() {
  return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
}

// ── Modal de regras ───────────────────────────────────────────────────────────
const btnRules    = document.getElementById("btnRules");
const rulesModal  = document.getElementById("rulesModal");
const btnCloseRules = document.getElementById("btnCloseRules");

if (btnRules && rulesModal) {
  btnRules.addEventListener("click",  () => rulesModal.classList.add("open"));
  btnCloseRules?.addEventListener("click", () => rulesModal.classList.remove("open"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("open");
  });
}

// ── Delegação de clique no botão de votar ─────────────────────────────────────
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-vote[data-movie-id]");
  if (btn && !btn.classList.contains("loading")) castVote(btn);
});
