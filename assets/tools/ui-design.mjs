// Design and engineering tools: ISO 286 and printed fits, beam strength and units.
import { $, $$, out, fmt, number, data } from './shared.mjs';
import { fit, printFit, PRESETS } from './fits.mjs';
import { check } from './beam.mjs';
import { CATEGORIES, convert, filament, inchFraction, parseFraction } from './units.mjs';

const el = (tag, attrs = {}, text) => {
  const node = Object.assign(document.createElement(tag), attrs);
  if (text != null) node.textContent = text;
  return node;
};
const sig = v => v.toLocaleString('es-MX', { maximumSignificantDigits: 6 });

const KIND = { juego: 'Ajuste con juego', transicion: 'Ajuste de transición', apriete: 'Ajuste con apriete' };

function zones(svg, f, holeCode, shaftCode) {
  const values = [0, f.hole.upper, f.hole.lower, f.shaft.upper, f.shaft.lower];
  const top = Math.max(...values), bottom = Math.min(...values), pad = (top - bottom) * 0.18 || 10;
  const y = v => 14 + (top + pad - v) / (top - bottom + 2 * pad) * 132;
  // Labels sit on the far side of the zero line so they never cross it.
  const zone = (x, a, b, cls, label) => `<rect class="${cls}" x="${x}" y="${y(a)}" width="76" height="${Math.max(2, y(b) - y(a))}" rx="3"/>`
    + `<text class="zone-label" x="${x + 38}" y="${(a + b) / 2 >= 0 ? y(a) - 6 : y(b) + 15}" text-anchor="middle">${label}</text>`;
  // Static markup with numbers and class codes chosen from fixed lists only.
  svg.innerHTML = `<line class="zone-zero" x1="44" x2="316" y1="${y(0)}" y2="${y(0)}"/><text class="zone-axis" x="40" y="${y(0) + 4}" text-anchor="end">0</text>`
    + `<text class="zone-axis" x="40" y="${y(top) + 4}" text-anchor="end">${fmt.n(top, 0)}</text><text class="zone-axis" x="40" y="${y(bottom) + 4}" text-anchor="end">${fmt.n(bottom, 0)}</text>`
    + zone(78, f.hole.upper, f.hole.lower, 'zone-hole', `Agujero ${holeCode}`) + zone(198, f.shaft.upper, f.shaft.lower, 'zone-shaft', `Eje ${shaftCode}`);
}

export async function tolerancias(section) {
  const tabs = $$('[role="tab"]', section);
  const select = tab => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next); next.focus();
    });
  });

  const iso = $('[data-form="iso"]', section);
  const preset = iso.elements.preset;
  preset.append(...PRESETS.map(p => el('option', { value: `${p.hole}/${p.shaft}` }, `${p.hole}/${p.shaft} · ${p.nombre}`)));
  const renderIso = () => {
    const size = number(iso, 'nominal', 25), hole = iso.elements.agujero.value, shaft = iso.elements.eje.value;
    const known = PRESETS.find(p => p.hole === hole && p.shaft === shaft);
    preset.value = known ? `${hole}/${shaft}` : '';
    out(iso, 'uso', known ? known.uso : 'Combinación elegida a mano.');
    try {
      const f = fit(size, hole, shaft);
      const lim = (l, code) => `${code}: ${(size + l.lower / 1000).toFixed(3)} a ${(size + l.upper / 1000).toFixed(3)} mm`;
      out(iso, 'tipo', KIND[f.type]);
      out(iso, 'juego', f.type === 'juego' ? `Juego de ${(f.min / 1000).toFixed(3)} a ${(f.max / 1000).toFixed(3)} mm`
        : f.type === 'apriete' ? `Apriete de ${(-f.max / 1000).toFixed(3)} a ${(-f.min / 1000).toFixed(3)} mm`
          : `Juego hasta ${(f.max / 1000).toFixed(3)} mm o apriete hasta ${(-f.min / 1000).toFixed(3)} mm`);
      out(iso, 'agujero', lim(f.hole, hole));
      out(iso, 'eje', lim(f.shaft, shaft));
      out(iso, 'max', `${(f.max / 1000).toFixed(3)} mm`);
      out(iso, 'min', `${(f.min / 1000).toFixed(3)} mm${f.min < 0 ? ' (apriete)' : ''}`);
      zones($('[data-zones]', iso), f, hole, shaft);
    } catch (error) {
      out(iso, 'juego', error.message);
    }
  };
  preset.addEventListener('change', () => {
    if (!preset.value) return;
    const [hole, shaft] = preset.value.split('/');
    iso.elements.agujero.value = hole; iso.elements.eje.value = shaft;
    renderIso();
  });
  iso.addEventListener('input', e => { if (e.target !== preset) renderIso(); });
  iso.addEventListener('submit', e => e.preventDefault());
  renderIso();

  const printed = $('[data-form="impresion"]', section);
  const renderPrint = () => {
    try {
      const r = printFit(number(printed, 'nominal', 8), printed.elements.ajuste.value, printed.elements.tecnologia.value, printed.elements.eje.value);
      out(printed, 'hole', `Ø ${r.hole.toFixed(2)} mm`);
      out(printed, 'shaft', `Ø ${r.shaft.toFixed(2)} mm`);
      out(printed, 'clearance', `${r.clearance.toFixed(2)} mm`);
      out(printed, 'compensation', r.compensation ? `+${r.compensation.toFixed(2)} mm por contracción del agujero` : 'No hace falta');
      out(printed, 'radial', `${r.radial.toFixed(3)} mm`);
      out(printed, 'detalle', `${r.fit.nombre}. ${r.fit.detalle}${r.technology === 'FDM' && printed.elements.eje.value === 'horizontal' ? ' Los agujeros acostados salen ovalados; una forma de gota en el techo del agujero evita soportes.' : ''}`);
    } catch (error) {
      out(printed, 'hole', error.message);
    }
  };
  printed.addEventListener('input', renderPrint);
  printed.addEventListener('change', renderPrint);
  printed.addEventListener('submit', e => e.preventDefault());
  renderPrint();
  return {};
}

const SHOWN = { rect: ['b', 'h'], hollow: ['b', 'h', 't'], round: ['d'], tube: ['d', 't'] };

export async function resistencia(section) {
  const { materiales } = await data;
  const form = $('form', section);
  const label = name => form.elements[name].closest('label');
  const render = () => {
    const shape = form.elements.seccion.value, caso = form.elements.caso.value;
    for (const k of ['b', 'h', 'd', 't']) label(k).hidden = !SHOWN[shape].includes(k);
    const F = number(form, 'kg', 0) * 9.80665, L = number(form, 'L', 0), required = Math.max(1, number(form, 'fs', 2));
    out(section, 'newtons', `${fmt.n(F, 1)} N`);
    const mat = materiales.materiales.find(m => m.id === form.elements.material.value);
    try {
      const r = check({ caso, F, L, shape, dims: { b: number(form, 'b'), h: number(form, 'h'), d: number(form, 'd'), t: number(form, 't') }, mat, layers: form.elements.capas.value, required });
      out(section, 'safety', fmt.n(r.safety, r.safety < 10 ? 2 : 0));
      out(section, 'stress', `${fmt.n(r.stress, 1)} MPa`);
      out(section, 'strength', `${fmt.n(r.strength, 0)} MPa${form.elements.capas.value === 'z' ? ' entre capas' : ''}`);
      out(section, 'deflection', fmt.mm(r.deflection));
      out(section, 'max', `${fmt.n(r.maxLoad, 0)} N (${fmt.n(r.maxLoad / 9.80665, 1)} kg)`);
      out(section, 'buckling', r.buckling ? `${fmt.n(r.buckling, 0)} N (${fmt.n(r.buckling / 9.80665, 1)} kg) en compresión` : 'No aplica a este caso');
      const verdict = $('[data-out="verdict"]', section);
      verdict.className = `tool-verdict is-${r.verdict}`;
      const bendy = caso !== 'tension' && r.deflection > L / 100;
      const buckles = r.buckling && F * required > r.buckling;
      verdict.textContent = (r.verdict === 'ok' ? 'Aguanta con margen.' : r.verdict === 'justo' ? 'Aguanta, pero con menos margen del que buscas: aumenta la sección o elige un material más fuerte.' : 'Se rompería o quedaría deformada con esta carga.')
        + (bendy ? ' Además se flexiona más del 1 % del claro; si necesita rigidez, aumenta la altura de la sección.' : '')
        + (buckles ? ' Si la carga es de compresión, la barra se pandearía antes de romperse.' : '');
    } catch (error) {
      out(section, 'safety', '—');
      out(section, 'verdict', error.message);
    }
  };
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());
  render();
  return {};
}

const PAIRS = { longitud: ['mm', 'in'], area: ['cm²', 'in²'], volumen: ['cm³', 'in³'], angulo: ['°', 'rad'], masa: ['g', 'oz'], densidad: ['g/cm³', 'lb/in³'],
  esfuerzo: ['MPa', 'psi'], fuerza: ['N', 'kgf'], par: ['N·m', 'lbf·in'], temperatura: ['°C', '°F'] };

export async function conversor(section) {
  const { materiales } = await data;
  const form = $('form', section);
  const { categoria, de, a } = form.elements;
  categoria.append(...Object.entries(CATEGORIES).map(([id, c]) => el('option', { value: id }, c.nombre)));
  const fill = () => {
    const units = Object.keys(CATEGORIES[categoria.value].units);
    for (const s of [de, a]) s.replaceChildren(...units.map(u => el('option', { value: u }, u)));
    [de.value, a.value] = PAIRS[categoria.value];
  };
  const render = () => {
    const value = number(form, 'valor', 0), cat = categoria.value;
    out(section, 'resultado', `${sig(convert(value, de.value, a.value, cat))} ${a.value}`);
    out(section, 'tabla', `${sig(value)} ${de.value} equivale a`);
    $('[data-units]', section).replaceChildren(...Object.keys(CATEGORIES[cat].units).filter(u => u !== de.value).map(u => {
      const tr = el('tr');
      tr.append(el('td', {}, sig(convert(value, de.value, u, cat))), el('th', { scope: 'row' }, u));
      return tr;
    }));
  };
  const renderFilament = () => {
    const m = materiales.materiales.find(x => x.id === form.elements.filamento.value);
    const f = filament({ grams: number(form, 'gramos', 1000), diameter: +form.elements.diametro.value, density: m.densidad });
    out(section, 'filamento', `${fmt.n(f.meters, 1)} m de filamento (${fmt.n(f.gramsPerMeter, 2)} g por metro).`);
  };
  const renderFraction = source => {
    if (source === 'fraccion') {
      const mm = parseFraction(form.elements.fraccion.value);
      if (Number.isFinite(mm)) form.elements.mm.value = +mm.toFixed(4);
    }
    const mm = number(form, 'mm', 0);
    const f = inchFraction(mm);
    if (source === 'mm') form.elements.fraccion.value = f.text;
    out(section, 'fraccion', `${fmt.n(mm, 3)} mm ≈ ${f.text} (${fmt.n(f.inches, 4)} in; diferencia ${fmt.n(Math.abs(f.error), 3)} mm).`);
  };
  form.addEventListener('input', e => {
    const n = e.target.name;
    if (['gramos', 'diametro', 'filamento'].includes(n)) renderFilament();
    else if (n === 'fraccion' || n === 'mm') renderFraction(n);
    else render();
  });
  form.addEventListener('change', e => {
    if (e.target === categoria) fill();
    if (['de', 'a', 'categoria'].includes(e.target.name)) render();
    if (['diametro', 'filamento'].includes(e.target.name)) renderFilament();
  });
  form.addEventListener('submit', e => e.preventDefault());
  fill(); render(); renderFilament(); renderFraction('fraccion');
  return {};
}
