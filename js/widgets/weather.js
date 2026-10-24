/* Weather widget: current conditions + 3-day outlook from Open-Meteo (free, no API key).
   Uses the city you type, or your location if you leave it blank. Cached for 30 minutes. */
(function () {
  const W = window.Lumevale;
  const { esc } = W.wh;
  const TTL = 30 * 60000;

  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 9.6 4.5 4.5 0 007 18.5z"/>',
    partly: '<path d="M8.5 4.2v1.4M3.2 9.5h1.4M4.8 5.8l1 1M12.2 5.8l-1 1"/><path d="M5.6 11.6A3.4 3.4 0 0111.4 8"/><path d="M9 19.5h8.5a3.5 3.5 0 00.5-6.96 4.8 4.8 0 00-9.1-.84A3.9 3.9 0 009 19.5z"/>',
    rain: '<path d="M7 15h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.1 4.5 4.5 0 007 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
    snow: '<path d="M7 15h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.1 4.5 4.5 0 007 15z"/><path d="M8 18.5h.01M12 20h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01"/>',
    storm: '<path d="M7 15h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.1 4.5 4.5 0 007 15z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
  };
  function describe(code, isDay = 1) {
    if (code === 0) return [isDay ? 'sun' : 'moon', 'Clear'];
    if (code <= 2) return [isDay ? 'partly' : 'moon', code === 1 ? 'Mostly clear' : 'Partly cloudy'];
    if (code === 3) return ['cloud', 'Overcast'];
    if (code <= 48) return ['fog', 'Foggy'];
    if (code <= 57) return ['rain', 'Drizzle'];
    if (code <= 67) return ['rain', 'Rain'];
    if (code <= 77) return ['snow', 'Snow'];
    if (code <= 82) return ['rain', 'Showers'];
    if (code <= 86) return ['snow', 'Snow showers'];
    return ['storm', 'Thunderstorm'];
  }
  const icon = (name, cls = '') => `<svg class="wx-ico ${cls}" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  async function locate(city) {
    if (city) {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`);
      const j = await r.json();
      if (!j.results || !j.results.length) throw new Error(`Couldn’t find “${city}”`);
      const g = j.results[0];
      return { lat: g.latitude, lon: g.longitude, name: g.name };
    }
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('Set a city in Widgets settings'));
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, name: 'Your location' }),
        () => rej(new Error('Set a city in Widgets settings')),
        { timeout: 8000, maximumAge: 3600000 },
      );
    });
  }

  W.registerWidget({
    id: 'weather',
    name: 'Weather',
    desc: 'Conditions and a 3-day outlook (Open-Meteo)',
    pos: { x: 1, y: 0 },
    card: true,
    defaults: { on: false, city: '', unit: 'c', cache: null },
    config: [
      { key: 'city', label: 'City', type: 'text', placeholder: 'blank = my location', hint: 'Looked up with Open-Meteo, a free weather service' },
      { key: 'unit', label: 'Units', type: 'select', options: [['c', '°C'], ['f', '°F']] },
    ],
    create(el, cfg, api) {
      let loading = false;
      const key = () => `${cfg.city.trim().toLowerCase()}|${cfg.unit}`;

      function render(data, err) {
        el.classList.toggle('wx-msg', !!err);
        if (err) {
          el.innerHTML = `<div class="w-empty">${esc(err)}</div>`;
          return;
        }
        if (!data) {
          el.innerHTML = '<div class="w-empty">Loading weather…</div>';
          return;
        }
        const c = data.current, d = data.daily;
        const [ico, text] = describe(c.weather_code, c.is_day);
        const days = d.time.slice(1, 4).map((t, i) => {
          const [di] = describe(d.weather_code[i + 1], 1);
          const name = new Date(`${t}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
          return `<div class="wx-day"><span>${name}</span>${icon(di, 'sm')}<span>${Math.round(d.temperature_2m_max[i + 1])}°</span></div>`;
        }).join('');
        el.innerHTML = `
          <div class="wx-now">${icon(ico)}<div class="wx-temp">${Math.round(c.temperature_2m)}°</div></div>
          <div class="wx-desc">${text} · <span>H ${Math.round(d.temperature_2m_max[0])}° L ${Math.round(d.temperature_2m_min[0])}°</span></div>
          <div class="wx-place">${esc(data.place)}</div>
          <div class="wx-days">${days}</div>`;
      }

      async function refresh(force) {
        const cache = api.cfg().cache;
        if (!force && cache && cache.key === key() && Date.now() - cache.at < TTL) return render(cache.data);
        if (loading) return;
        loading = true;
        if (!cache || cache.key !== key()) render(null);
        try {
          const loc = await locate(cfg.city.trim());
          const unit = cfg.unit === 'f' ? 'fahrenheit' : 'celsius';
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
            + '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min'
            + `&timezone=auto&forecast_days=4&temperature_unit=${unit}`;
          const j = await (await fetch(url)).json();
          const data = { current: j.current, daily: j.daily, place: loc.name };
          api.save({ cache: { key: key(), at: Date.now(), data } });
          render(data);
        } catch (e) {
          if (cache && cache.key === key()) render(cache.data);
          else render(null, e.message || 'Weather unavailable');
        } finally {
          loading = false;
        }
      }
      refresh();
      let ticks = 0;
      return {
        tick() { if (++ticks % 300 === 0) refresh(); },
        update(c) {
          const changed = c.city !== cfg.city || c.unit !== cfg.unit;
          cfg = c;
          if (changed) refresh(true);
        },
      };
    },
  });
})();
