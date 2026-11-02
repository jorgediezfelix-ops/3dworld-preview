export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();

export function searchIndex(index, query, limit = 12) {
 const terms = normalize(query).split(' ').filter(Boolean);
 const preferred = ['servicios.html','tienda.html','cursos.html','herramientas.html','seguimiento.html','aula.html','taller.html','contacto.html'];
 if (!terms.length) return preferred.map(url => index.find(item => item.url === url)).filter(Boolean).slice(0, limit);
 return index.map((item, order) => {
  const title = normalize(item.title), details = normalize(`${item.description} ${item.keywords || ''}`);
  if (!terms.every(term => title.includes(term) || details.includes(term))) return null;
  const score = terms.reduce((sum, term) => sum + (title === term ? 50 : title.startsWith(term) ? 25 : title.includes(term) ? 12 : 1), 0) + (item.group === 'Servicios' || item.group === 'Herramientas' ? 3 : 0);
  return { item, score, order };
 }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(result => result.item);
}
