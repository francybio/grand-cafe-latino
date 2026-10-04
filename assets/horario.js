/*
  Horario de Grand Café Latino: fuente única para el estado "abierto ahora",
  las próximas noches y la validación de reservas. Siempre en hora de Madrid,
  esté donde esté quien visita la web.

  Fuente: grandcafelatino.com, "Todos los días 20:00 a 3:00". Su blog
  (sept. 2026) confirma que fuera de temporada también abren los siete días.
  Para cambiar el horario, editar solo CONFIG.
*/
(function (global) {
  const TZ = 'Europe/Madrid';
  const CONFIG = { dias: [0, 1, 2, 3, 4, 5, 6], abre: '20:00', cierra: '3:00' };

  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const civil = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
  const addDays = (dt, n) => new Date(dt.getTime() + n * 864e5);
  const parts = (dt) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay() });

  function madridNow(date = new Date()) {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    return { today: civil(+p.year, +p.month, +p.day), min: +p.hour * 60 + +p.minute };
  }

  // Horario de la noche que EMPIEZA en esa fecha, o null si no abren.
  function nightOf(dt) {
    if (!CONFIG.dias.includes(parts(dt).wd)) return null;
    return { date: dt, abre: CONFIG.abre, cierra: CONFIG.cierra };
  }

  function status(now = new Date()) {
    const { today, min } = madridNow(now);
    const last = nightOf(addDays(today, -1));
    if (last && min < toMin(last.cierra)) return { open: true, night: last };
    const tonight = nightOf(today);
    if (tonight && min >= toMin(tonight.abre)) return { open: true, night: tonight };
    if (tonight) return { open: false, next: tonight, inDays: 0 };
    for (let i = 1; i <= 14; i++) {
      const n = nightOf(addDays(today, i));
      if (n) return { open: false, next: n, inDays: i };
    }
    return { open: false, next: null };
  }

  function nextNights(count = 4, now = new Date()) {
    const { today, min } = madridNow(now);
    const out = [];
    const last = nightOf(addDays(today, -1));
    if (last && min < toMin(last.cierra)) out.push(last);
    for (let i = 0; out.length < count && i < 60; i++) {
      const n = nightOf(addDays(today, i));
      if (n) out.push(n);
    }
    return out;
  }

  function nightOnISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return nightOf(civil(y, m, d));
  }

  function nextNightFromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = civil(y, m, d);
    for (let i = 0; i < 60; i++) { const n = nightOf(addDays(dt, i)); if (n) return n; }
    return null;
  }

  // Semana de lunes a domingo
  function week() {
    return [1, 2, 3, 4, 5, 6, 0].map((wd) => ({ wd, open: CONFIG.dias.includes(wd), abre: CONFIG.abre, cierra: CONFIG.cierra }));
  }

  function todayISO(now = new Date()) {
    const { y, m, d } = parts(madridNow(now).today);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function weekdayIndexToday(now = new Date()) {
    return parts(madridNow(now).today).wd;
  }

  const fmt = {
    weekday: (dt, lang, style = 'long') => new Intl.DateTimeFormat(lang, { weekday: style, timeZone: 'UTC' }).format(dt),
    dayMonth: (dt, lang) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt),
    long: (dt, lang) => new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt),
    // Fecha de referencia para nombrar días de la semana: 4 oct. 2026 es domingo (wd 0)
    wdName: (wd, lang, style = 'long') => new Intl.DateTimeFormat(lang, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 4 + wd, 12)))
  };

  const TEXT = {
    es: {
      open: (c) => `Abierto ahora · hasta las ${c}`,
      today: (a) => `Hoy abrimos a las ${a}`,
      tomorrow: (a) => `Abrimos mañana a las ${a}`,
      later: (wd, a) => `Abrimos el ${wd} a las ${a}`,
      every: 'Todos los días', and: ' y '
    },
    en: {
      open: (c) => `Open now · until ${c}`,
      today: (a) => `Opening today at ${a}`,
      tomorrow: (a) => `Opening tomorrow at ${a}`,
      later: (wd, a) => `Next opening: ${wd} at ${a}`,
      every: 'Every day', and: ' & '
    },
    fr: {
      open: (c) => `Ouvert · jusqu’à ${c}`,
      today: (a) => `Ouverture aujourd’hui à ${a}`,
      tomorrow: (a) => `Ouverture demain à ${a}`,
      later: (wd, a) => `Prochaine ouverture : ${wd} à ${a}`,
      every: 'Tous les jours', and: ' et '
    }
  };

  function statusText(st, lang = 'es') {
    const T = TEXT[lang] || TEXT.es;
    if (st.open) return T.open(st.night.cierra);
    if (!st.next) return '';
    if (st.inDays === 0) return T.today(st.next.abre);
    if (st.inDays === 1) return T.tomorrow(st.next.abre);
    return T.later(fmt.weekday(st.next.date, lang), st.next.abre);
  }

  function hoursText(lang = 'es') {
    const T = TEXT[lang] || TEXT.es;
    const days = CONFIG.dias.length === 7 ? T.every
      : [1, 2, 3, 4, 5, 6, 0].filter((d) => CONFIG.dias.includes(d)).map((d) => fmt.wdName(d, lang, 'short').replace('.', '')).join(T.and);
    return `${days.charAt(0).toUpperCase() + days.slice(1)} · ${CONFIG.abre}–${CONFIG.cierra}`;
  }

  global.Horario = {
    CONFIG, status, statusText, hoursText, nextNights, nightOnISO, nextNightFromISO,
    week, todayISO, weekdayIndexToday, fmt, toMin
  };
})(window);
