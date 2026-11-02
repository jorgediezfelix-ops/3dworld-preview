// Material selector and technology ranking for herramientas.html.

const LOADS = { baja: 25, media: 40, alta: 60 };
const FLEX = { rigido: 1, semiflexible: 3, flexible: 5 };
const BUDGET = { bajo: 2, medio: 3, alto: 5 };
const ENVIRONMENT = {
  exterior: { ok: m => m.uv >= 4, si: 'Aguanta sol y lluvia', no: 'Se degrada en exterior' },
  quimicos: { ok: m => m.quimica >= 4, si: 'Resiste aceites, combustibles y limpiadores', no: 'Le afectan algunos químicos' },
  impacto: { ok: m => m.impacto >= 12, si: 'Absorbe golpes sin romperse', no: 'Es frágil ante golpes' },
  humedad: { ok: m => m.humedad <= 3, si: 'Estable con humedad', no: 'Absorbe humedad y cambia de medida' },
  flama: { ok: m => m.flama, si: 'Baja flamabilidad (UL 94 V-0)', no: 'No es retardante a la flama', hard: true },
};

// needs: { temperatura °C, carga, flexibilidad, entorno: [ids], presupuesto }
export function recommendMaterials(materials, needs) {
  const temp = Number.isFinite(needs.temperatura) ? needs.temperatura : 25;
  const results = materials.map(m => {
    const pros = [], cons = [], out = [];
    let score = 0;
    if (m.servicio < temp) out.push(`Se ablanda arriba de ${m.servicio} °C`);
    else if (m.servicio < temp + 15) { score += 6; cons.push(`Trabaja cerca de su límite de ${m.servicio} °C`); }
    else { score += 20; if (temp >= 60) pros.push(`Uso continuo hasta ${m.servicio} °C`); }

    const minimum = LOADS[needs.carga] || LOADS.media;
    if (m.tension >= minimum) {
      score += 15 + Math.min(15, (m.tension - minimum) / 3);
      if (needs.carga === 'alta') pros.push(`${m.tension} MPa a la tensión y ${m.modulo} GPa de rigidez`);
    } else if (m.tension >= minimum * 0.8) { score += 5; cons.push('Resistencia justa para la carga'); }
    else out.push('Le falta resistencia para esta carga');

    const want = FLEX[needs.flexibilidad] || 1;
    if (want === 5 && m.flexibilidad < 4) out.push('No es flexible');
    else if (want < 5 && m.flexibilidad >= 4) out.push('Es demasiado flexible');
    else {
      score += 15 - Math.abs(m.flexibilidad - want) * 5;
      if (want >= 3) pros.push(m.flexibilidad >= 4 ? 'Flexible y elástico' : 'Cede sin romperse');
    }

    for (const id of needs.entorno || []) {
      const e = ENVIRONMENT[id];
      if (!e) continue;
      if (e.ok(m)) { score += 10; pros.push(e.si); }
      else if (e.hard) out.push(e.no);
      else { score -= 8; cons.push(e.no); }
    }

    const budget = BUDGET[needs.presupuesto] || 5;
    if (m.costo > budget + 1) out.push('Fuera del presupuesto');
    else if (m.costo > budget) { score -= 10; cons.push('Más caro de lo previsto'); }
    else score += (5 - m.costo) * 2;

    score += m.facilidad * 2;
    if (m.facilidad <= 2) cons.push('Requiere impresora con cámara caliente y experiencia');
    return { material: m, score: Math.round(score), pros, cons, out };
  });
  const fit = results.filter(r => !r.out.length).sort((a, b) => b.score - a.score);
  const top = fit[0]?.score || 1;
  fit.forEach(r => { r.level = r.score >= top * 0.9 ? 'ideal' : r.score >= top * 0.7 ? 'bueno' : 'posible'; });
  return { fit, discarded: results.filter(r => r.out.length) };
}

// weights: { criterion id: 0–3 }. Returns technologies best first with a 0–100 match.
export function rankTechnologies(technologies, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return technologies.map(t => {
    const points = Object.entries(weights).reduce((sum, [id, w]) => sum + w * (t.puntos[id] || 0), 0);
    return { technology: t, match: total ? Math.round(points / (total * 5) * 100) : 0 };
  }).sort((a, b) => b.match - a.match);
}
