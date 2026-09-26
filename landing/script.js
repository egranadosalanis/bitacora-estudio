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

// Ventana "Novedades" (menú ☰ → Novedades, o enlazando a #novedades).
// Recoge lo que trae la última actualización de la app. Para anunciar otra
// basta con cambiar NEWS_HTML.
(function () {
  const SUPPORT_EMAIL = "cleverapp2026@gmail.com";
  const GMAIL_URL = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(SUPPORT_EMAIL);
  const NEWS_HTML = `
    <h2 class="news-heading" id="news-heading">🚀 Novedades en Clever</h2>
    <p class="news-date">Actualización · septiembre 2026</p>
    <section class="news-item">
      <div class="news-icon">🎓</div>
      <div>
        <div class="news-title">Universidad, carrera y asignaturas ya se buscan, no se escriben</div>
        <ul>
          <li>Al añadir una asignatura la buscas en el listado de tu carrera en vez de escribirla a mano, para poder comparar tus datos con los de otros estudiantes de forma fiable.</li>
          <li>Si no aparece, se guarda como <strong>pendiente de revisión</strong> y ya puedes usarla — no te bloquea.</li>
          <li>Si es una asignatura de Erasmus, márcala como tal: cuenta igual en tus horas, pero nunca entra en la revisión.</li>
          <li>Al entrar por primera vez tras esta actualización te pediremos vincular tu universidad, carrera y las asignaturas que ya tenías — un paso obligatorio, pero corto.</li>
          <li>Tu historial y tus minutos registrados no se pierden ni se alteran en ningún momento.</li>
        </ul>
      </div>
    </section>
    <section class="news-item">
      <div class="news-icon">⏱️</div>
      <div>
        <div class="news-title">El registro ahora suma, siempre desde 0</div>
        <ul>
          <li><strong>Registro de vuelo</strong> sirve para <em>añadir</em> minutos: escribe (o mide con el <strong>contador</strong>) lo que acabas de estudiar y pulsa Guardar. Se suma a lo que ya tenías ese día y el formulario vuelve a 0.</li>
          <li>Cada vez que guardas se crea una <strong>sesión</strong>. En <strong>Registros de hoy</strong> ves el total de cada asignatura; tócala para desplegar sus sesiones y corregir o borrar cualquiera.</li>
          <li><strong>Últimos registros</strong> sigue mostrando el total de cada asignatura por día.</li>
          <li>Móvil y ordenador ya no se pisan: puedes guardar desde los dos y todo se suma.</li>
          <li>Si la app se cierra a mitad de un registro, al volver no se pierde ni se duplica lo que tenías pendiente.</li>
          <li>El <strong>máximo en una sesión</strong> del Panel ahora mide cada sesión por separado.</li>
        </ul>
      </div>
    </section>
    <section class="news-item">
      <div class="news-icon">🐞</div>
      <div>
        <div class="news-title">¿Algo no funciona? Cuéntanoslo</div>
        <p>
          Dentro de la app, desde <strong>☰ → Reportar un problema</strong>, puedes enviarnos errores o sugerencias en un momento.
          También puedes escribirnos directamente a
          <a href="${GMAIL_URL}" target="_blank" rel="noopener noreferrer">${SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </section>
    <div class="news-actions">
      <button class="btn btn-primary" type="button" data-news-close>¡Entendido!</button>
    </div>`;

  const openers = document.querySelectorAll("[data-news-open]");
  let dialog = null;

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "news-dialog";
    dialog.setAttribute("aria-labelledby", "news-heading");
    dialog.innerHTML = `
      <div class="ui-window">
        <div class="ui-window-bar">
          <span></span><span></span><span></span>
          <b class="news-dialog-label">Novedades</b>
          <button class="news-close" type="button" data-news-close aria-label="Cerrar">×</button>
        </div>
        <div class="ui-body">${NEWS_HTML}</div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-news-close]").forEach((b) => b.addEventListener("click", close));
    // Tocar fuera de la ventana (en el fondo oscurecido) también la cierra.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    dialog.addEventListener("close", () => {
      if (location.hash === "#novedades") history.replaceState(null, "", location.pathname + location.search);
    });
  }

  function open() {
    if (!dialog) build();
    const menu = document.querySelector("[data-menu]");
    const toggle = document.querySelector("[data-menu-toggle]");
    if (menu) menu.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function close() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  openers.forEach((btn) => btn.addEventListener("click", open));
  if (location.hash === "#novedades") open();
})();
