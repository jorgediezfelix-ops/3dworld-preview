// Match replies to their request. Several file/unit changes can be in flight together.
export function createAnalysisClient(makeWorker) {
 let worker = null, sequence = 0;
 const pending = new Map();
 function fail() {
  worker?.terminate();worker = null;
  for (const { reject } of pending.values()) reject(new Error('worker'));
  pending.clear();
 }
 return positions => new Promise((resolve, reject) => {
  try {
   if (!worker) {
    worker = makeWorker();
    worker.onmessage = ({ data }) => {
     const request = pending.get(data.id);if (!request) return;
     pending.delete(data.id);
     data.error ? request.reject(new Error(data.error)) : request.resolve(data);
    };
    worker.onerror = event => { event.preventDefault?.();fail(); };
    worker.onmessageerror = fail;
   }
   const id = ++sequence;pending.set(id, { resolve, reject });
   try { worker.postMessage({ id, positions }, [positions.buffer]); }
   catch (error) { pending.delete(id);reject(error); }
  } catch { fail();reject(new Error('worker')); }
 });
}
