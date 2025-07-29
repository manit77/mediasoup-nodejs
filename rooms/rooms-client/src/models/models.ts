import * as mediasoupClient from 'mediasoup-client';

export interface JoinInfo { roomId: string, roomToken: string };
export interface DeviceInfo {
  id: string;
  label: string;
}

// export interface ConsumerInfo {
//   peerId: string,
//   consumer: mediasoupClient.types.Consumer;
// }


export type MediaDeviceOptions = {
  videoDeviceId?: string;
  audioDeviceId?: string;
  outputDevice?: string;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
  resolution?: {
    width: number;
    height: number;
    frameRate: number;
  };
};