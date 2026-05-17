const rawData = [];
rawData[1] = 'No.';
rawData[2] = 'Material';

const rawHeaders = rawData;
const sanitizedHeaders = rawHeaders.map((h, idx) => {
  let sanitized = h ? h.toLowerCase() : '';
  if (!sanitized) {
    sanitized = `unknown_col_${idx}`;
  }
  return sanitized;
});

const columnDefinitions = sanitizedHeaders.map(col => `"${col}" TEXT`).join(', ');
console.log('columnDefinitions:', columnDefinitions);
