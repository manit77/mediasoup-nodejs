import * as mediasoupClient from 'mediasoup-client';
import { Consumer, Producer } from 'mediasoup-client/types';
import { PeerTracksInfo, UniqueMap } from '@rooms/rooms-models';

export class LocalPeer implements IPeer {
  tracksInfo: PeerTracksInfo = { isAudioEnabled: false, isVideoEnabled: false };
  peerId: string = "";
  trackingId: string = "";
  displayName: string = "";

  roomId: string = "";
  authToken: string = "";
  roomToken: string = "";

  transportSend: mediasoupClient.types.Transport;
  transportReceive: mediasoupClient.types.Transport;

  private producers: UniqueMap<"audio" | "video", mediasoupClient.types.Producer> = new UniqueMap();

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

    if (!this.transportSend) {
      console.error(`cannot create producer, no transportSend.`)
      return;
    }

    //if the producer exists by kind throw an error
    let existingProducer = this.producers.get(track.kind as any);
    if (existingProducer) {
      throw `producer already exists for kind ${existingProducer.kind}`;
    }

    let producer = await this.transportSend.produce({ track });
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

  producersToConsume: {
    producerId: string, kind: "audio" | "video" | string
  }[] = []

  private consumers: UniqueMap<"audio" | "video", mediasoupClient.types.Consumer> = new UniqueMap();

  getTracks() {
    return this.consumers.values().map(c => c.track);
  }

  getConsumers() {
    return this.consumers;
  }

  clearConsumers() {
    console.log(`clearConsumers`);
    this.consumers.values().forEach(c => c.close());
    this.consumers.clear();
  }

  removeConsumer(consumer: Consumer) {
    console.log(`removeConsumer ${consumer.kind}`);
    if(this.consumers.delete(consumer.kind)){
      console.warn(`consumer of type ${consumer.kind} deleted.`);
    } else {
      console.warn(`consumer of type ${consumer.kind} not found.`);
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
  async createConsumer(transportReceive: mediasoupClient.types.Transport, serverConsumerId: string, serverProducerId: string, kind: "audio" | "video", rtpParameters: any) {
    console.log(`createConsumer peerId:${this.peerId} ${this.displayName}, serverConsumerId:${serverConsumerId}, serverProducerId: ${serverProducerId}, kind: ${kind}`);

    if (!transportReceive) {
      console.error(`cannot create producer, no transportSend.`)
      return;
    }

    let existingConsumer = this.consumers.get(kind);
    if (existingConsumer) {
      throw `consumer of ${existingConsumer.kind} already exists for peerId: ${this.peerId} ${this.displayName}`;
    }

    let consumer = await transportReceive.consume({
      id: serverConsumerId,
      producerId: serverProducerId,
      kind: kind,
      rtpParameters: rtpParameters
    });

    this.addConsumer(consumer);

    return consumer;
  }

  private addConsumer(consumer: Consumer) {
    console.log(`addConsumer ${consumer.kind}`);

    if(this.consumers.get(consumer.kind)) {
      throw `consumer with ${consumer.kind} already exists. remove it first then add.`;
    }
    this.consumers.set(consumer.kind, consumer);

    consumer.on("trackended", () => {
      console.log(`consumer - track ended ${consumer.track?.id} ${consumer.track?.kind}`);
    });

    consumer.observer.on('pause', () => {
      console.log('consumer - paused (muted)');
    });

    consumer.observer.on('resume', () => {
      console.log('consumer - resumed (unmuted)');
    });

    
  }


}
