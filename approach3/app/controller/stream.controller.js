const { handleLine } = require("../utils/streamAggregator");

/**
 * Accept NDJSON stream via HTTP/2 or HTTP/1.1 POST.
 */
exports.ingestStream = async (req, res) => {
  req.setTimeout(0); // disable timeout
  let buffer = "";

  req.on("data", (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (!obj.server_id || !obj.metric_name || obj.value === undefined) {
          console.warn("bad metric line", line);
          continue;
        }
        handleLine(obj); // <-- ensure DB buffer + dashboard emit
      } catch (err) {
        console.warn("parse error", err.message, line);
      }
    }
  });

  req.on("end", () => res.status(204).end());
  req.on("error", (err) => {
    console.error("stream error", err);
    if (!res.headersSent) res.status(500).json({ message: "stream error" });
  });
};
