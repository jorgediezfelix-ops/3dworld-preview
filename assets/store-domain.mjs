// Pure catalog rules shared by the browser and the payment service.
export const MAX_QTY = 10, MAX_LINES = 40;
export const money = value => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(value);
export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// One static page per product (productos/<id>.html); the variant travels in the query string.
export const productUrl = (p, variant = '') => `productos/${encodeURIComponent(p.id)}.html${variant && variant !== p.id ? '?variante=' + encodeURIComponent(variant) : ''}`;
export function indexCatalog(store) {
  if (store.schemaVersion !== 2 || !Array.isArray(store.products)) throw new Error('Catálogo incompatible');
  const variants = new Map(), products = new Map();
  for (const p of store.products) {
    if (products.has(p.id) || !store.shipping[p.size] || !Array.isArray(p.variants) || !p.variants.length) throw new Error('Producto inválido');
    products.set(p.id, p);
    for (const alias of p.aliases || []) {
      if (products.has(alias)) throw new Error('Referencia ambigua');
      products.set(alias, p);
    }
    for (const v of p.variants) {
      if (!v.id || variants.has(v.id) || !Number.isSafeInteger(v.price) || v.price <= 0 || typeof v.available !== 'boolean') throw new Error('Variante inválida');
      variants.set(v.id, {p, v});
    }
  }
  return {products, variants};
}
// Own stock (units 3DWORLD holds, from /api/existencias) makes a variant available even when the supplier has none;
// without supplier stock, a line cannot ask for more units than 3DWORLD holds.
export function withStock(store, stock) {
  if (!stock || !Object.keys(stock).length) return store;
  return {...store, products: store.products.map(p => p.variants.some(v => stock[v.id] > 0)
    ? {...p, variants: p.variants.map(v => stock[v.id] > 0 ? {...v, available: true, ownStock: stock[v.id], supplierAvailable: v.available} : v)}
    : p)};
}
export function resolveLines(store, items) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_LINES) return null;
  const {variants} = indexCatalog(store), lines = new Map();
  for (const item of items) {
    const entry = item && variants.get(item.id), qty = item?.qty;
    if (!entry?.v.available || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
    const total = (lines.get(item.id)?.qty || 0) + qty;
    if (total > MAX_QTY || (entry.v.supplierAvailable === false && total > entry.v.ownStock)) return null;
    const {p, v} = entry;
    lines.set(item.id, {id:item.id, qty:total, product:{title:p.title, config:v.label || p.brand, price:v.price, size:p.size}});
  }
  return [...lines.values()];
}
export function shippingTotal(store, lines) {
  const groups = new Map();
  for (const {product, qty} of lines) groups.set(product.size, (groups.get(product.size) || 0) + qty);
  return [...groups].reduce((sum, [size, count]) => {
    const rate = store.shipping[size];
    if (!rate || !Number.isSafeInteger(rate.price) || rate.per < 1) throw new Error('Envío inválido');
    return sum + Math.ceil(count / rate.per) * rate.price;
  }, 0);
}
