import dgram from 'dgram';

export function getFreeUDPPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.bind(0, () => {
      const address = socket.address();
      socket.close();
      if (typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('Failed to get a free port'));
      }
    });
  });
}