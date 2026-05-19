let toastTimer;
function showToast(msg, type = "ok") {
  clearTimeout(toastTimer);
  const toastMsg = document.getElementById("toastMsg");
  const dot = document.getElementById("toastDot");
  const toast = document.getElementById("toast");
  if (!toastMsg || !dot || !toast) return;
  toastMsg.textContent = msg;
  dot.className = "toast-dot" + (type === "warn" ? " warn" : type === "err" ? " err" : "");
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function castVote(btn) {
  const movieId = btn.dataset.movieId;
  const movieTitle = btn.dataset.movieTitle;

  btn.classList.add("loading");
  btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 0116 0"/></svg> Votando...`;

  try {
    const res = await fetch(`/api/movies/${movieId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "same-origin",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      window.location.href = "/auth/twitch";
      return;
    }

    const data = await res.json();

    if (res.status === 401) {
      window.location.href = "/auth/twitch";
      return;
    }

    if (res.ok) {
      btn.classList.remove("loading");
      btn.classList.add("voted");
      btn.disabled = true;
      btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Votado!`;

      const card = btn.closest(".card");
      if (card && data.voteCount !== undefined) {
        const voteCountEl = card.querySelector(".vote-count");
        if (voteCountEl) {
          voteCountEl.textContent = `${data.voteCount.toLocaleString("pt-BR")} votos`;
        }
      }

      const totalEl = document.getElementById("totalVotesDisplay");
      if (totalEl) {
        const current = parseInt(totalEl.textContent.replace(/\D/g, "")) || 0;
        totalEl.textContent = `${(current + 1).toLocaleString("pt-BR")} votos registrados`;
      }

      showToast(`Voto em "${movieTitle}" registrado! 🎬`);
    } else if (res.status === 409) {
      showToast("Você já votou neste filme.", "warn");
      btn.classList.remove("loading");
      btn.classList.add("voted");
      btn.disabled = true;
      btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Votado!`;
    } else {
      throw new Error(data.error || "Erro desconhecido");
    }
  } catch (err) {
    console.error(err);
    btn.classList.remove("loading");
    btn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg> Votar`;
    showToast("Erro ao registrar voto. Tente novamente.", "err");
  }
}

const btnRules = document.getElementById("btnRules");
const rulesModal = document.getElementById("rulesModal");
const btnCloseRules = document.getElementById("btnCloseRules");

if (btnRules && rulesModal) {
  btnRules.addEventListener("click", () => rulesModal.classList.add("open"));
  btnCloseRules?.addEventListener("click", () => rulesModal.classList.remove("open"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("open");
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-vote[data-movie-id]");
  if (btn && !btn.disabled && !btn.classList.contains("voted")) {
    castVote(btn);
  }
});
