// Wrapper to avoid pdf-parse v1.1.1 test-file bug.
// The main index.js runs a test read when module.parent is falsy
// (which happens in Next.js serverless). This imports the parser directly.
module.exports = require('pdf-parse/lib/pdf-parse.js');
