// Worker thread for file text extraction (see extractIsolated in files.js). Gets {buf, kind}, posts {ok, r} or {ok:false, msg}.
import { parentPort, workerData } from "node:worker_threads";
import { extract } from "./files.js";
try {
  const r = await extract(Buffer.from(workerData.buf), workerData.kind, { timeoutMs: workerData.timeoutMs });
  parentPort.postMessage({ ok: true, r });
} catch (e) {
  parentPort.postMessage({ ok: false, msg: (e && e.message) || "error" });
}
