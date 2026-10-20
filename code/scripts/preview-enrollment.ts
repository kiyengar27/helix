import { enrollmentSummary } from '../src/enrollment-fixtures.js';
if(process.argv.length>2)throw new Error('Summary only: raw patient payload output is intentionally unsupported');
console.log(JSON.stringify(enrollmentSummary(),null,2));
