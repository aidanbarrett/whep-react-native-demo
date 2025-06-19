import {
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';

const DEFAULT_ICESERVERS = [
  {
    urls: 'stun:stun.cloudflare.com:3478',
  },
];

export type WHEPClientConfig = {
  iceServers?: any[];
  bundlePolicy?: 'max-bundle' | 'balanced' | 'max-compat' | undefined;
  disableAudio?: boolean;
  disableVideo?: boolean;
  maxRetries?: number;
  iceGatheringTimeout?: number;
};

export class WHEPClient {
  private peerConnection: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private streamReadyCallback: (stream: MediaStream) => void = () => {};
  private connectionStateChangeCallback: (state: string) => void = () => {};
  private readonly config: WHEPClientConfig;
  private readonly endpoint: string;

  constructor(endpoint: string, config: WHEPClientConfig = {}) {
    if (!endpoint) throw new Error('endpoint is required');

    if (config?.disableAudio && config?.disableVideo) {
      throw new Error('cannot disable both audio and video');
    }

    this.endpoint = endpoint;
    this.config = {
      disableVideo: false,
      disableAudio: false,
      maxRetries: 3,
      iceGatheringTimeout: 300,
      ...config,
    };

    this.init();
  }

  private init(): void {
    const rtcConfig = {
      iceServers: this.config?.iceServers || DEFAULT_ICESERVERS,
      bundlePolicy: this.config?.bundlePolicy || 'balanced',
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Add transceivers based on config
    if (!this.config.disableVideo) {
      this.peerConnection.addTransceiver('video', {
        direction: 'recvonly',
      });
    }
    if (!this.config.disableAudio) {
      this.peerConnection.addTransceiver('audio', {
        direction: 'recvonly',
      });
    }

    // TS does not recognize ontrack and onconnectionstatechange as part of RTCPeerConnection
    // so we cast it to any to avoid TypeScript errors.
    // This is a workaround until the types are updated in react-native-webrtc.
    const pc = this.peerConnection as any;

    pc.ontrack = (event: any) => {
      console.log('WHEPClient: ontrack event fired.');
      if (event.streams && event.streams[0]) {
        this.streamReadyCallback(event.streams[0] as MediaStream);
      }
    };

    pc.onconnectionstatechange = () => {
      this.connectionStateChangeCallback(pc.connectionState);
    };
  }

  public async connect(): Promise<void> {
    try {
      await this.negotiateConnectionWithClientOffer(this.config.maxRetries);
    } catch (error) {
      this.connectionStateChangeCallback('failed');
      throw error;
    }
  }

  private async negotiateConnectionWithClientOffer(
    maxRetries = 3,
  ): Promise<string | null> {
    if (!this.peerConnection) {
      throw new Error('Peer connection is not initialized');
    }
    const offer = await this.peerConnection.createOffer({});
    await this.peerConnection.setLocalDescription(offer);

    const initializedOffer = await this.waitToCompleteICEGathering();
    if (!initializedOffer) {
      throw new Error('failed to gather ICE candidates for offer');
    }

    let attempt = 0;
    let retryInterval = 1000;

    do {
      try {
        const response = await this.sendOffer(initializedOffer.sdp);

        switch (response.status) {
          case 201: {
            const answerSDP = await response.text();
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: 'answer', sdp: answerSDP }),
            );
            this.resourceUrl = response.headers.get('Location');
            return this.resourceUrl;
          }

          case 403: {
            throw new Error('Unauthorized');
          }

          case 405: {
            console.warn('URL must be updated');
            break;
          }

          default: {
            const errorMessage = await response.text();
            console.error(
              `WHEP request failed with status ${response.status}:`,
              errorMessage,
            );
          }
        }
      } catch (networkError) {
        console.error(`Network error on attempt ${attempt + 1}:`, networkError);
      }

      if (
        attempt < maxRetries - 1 &&
        (this.peerConnection as any).connectionState !== 'closed'
      ) {
        await this.delay(retryInterval);
        retryInterval *= 2; // Exponential backoff
      }

      attempt++;
    } while (
      attempt < maxRetries &&
      (this.peerConnection as any).connectionState !== 'closed'
    );

    if (attempt >= maxRetries) {
      throw new Error('Max retry attempts reached');
    }

    return null;
  }

  private async waitToCompleteICEGathering(): Promise<RTCSessionDescription | null> {
    return new Promise<RTCSessionDescription | null>((resolve, reject) => {
      const timeoutRef = setTimeout(() => {
        if (!this.peerConnection) {
          reject(new Error('Peer connection is not initialized'));
          return;
        }
        (this.peerConnection as any).onicegatheringstatechange = null;
        resolve(this.peerConnection.localDescription);
      }, this.config.iceGatheringTimeout || 300);

      (this.peerConnection as any).onicegatheringstatechange = () => {
        if (!this.peerConnection) {
          reject(new Error('Peer connection is not initialized'));
          return;
        }
        if ((this.peerConnection as any).iceGatheringState === 'complete') {
          clearTimeout(timeoutRef);
          (this.peerConnection as any).onicegatheringstatechange = null;
          resolve(this.peerConnection.localDescription);
        }
      };
    });
  }

  private getResourceUrl(location: string): string {
    if (location?.match(/^\//)) {
      const url = new URL(location, new URL(this.endpoint).origin);
      return url.toString();
    }
    return location;
  }

  public close(): void {
    if (this.resourceUrl) {
      this.sendDeleteResource(this.getResourceUrl(this.resourceUrl)).catch(e =>
        console.warn('WHEP DELETE failed', e),
      );
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      this.resourceUrl = null;
    }
  }

  public onStreamReady(callback: (stream: MediaStream) => void): void {
    this.streamReadyCallback = callback;
  }

  public onConnectionStateChange(callback: (state: string) => void): void {
    this.connectionStateChangeCallback = callback;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sendOffer(data: string): Promise<Response> {
    return fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: data,
    });
  }

  private async sendDeleteResource(url: string): Promise<Response> {
    return fetch(url, {
      method: 'DELETE',
    });
  }
}
