import * as mediasoupClient from 'mediasoup-client';
import { Consumer, Producer } from 'mediasoup-client/types';
import { ConsumerInfo } from './models.js';
import { PeerTracksInfo, UniqueMap } from '@rooms/rooms-models';

export class LocalPeer implements IPeer {
  tracksInfo: PeerTracksInfo = {  isAudioEnabled: false, isVideoEnabled: false};
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  roomId: string = "";
  authToken: string = "";
  roomToken: string = "";

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;

  private producers: UniqueMap<mediasoupClient.types.Producer> = new UniqueMap();

  getTracks() {
    return this.producers.values().map(p => p.track);
  }

  getProducers() {
    return this.producers;
  }

  clearProducers() {
    this.producers.values().forEach(p => p.close());
    this.producers.clear();
  }

  removeProducer(producer: Producer) {
    console.log(`removeProducer ${producer.kind}`);
    this.producers.delete(producer.kind);
  }

  /**
   * local producer, one producer per track
   * only 1 video and 1 audio is allowed
   * @param track 
   * @returns 
   */
  async createProducer(track: MediaStreamTrack) {
    console.log(`createProducer ${track.kind}`);

    if(!this.transportSend) {
      console.error(`cannot create producer, no transportSend.`)
      return;
    }

    //if the producer exists by kind throw an error
    let existingProducer = this.producers.get(track.kind);
    if (existingProducer) {
      throw `producer already exists for kind ${existingProducer.kind}`;
    }

    let producer = await this.transportSend.produce({ track });
    if (!track.enabled) {
      //console.log(`*** pause the producer`);
      //producer.pause();
    }

    this.addProducer(producer);
    return producer;
  }

  private addProducer(producer: Producer) {
    console.log(`addProducer ${producer.kind}`);

    producer.on("trackended", () => {
      console.log(`producer - ${producer.track?.kind} track ended ${producer.track?.id} ${producer.track?.kind}`);
    });

    producer.observer.on('pause', () => {
      console.log(`producer - ${producer.track?.kind} track paused (muted)`);
    });

    producer.observer.on('resume', () => {
      console.log(`producer - ${producer.track?.kind} track resumed (unmuted)`);
    });

    this.producers.set(producer.kind, producer);
  }
}

export interface IPeer {
  peerId: string;
  trackingId: string;
  displayName: string;
  //tracks: UniqueTracks;
  tracksInfo: PeerTracksInfo
}

export class Peer implements IPeer {
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";
  tracksInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false }

  //tracks: UniqueTracks = new UniqueTracks();

  producersToConsume: {
    producerId: string, kind: "audio" | "video" | string
  }[] = []

  private consumers: ConsumerInfo[] = [];

  getTracks() {
    return this.consumers.map(c => c.consumer.track);
  }

  getConsumers() {
    return this.consumers;
  }

  clearConsumers() {
    this.consumers.forEach(c => c.consumer.close());
    this.consumers = [];
  }

  removeConsumer(consumer: Consumer) {
    console.log(`removeConsumer ${consumer.kind}`);
    let idx = this.consumers.findIndex(c => c.consumer === consumer);
    if (idx > -1) {
      let removed = this.consumers.splice(idx, 1);
      console.warn(`consumer with kind ${consumer.track.kind} removed.`, this.consumers);
      // for (let consumer of removed) {
      //   console.log(`remove track ${consumer.consumer.track.kind}`)
      //   this.tracks.removeTrack(consumer.consumer.track.kind);
      // }
    }
    console.log(this.consumers);


  }

  /**
 * creates a consumer to consume a remote producer
 * 1 video and 1 audio is aloweed per peer
 * @param serverConsumerId 
 * @param serverProducerId 
 * @param kind 
 * @param rtpParameters 
 * @returns 
 */
  async createConsumer(transportReceive: mediasoupClient.types.Transport, peerId: string, serverConsumerId: string, serverProducerId: string, kind: "audio" | "video", rtpParameters: any) {
    console.log(`createConsumer peerId:${peerId}, serverConsumerId:${serverConsumerId}, serverProducerId: ${serverProducerId}, kind: ${kind}`);

    if(!transportReceive) {
      console.error(`cannot create producer, no transportSend.`)
      return;
    }

    let existingConsumer = this.consumers.find(c => c.peerId == peerId && c.consumer.kind === kind);
    if (existingConsumer) {
      throw `consumer of ${existingConsumer.consumer.kind} already exists for peerId: ${peerId}`;
    }

    let consumer = await transportReceive.consume({
      id: serverConsumerId,
      producerId: serverProducerId,
      kind: kind,
      rtpParameters: rtpParameters
    });

    this.addConsumer(peerId, consumer);

    return consumer;
  }

  private addConsumer(peerId: string, consumer: Consumer) {
    console.log(`addConsumer ${consumer.kind}`);

    consumer.on("trackended", () => {
      console.log(`consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
    });

    consumer.observer.on('pause', () => {
      console.log('consumer - paused (muted)');
    });

    consumer.observer.on('resume', () => {
      console.log('consumer - resumed (unmuted)');
    });

    this.consumers.push({ peerId, consumer });
  }


}
