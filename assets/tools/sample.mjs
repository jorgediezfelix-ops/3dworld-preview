// The sample part behind «Probar con una pieza de ejemplo»: a shelf bracket (post and arm) as one closed
// solid, so the viewer, the analyser (its arm needs support) and the quote all have something to show.

// Extrude a profile in the XZ plane along Y. boundary runs counter-clockwise; caps are triangles over it.
function extrude(boundary, caps, width) {
  const out = [];
  const at = ([x, z], y) => [x, y, z];
  for (const [a, b, c] of caps) out.push(...at(boundary[a], width), ...at(boundary[c], width), ...at(boundary[b], width),
    ...at(boundary[a], 0), ...at(boundary[b], 0), ...at(boundary[c], 0));
  boundary.forEach((p, i) => {
    const q = boundary[(i + 1) % boundary.length];
    out.push(...at(p, 0), ...at(q, width), ...at(q, 0), ...at(p, 0), ...at(p, width), ...at(q, width));
  });
  return Float32Array.from(out);
}

export function shelfBracket({ height = 60, reach = 50, thickness = 5, width = 30 } = {}) {
  const h = height, t = thickness, r = reach;
  const boundary = [[0, 0], [t, 0], [t, h - t], [r, h - t], [r, h], [t, h], [0, h]];
  const caps = [[0, 1, 2], [0, 2, 5], [0, 5, 6], [2, 3, 4], [2, 4, 5]];
  return extrude(boundary, caps, width);
}
