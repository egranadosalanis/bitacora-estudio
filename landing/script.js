// Carrusel de funciones: la tarjeta centrada se marca como activa (más
// grande, con su descripción visible); las de los lados quedan atenuadas.
(function () {
  const track = document.querySelector("[data-track]");
  if (!track) return;

  const slides = Array.from(track.querySelectorAll("[data-slide]"));
  const dotsWrap = document.querySelector("[data-dots]");
  const prevBtn = document.querySelector("[data-prev]");
  const nextBtn = document.querySelector("[data-next]");

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "car-dot";
    dot.setAttribute("aria-label", `Ir a la función ${i + 1}`);
    dot.addEventListener("click", () => scrollToSlide(i));
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);

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
