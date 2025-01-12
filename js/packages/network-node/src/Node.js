import JSONFile from "@modality-dev/utils/JSONFile";
import Keypair from "@modality-dev/utils/Keypair"
import { resolveDnsEntries, matchesPeerIdSuffix } from "@modality-dev/utils/MultiaddrList";
import path from 'path';
import createLibp2pNode from "./createLibp2pNode.js";
import PeerIdHelpers from "./PeerIdHelpers.js";
import { multiaddr } from "@multiformats/multiaddr";

export default class Node {
  constructor({peerid, keypair, listeners, bootstrappers, swarm}) {
    this.peerid = peerid;
    this.keypair = keypair;
    this.listeners = listeners;
    this.bootstrappers = bootstrappers;
    this.swarm = swarm;
  }

  static async fromConfigFilepath(filepath) {
    const config = JSONFile.readSync(filepath);
    const relative_path_base = path.resolve(path.dirname(filepath));
    config.passfile_path = path.resolve(relative_path_base, config.passfile_path);
    config.storage_path = path.resolve(relative_path_base, config.storage_path);
    return Node.fromConfig(config);
  }

  static async fromConfig(config) {
    const keypair = await Keypair.fromJSONFile(config.passfile_path);
    const peerid = await keypair.asPublicAddress();
    const storage_path = config.storage_path;
    const listeners = config.listeners || [];
    const resolved_bootstrappers = await resolveDnsEntries(config.bootstrappers || []);
    const bootstrappers = resolved_bootstrappers.filter(ma => !matchesPeerIdSuffix(ma, peerid));



    const node = new Node({peerid, keypair, storage_path, listeners, bootstrappers});

    return node;
  }

  async setup(mode = 'client') {
    const peerId = await PeerIdHelpers.createFromJSON(await this.keypair.asJSON());
    const addresses = mode === 'client' ? {} : { listen: this.listeners };
    const swarm = await createLibp2pNode({
      peerId,
      addresses,
      bootstrappers: this.bootstrappers,
    });
    this.swarm = swarm;
    await this.swarm.start();
  }

  async setupAsClient() {
    return this.setup('client');
  }

  async setupAsServer() {
    return this.setup('server');
  }

  async stop() {
    await this.swarm.stop();
  }

  async reqres() {
    return this.swarm(...arguments);
  }

  async getPeerId() {
    const peerId = await PeerIdHelpers.createFromJSON(await this.keypair.asJSON());
    return peerId;
  }

  getListenerMultiaddress() {
    return this.swarm.getMultiaddrs()?.[0];
    if (!this.listeners || !this.listeners.length) {
      return null;
    }
    return multiaddr(`${this.listeners[0]}/p2p/${this.peerid}`);
  }
}