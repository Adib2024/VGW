const rawData = [];
rawData[1] = 'No.';
rawData[2] = 'Material';

const rawHeaders = rawData;
console.log('rawHeaders length:', rawHeaders.length);

const sanitizedHeaders = rawHeaders.map((h, idx) => {
  let sanitized = h ? h.toLowerCase() : '';
  if (!sanitized) {
    sanitized = `unknown_col_${idx}`;
  }
  return sanitized;
});

console.log('sanitizedHeaders:', sanitizedHeaders.join(', '));
console.log('sanitizedHeaders array:', sanitizedHeaders);
