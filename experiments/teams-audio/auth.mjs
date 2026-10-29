import { ClientSecretCredential } from '@azure/identity';
import { CommunicationIdentityClient } from '@azure/communication-identity';

const appFields = ['AZURE_COMMUNICATION_ENDPOINT', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'];
const present = value => typeof value === 'string' && value.trim().length > 0;

// Readiness means configuration is complete, not that Azure granted access.
// Partial app configuration deliberately cannot fall back to an old access key.
export function callingAuth(config) {
  if (appFields.some(name => present(config[name]))) {
    const missing = appFields.filter(name => !present(config[name]));
    if (missing.length) return {mode:'entra',configured:false,missing};
    let endpoint;
    try { endpoint = new URL(config.AZURE_COMMUNICATION_ENDPOINT); } catch {}
    const valid = endpoint?.protocol === 'https:' && /^[a-z0-9-]+\.communication\.azure\.com$/i.test(endpoint.hostname)
      && !endpoint.port && !endpoint.username && !endpoint.password && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash;
    if (!valid) return {mode:'entra',configured:false,missing:[],error:'Use the HTTPS endpoint from the ACS resource overview.'};
    return {mode:'entra',configured:true,missing:[]};
  }
  if (present(config.AZURE_COMMUNICATION_CONNECTION_STRING)) return {mode:'connection-string',configured:true,missing:[]};
  if (present(config.AZURE_COMMUNICATION_TOKEN)) return {mode:'temporary-token',configured:true,missing:[]};
  return {mode:'unconfigured',configured:false,missing:appFields};
}

export function identityClient(config, {credential, options = {}} = {}) {
  const auth = callingAuth(config);
  if (!auth.configured) throw new Error('ACS calling configuration is incomplete or invalid.');
  const settings = {...options,retryOptions:{maxRetries:0}};
  if (auth.mode === 'entra') {
    const appCredential = credential || new ClientSecretCredential(config.AZURE_TENANT_ID,config.AZURE_CLIENT_ID,config.AZURE_CLIENT_SECRET);
    return new CommunicationIdentityClient(config.AZURE_COMMUNICATION_ENDPOINT,appCredential,settings);
  }
  if (auth.mode === 'connection-string') return new CommunicationIdentityClient(config.AZURE_COMMUNICATION_CONNECTION_STRING,settings);
  throw new Error('A temporary calling token cannot create an ACS identity.');
}
