// js/reels.js — vertical swipe feed (reels are always free, but every play
// still goes through the same signed-URL + tracked-view pipeline as movies).
(async function initReels() {
  const feed = document.getElementById("reelsFeed");
  const { data: reels, error } = await window.sb
    .from("reels")
    .select("id, title, caption, thumbnail_url, related_movie_id, duration_seconds, is_published, view_count, like_count, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !reels?.length) {
    console.error("KIDEONI reels query error:", error);
    feed.innerHTML = `<p class="muted center" style="padding-top:120px; padding-inline:20px;">
      ${error ? `Couldn't load reels: ${escapeHtml(error.message)}` : "No reels available yet."}
    </p>`;
    return;
  }

  feed.innerHTML = reels
    .map(
      (r, i) => `
    <div class="reel-slide" data-id="${r.id}" data-index="${i}">
      <video muted loop playsinline poster="${r.thumbnail_url || ""}"></video>
      <div class="reel-tap-hint"><div class="icon-circle">▶</div></div>
      <button class="reel-mute-btn" aria-label="Toggle sound" type="button">🔇</button>
      <div class="reel-info">
        <strong>${escapeHtml(r.title)}</strong>
        ${r.caption ? `<span>${escapeHtml(r.caption)}</span>` : ""}
      </div>
    </div>`
    )
    .join("");

  const slides = Array.from(feed.querySelectorAll(".reel-slide"));
  const loaded = new Set();

  function setHint(hint, icon) {
    if (icon === null) {
      hint.classList.remove("show");
      return;
    }
    hint.querySelector(".icon-circle").textContent = icon;
    hint.classList.add("show");
  }

  async function activate(slide) {
    const id = slide.dataset.id;
    const video = slide.querySelector("video");
    const hint = slide.querySelector(".reel-tap-hint");

    if (!loaded.has(id)) {
      loaded.add(id);
      setHint(hint, "…"); // loading
      const ok = await loadProtectedVideo(video, "reel", id, (err) => {
        setHint(hint, "⚠");
        console.error("KIDEONI reel load error:", err);
      });
      if (ok === null) return; // load failed — hint already shows the error
    }

    try {
      await video.play();
    } catch {
      setHint(hint, "▶"); // autoplay blocked — invite a tap
    }
  }

  function pause(slide) {
    slide.querySelector("video")?.pause();
  }

  slides.forEach((slide) => {
    const video = slide.querySelector("video");
    const hint = slide.querySelector(".reel-tap-hint");
    const muteBtn = slide.querySelector(".reel-mute-btn");

    // Video state always drives the hint icon — this is the actual play/pause button.
    video.addEventListener("play", () => setHint(hint, null));
    video.addEventListener("pause", () => setHint(hint, "▶"));
    video.addEventListener("waiting", () => setHint(hint, "…"));
    video.addEventListener("playing", () => setHint(hint, null));

    slide.addEventListener("click", (e) => {
      if (e.target.closest(".reel-mute-btn")) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    muteBtn.textContent = video.muted ? "🔇" : "🔊";
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? "🔇" : "🔊";
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          activate(entry.target);
        } else {
          pause(entry.target);
        }
      });
    },
    { root: feed, threshold: [0, 0.6, 1] }
  );
  slides.forEach((s) => observer.observe(s));

  // Deep link: ?open=<reel_id> scrolls straight to that reel
  const params = new URLSearchParams(location.search);
  const openId = params.get("open");
  if (openId) {
    const target = slides.find((s) => s.dataset.id === openId);
    target?.scrollIntoView({ block: "start" });
  }

  function escapeHtml(str = "") {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
