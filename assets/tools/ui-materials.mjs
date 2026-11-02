// Material selector, material comparison and technology comparison.
import { $, $$, out, fmt, data } from './shared.mjs';
import { recommendMaterials, rankTechnologies } from './recommend.mjs';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const LEVEL = { ideal: 'Ideal', bueno: 'Buena opción', posible: 'Posible' };

// Other tools open with the chosen material already selected.
function preselect(materialId) {
  const quote = $('#cotizador [name="material"]');
  if (quote) { quote.value = materialId; quote.dispatchEvent(new Event('change', { bubbles: true })); }
  const tech = $('#cotizador [name="tecnologia"][value="FDM"]');
  if (tech && !tech.checked) { tech.checked = true; tech.dispatchEvent(new Event('change', { bubbles: true })); }
}
function addToComparison(materialId) {
  const boxes = $$('#comparador [name="m"]');
  const box = boxes.find(b => b.value === materialId);
  if (!box || box.checked) return;
  const checked = boxes.filter(b => b.checked);
  if (checked.length >= 4) checked.at(-1).checked = false;
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}
document.addEventListener('click', e => {
  const quote = e.target.closest('[data-quote-material]');
  if (quote) preselect(quote.dataset.quoteMaterial);
  const compare = e.target.closest('[data-compare]');
  if (compare) addToComparison(compare.dataset.compare);
}, true);

export async function selector(section) {
  const { materiales } = await data;
  const form = $('form', section);
  const picks = $('[data-picks]', section), discarded = $('[data-discarded]', section);
  const render = () => {
    const temperatura = +form.elements.temperatura.value;
    out(section, 'temperatura', `${temperatura} °C`);
    const { fit, discarded: out_ } = recommendMaterials(materiales.materiales, {
      temperatura, carga: form.elements.carga.value, flexibilidad: form.elements.flexibilidad.value,
      entorno: $$('[name="entorno"]:checked', form).map(c => c.value), presupuesto: form.elements.presupuesto.value,
    });
    picks.replaceChildren(...(fit.length ? fit.slice(0, 5).map(r => {
      const m = r.material, li = el('li', `pick is-${r.level}`);
      const head = el('div', 'pick-head');
      head.append(el('strong', '', m.nombre), el('span', 'pick-level', LEVEL[r.level]));
      li.append(head, el('p', 'pick-specs', `${m.familia}: ${m.tension} MPa a la tensión y uso continuo hasta ${m.servicio} °C.`));
      const list = (items, cls) => { const ul = el('ul', cls); items.forEach(t => ul.append(el('li', '', t))); return ul; };
      if (r.pros.length) li.append(list(r.pros, 'pick-pros'));
      if (r.cons.length) li.append(list(r.cons, 'pick-cons'));
      li.append(el('p', 'pick-uses', `Se usa en: ${m.usos.join(', ').toLowerCase()}.`));
      const actions = el('div', 'pick-actions');
      const quote = el('a', 'text-link', 'Cotizar en este material');
      quote.href = '#cotizador'; quote.dataset.quoteMaterial = m.id;
      const compare = el('a', 'text-link', 'Comparar');
      compare.href = '#comparador'; compare.dataset.compare = m.id;
      actions.append(quote, compare);
      li.append(actions);
      return li;
    }) : [el('li', 'pick is-none', 'Ningún material cumple todo a la vez. Afloja una condición o escríbenos: revisamos opciones especiales.')]));
    out(section, 'descartados', `Descartados (${out_.length})`);
    discarded.replaceChildren(...out_.map(r => {
      const li = el('li');
      li.append(el('strong', '', r.material.nombre), document.createTextNode(`: ${r.out.join('; ').toLowerCase()}.`));
      return li;
    }));
  };
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  render();
  return {};
}

export async function comparador(section) {
  const { materiales } = await data;
  const form = $('form', section);
  const head = $('[data-compare-head]', section), body = $('[data-compare-body]', section);
  const boxes = $$('[name="m"]', form);
  const byId = Object.fromEntries(materiales.materiales.map(m => [m.id, m]));
  const share = (p, v) => (p.escala === 'log' ? Math.log10(1 + v) / Math.log10(1 + p.max) : v / p.max);
  const render = () => {
    const chosen = boxes.filter(b => b.checked).map(b => byId[b.value]);
    boxes.forEach(b => { b.disabled = !b.checked && chosen.length >= 4; });
    const tr = el('tr');
    tr.append(el('th', '', 'Propiedad'), ...chosen.map(m => { const th = el('th', '', m.nombre); th.scope = 'col'; return th; }));
    tr.firstChild.scope = 'col';
    head.replaceChildren(tr);
    const rows = materiales.propiedades.map(p => {
      const row = el('tr'), th = el('th', '', p.nombre);
      th.scope = 'row';
      row.append(th);
      const best = p.id === 'densidad' ? null : Math.max(...chosen.map(m => m[p.id]));
      for (const m of chosen) {
        const td = el('td', m[p.id] === best && chosen.length > 1 ? 'is-best' : '');
        const value = el('span', 'bar-value', p.unidad === '1–5' ? `${m[p.id]} de 5` : `${fmt.n(m[p.id], 2)} ${p.unidad}`);
        const bar = el('span', 'bar');
        bar.style.setProperty('--share', Math.min(1, share(p, m[p.id])).toFixed(3));
        bar.setAttribute('aria-hidden', 'true');
        td.append(value, bar);
        row.append(td);
      }
      return row;
    });
    const text = [['Familia', m => m.familia], ['Boquilla', m => m.boquilla], ['Cama', m => m.cama], ['Cámara cerrada', m => (m.camara ? 'Necesaria' : 'No hace falta')],
      ['Usos típicos', m => m.usos.join('; ')], ['Cuándo evitarlo', m => m.evita]];
    for (const [label, get] of text) {
      const row = el('tr', 'is-text'), th = el('th', '', label);
      th.scope = 'row';
      row.append(th, ...chosen.map(m => el('td', '', get(m))));
      rows.push(row);
    }
    body.replaceChildren(...(chosen.length ? rows : [Object.assign(el('tr'), { innerHTML: '<td>Elige al menos un material.</td>' })]));
  };
  form.addEventListener('change', render);
  render();
  return { show: render };
}

export async function tecnologias(section) {
  const { tecnologias: t } = await data;
  const form = $('form', section);
  const list = $('[data-rank]', section);
  const WORDS = ['No importa', 'Poco', 'Importante', 'Esencial'];
  const render = () => {
    const weights = Object.fromEntries(t.criterios.map(c => [c.id, +form.elements[c.id].value]));
    t.criterios.forEach(c => out(section, `w-${c.id}`, WORDS[weights[c.id]]));
    const ranked = rankTechnologies(t.tecnologias, weights);
    list.replaceChildren(...ranked.map((r, i) => {
      const li = el('li', i === 0 ? 'rank is-top' : 'rank');
      const head = el('div', 'rank-head');
      head.append(el('strong', '', `${r.technology.nombre}`), el('span', 'rank-match', `${r.match} % de coincidencia`));
      const bar = el('span', 'bar');
      bar.style.setProperty('--share', (r.match / 100).toFixed(3));
      bar.setAttribute('aria-hidden', 'true');
      li.append(head, bar, el('p', '', r.technology.ideal));
      if (r.technology.ofrecemos) {
        const a = el('a', 'text-link', r.technology.id === 'SLS' ? 'Cotizar en SLS' : 'Cotizar en FDM');
        a.href = '#cotizador';
        a.addEventListener('click', () => {
          const radio = $(`#cotizador [name="tecnologia"][value="${r.technology.id}"]`);
          if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        li.append(a);
      } else li.append(el('p', 'rank-note', 'No la fabricamos en casa; te ayudamos a preparar el diseño para este proceso.'));
      return li;
    }));
  };
  form.addEventListener('input', render);
  render();
  return {};
}
