import { defineWebSocketHandler } from 'h3';
import { getWsClients, readCredentials } from '~/server/plugins/credential-service';

export default defineWebSocketHandler({
  async open(peer) {
    getWsClients().add(peer);
    const data = await readCredentials();
    peer.send(JSON.stringify(data));
  },

  close(peer) {
    getWsClients().delete(peer);
  },

  error(peer) {
    getWsClients().delete(peer);
  },
});
