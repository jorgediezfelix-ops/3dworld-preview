// Runs the mesh analysis off the main thread so large files do not freeze the page.
import { analyze } from './geometry.mjs';

self.onmessage = ({ data }) => {
  try {
    const report = analyze(data.positions, data.options);
    self.postMessage({ id: data.id, report, positions: data.positions }, [report.flags.buffer, data.positions.buffer]);
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message, positions: data.positions }, [data.positions.buffer]);
  }
};
