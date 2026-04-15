import { getCredentialServiceState, readCredentials } from '~/server/plugins/credential-service';

export default defineEventHandler(async () => {
  const state = getCredentialServiceState();
  const credentials = await readCredentials();

  return {
    ...state,
    credentialCount: credentials.length,
  };
});
