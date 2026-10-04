/* Grand Café Latino — interacciones */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Datos del local
  // ---------------------------------------------------------------------------
  const WHATSAPP = '34605264218';
  const NIGHTS = [5, 6];        // viernes, sábado
  const OPEN_H = 23;
  const CLOSE_H = 3;
  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ---------------------------------------------------------------------------
  // Hora de Lloret (Europe/Madrid) como fecha "de pared" en campos UTC
  // ---------------------------------------------------------------------------
  const madridFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  function madridNow() {
    const p = Object.fromEntries(madridFmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
  }
  function at(base, addDays, hour) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + addDays);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  }

  function nightState(now) {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (NIGHTS.includes(day) && hour >= OPEN_H) {
      return { open: true, night: day, target: at(now, 1, CLOSE_H) };
    }
    const prev = (day + 6) % 7;
    if (NIGHTS.includes(prev) && hour < CLOSE_H) {
      return { open: true, night: prev, target: at(now, 0, CLOSE_H) };
    }
    for (let i = 0; i < 8; i++) {
      const t = at(now, i, OPEN_H);
      if (NIGHTS.includes(t.getUTCDay()) && t > now) return { open: false, night: t.getUTCDay(), target: t, inDays: i };
    }
    return null;
  }

  // Estado en el hero + insignias + cuenta atrás
  const statusEl = $('[data-status]');
  const statusText = $('[data-status-text]');
  const cdLabel = $('[data-cd-label]');
  const cd = Object.fromEntries($$('[data-cd]').map((el) => [el.dataset.cd, el]));
  let state = null;

  function renderState() {
    const now = madridNow();
    state = nightState(now);
    if (!state) return;

    if (state.open) {
      statusEl.classList.add('is-open');
      statusText.textContent = 'Abierto ahora · hasta las 03:00';
      cdLabel.textContent = 'Estamos abiertos · cerramos en';
    } else {
      statusEl.classList.remove('is-open');
      const when = state.inDays === 0 ? 'Esta noche' : state.inDays === 1 ? 'Mañana' : DAY_NAMES[state.night];
      statusText.textContent = `${when} abrimos a las 23:00`;
      cdLabel.textContent = 'La próxima noche empieza en';
    }

    $$('.night').forEach((n) => {
      const badge = $('[data-badge]', n);
      const isThis = +n.dataset.day === state.night;
      badge.hidden = !isThis;
      badge.classList.toggle('is-live', isThis && state.open);
      if (isThis) badge.textContent = state.open ? 'Ahora' : state.inDays === 0 ? 'Hoy' : 'Próxima';
    });
  }

  function tick() {
    if (!state) return;
    const diff = state.target - madridNow();
    if (diff <= 0) { renderState(); return; }
    const s = Math.floor(diff / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    cd.d.textContent = pad(Math.floor(s / 86400));
    cd.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cd.m.textContent = pad(Math.floor((s % 3600) / 60));
    cd.s.textContent = pad(s % 60);
  }

  renderState();
  tick();
  setInterval(tick, 1000);

  // ---------------------------------------------------------------------------
  // Reservas → WhatsApp
  // ---------------------------------------------------------------------------
  const form = $('.form');
  const nightSelect = $('#f-night');
  const peopleOut = $('#f-people');
  const nameInput = $('#f-name');
  const note = $('[data-form-note]');

  (function fillNights() {
    const now = madridNow();
    const opts = [];
    for (let i = 0; opts.length < 8 && i < 40; i++) {
      const t = at(now, i, OPEN_H);
      if (!NIGHTS.includes(t.getUTCDay()) || t <= now) continue;
      const d = t.getUTCDay();
      const label = `${DAY_SHORT[d]} ${t.getUTCDate()} ${MONTH_SHORT[t.getUTCMonth()]} · 23:00`;
      const value = `${DAY_NAMES[d]} ${t.getUTCDate()} de ${MONTHS[t.getUTCMonth()]}`;
      opts.push(new Option(label, value));
    }
    nightSelect.append(...opts);
  })();

  let people = 4;
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    people = Math.min(30, Math.max(1, people + +b.dataset.step));
    peopleOut.value = people;
    peopleOut.textContent = people;
  }));

  function setError(input, msg) {
    const field = input.closest('.field');
    field.classList.toggle('has-error', !!msg);
    $('.field__err', field).textContent = msg || '';
  }
  nameInput.addEventListener('input', () => setError(nameInput, ''));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) {
      setError(nameInput, 'Dinos tu nombre para la reserva.');
      nameInput.focus();
      return;
    }
    const data = new FormData(form);
    const msg = (data.get('msg') || '').toString().trim();
    const lines = [
      'Hola Grand Café Latino 👋 Me gustaría reservar:',
      `• Nombre: ${name}`,
      `• Noche: ${data.get('night')}`,
      `• Personas: ${people}`,
      `• Motivo: ${data.get('type')}`,
    ];
    if (msg) lines.push(`• Comentarios: ${msg}`);
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    note.textContent = '¡Listo! Te abrimos WhatsApp con tu solicitud. Solo tienes que enviarla.';
  });

  // ---------------------------------------------------------------------------
  // Marquesinas: duplicar contenido para bucle infinito
  // ---------------------------------------------------------------------------
  $$('[data-marquee]').forEach((track) => {
    [...track.children].forEach((child) => {
      const clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      $$('img', clone).forEach((img) => { img.alt = ''; });
      track.append(clone);
    });
  });

  // ---------------------------------------------------------------------------
  // Texto gigante a ancho completo
  // ---------------------------------------------------------------------------
  function fitAll() {
    $$('[data-fit]').forEach((el) => {
      const available = el.parentElement.clientWidth
        - parseFloat(getComputedStyle(el.parentElement).paddingLeft)
        - parseFloat(getComputedStyle(el.parentElement).paddingRight);
      el.style.fontSize = '100px';
      const w = el.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = `${(100 * available) / w}px`;
    });
  }
  fitAll();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitAll);
  let resizeRaf;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      fitAll();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });

  // ---------------------------------------------------------------------------
  // Scroll suave (Lenis)
  // ---------------------------------------------------------------------------
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else (typeof target === 'number' ? window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }) : target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
  }

  // ---------------------------------------------------------------------------
  // Menú a pantalla completa
  // ---------------------------------------------------------------------------
  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  const menuLabel = $('.menu-btn__label');
  menu.inert = true;

  function openMenu() {
    root.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuLabel.textContent = 'Cerrar';
    menu.setAttribute('aria-hidden', 'false');
    menu.inert = false;
    lenis?.stop();
  }
  function closeMenu() {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuLabel.textContent = 'Menú';
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    lenis?.start();
  }
  menuBtn.addEventListener('click', () => (root.classList.contains('menu-open') ? closeMenu() : openMenu()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    // Esperar a que el menú empiece a cerrarse para que Lenis vuelva a estar activo
    setTimeout(() => scrollToTarget(target), 10);
  }));

  // ---------------------------------------------------------------------------
  // Cabecera: fondo al hacer scroll, se oculta al bajar
  // ---------------------------------------------------------------------------
  const hdr = $('.hdr');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    hdr.classList.toggle('is-scrolled', y > 40);
    hdr.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6);
    lastY = y;
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // Cursor personalizado
  // ---------------------------------------------------------------------------
  if (!reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.classList.add('has-cursor');
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });
    (function loop() {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, select, input, textarea, .night, .drink'));
    });
    document.addEventListener('mouseleave', () => { cursor.style.opacity = 0; });
    document.addEventListener('mouseenter', () => { cursor.style.opacity = 1; });
  }

  // ---------------------------------------------------------------------------
  // Animaciones (GSAP + ScrollTrigger)
  // ---------------------------------------------------------------------------
  if (!hasGSAP || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  // Entrada tras el loader
  gsap.timeline({ delay: 1.55 })
    .from('.hero__media img', { scale: 1.25, duration: 2.4, ease: 'expo.out' }, 0)
    .from('.hero__word > span', { yPercent: 110, duration: 1.3, stagger: 0.06, ease: 'expo.out' }, 0.05)
    .from('.hero__script', { y: 50, opacity: 0, rotate: -6, duration: 1.2, ease: 'expo.out' }, 0.35)
    .from('.hdr', { opacity: 0, duration: 1, ease: 'power2.out' }, 0.3)
    .from('.hero__top > *, .hero__bottom > *', { y: 20, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.55);

  // Parallax del hero
  gsap.to('.hero__media img', {
    yPercent: 14, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__title', {
    yPercent: -18, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true },
  });

  // Manifiesto palabra a palabra
  const manifesto = $('[data-words]');
  if (manifesto) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(manifesto);
    gsap.fromTo($$('.w', manifesto), { opacity: 0.14 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: manifesto, start: 'top 82%', end: 'bottom 50%', scrub: true },
    });
  }

  // Apariciones genéricas
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 46, opacity: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  // Cortinillas de imagen
  $$('[data-clip]').forEach((el) => {
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });

  // Parallax interno de imágenes
  $$('[data-parallax] img').forEach((img) => {
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Noches
  gsap.from('.night', {
    y: 70, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.nights', start: 'top 85%', once: true },
  });

  // Bandas: desplazamiento cruzado según el scroll
  gsap.set('.band--a', { clearProps: 'transform' });
  gsap.set('.band--b', { clearProps: 'transform' });
  gsap.set('.band--a', { yPercent: -50, rotation: -3 });
  gsap.set('.band--b', { yPercent: -50, rotation: 2.5 });
  gsap.fromTo('.band--a', { xPercent: 4 }, {
    xPercent: -4, ease: 'none',
    scrollTrigger: { trigger: '.bands', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.band--b', { xPercent: -4 }, {
    xPercent: 4, ease: 'none',
    scrollTrigger: { trigger: '.bands', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // Palabra final
  gsap.from('.ftr__word > span', {
    yPercent: 100, duration: 1.3, stagger: 0.05, ease: 'expo.out',
    scrollTrigger: { trigger: '.ftr__word', start: 'top 98%', once: true },
  });
})();
