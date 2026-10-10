/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) Implementation
 * 
 * Ensures deterministic serialization of JSON data structures:
 * 1. Object keys are sorted lexicographically by UTF-16 code units.
 * 2. Numbers are serialized deterministically without trailing zeroes or exponent quirks.
 * 3. Strings, Booleans, and Nulls follow standard JSON escaping.
 * 4. Whitespace between tokens is completely omitted.
 * 
 * @param {any} object The JavaScript object or primitive to canonicalize.
 * @returns {string} The canonical JSON string representation.
 */
function canonicalize(object) {
  if (object === null) {
    return "null";
  }

  if (typeof object === "boolean" || typeof object === "number") {
    return JSON.stringify(object);
  }

  if (typeof object === "string") {
    return JSON.stringify(object);
  }

  if (Array.isArray(object)) {
    const elements = object.map((item) => {
      const canonical = canonicalize(item);
      return canonical === undefined ? "null" : canonical;
    });
    return "[" + elements.join(",") + "]";
  }

  if (typeof object === "object") {
    const keys = Object.keys(object).sort();
    const pairs = [];

    for (const key of keys) {
      const val = object[key];
      // JSON specification ignores undefined, functions, and symbols
      if (val !== undefined && typeof val !== "function" && typeof val !== "symbol") {
        const canonicalKey = JSON.stringify(key);
        const canonicalVal = canonicalize(val);
        if (canonicalVal !== undefined) {
          pairs.push(canonicalKey + ":" + canonicalVal);
        }
      }
    }

    return "{" + pairs.join(",") + "}";
  }

  return undefined;
}

module.exports = { canonicalize };
