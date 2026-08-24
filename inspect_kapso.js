import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

const client = new WhatsAppClient({
  baseUrl: 'https://api.kapso.ai/meta/whatsapp',
  kapsoApiKey: 'dummy'
});

console.log(Object.keys(client));
console.log(Object.keys(client.messages || {}));
console.log(client.messages.sendDocument?.toString());
