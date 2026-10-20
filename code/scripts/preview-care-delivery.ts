import { previewCareDelivery } from '../src/care-delivery.js';
if (process.argv.length > 3) throw new Error('Usage: preview:care-delivery [UTC-as-of]');
console.log(JSON.stringify(previewCareDelivery(process.argv[2]), null, 2));
