// Carrusel de funciones: la tarjeta centrada se marca como activa (más
// grande, con su descripción visible); las de los lados quedan atenuadas.
// Soporta varios carruseles en la misma página (cada uno con su propio
// track, flechas y puntos, agrupados bajo [data-carousel-wrap]).
(function () {
  function initCarousel(wrap) {
    const track = wrap.querySelector("[data-track]");
    if (!track) return;

    const slides = Array.from(track.querySelectorAll("[data-slide]"));
    const dotsWrap = wrap.querySelector("[data-dots]");
    const prevBtn = wrap.querySelector("[data-prev]");
    const nextBtn = wrap.querySelector("[data-next]");

    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "car-dot";
      dot.setAttribute("aria-label", `Ir a la diapositiva ${i + 1}`);
      dot.addEventListener("click", () => scrollToSlide(i));
      dotsWrap.appendChild(dot);
      return dot;
    });

    function activeIndex() {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closest = 0;
      let min = Infinity;
      slides.forEach((slide, i) => {
        const r = slide.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < min) {
          min = d;
          closest = i;
        }
      });
      return closest;
    }

    function update() {
      const idx = activeIndex();
      slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
      dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    }

    function scrollToSlide(i) {
      const slide = slides[i];
      if (!slide) return;
      const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      track.scrollTo({ left, behavior: "smooth" });
    }

    let ticking = false;
    track.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      },
      { passive: true }
    );

    if (prevBtn) prevBtn.addEventListener("click", () => scrollToSlide(Math.max(0, activeIndex() - 1)));
    if (nextBtn) nextBtn.addEventListener("click", () => scrollToSlide(Math.min(slides.length - 1, activeIndex() + 1)));

    window.addEventListener("resize", () => scrollToSlide(activeIndex()));

    update();
    requestAnimationFrame(() => scrollToSlide(0));
  }

  document.querySelectorAll("[data-carousel-wrap]").forEach(initCarousel);
})();

// Menú de hamburguesa del header.
(function () {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!toggle || !menu) return;

  function close() {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== toggle) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();

// Animación de aparición al hacer scroll para las secciones marcadas.
(function () {
  const els = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));
})();

// Selector de tema claro/oscuro. Compartido entre todas las páginas de la
// web vía localStorage (misma clave que usa la app, aunque son storages
// de orígenes distintos, así que no se sincronizan entre sí).
(function () {
  const KEY = "clever_theme";
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  if (!toggles.length) return;

  function current() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function syncButtons() {
    const isLight = current() === "light";
    toggles.forEach((btn) => {
      btn.textContent = isLight ? "🌙" : "☀️";
      btn.setAttribute("aria-label", isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
    });
  }
  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = current() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        // Modo privado / almacenamiento bloqueado: el tema no se recuerda
        // entre visitas, pero el cambio sigue funcionando en esta página.
      }
      syncButtons();
    });
  });
  syncButtons();
})();
