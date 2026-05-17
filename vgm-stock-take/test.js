const rawHeaders = [undefined, "No.", "Material"];
const sanitizeString = (str) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '') // Remove special characters
    .replace(/\s+/g, '_'); // Replace spaces with underscores
};

const sanitizedHeaders = rawHeaders.map((h, idx) => {
  let sanitized = sanitizeString(h || '');
  if (!sanitized) {
    sanitized = `unknown_col_${idx}`;
  }
  return sanitized;
});

console.log(sanitizedHeaders.join(', '));
