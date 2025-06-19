import 'react-native-webrtc';

declare module 'react-native-webrtc' {
  // The RTCTrackEvent is not exported, but we need to reference it.
  // We declare it here based on the standard Web API.
  interface RTCTrackEvent {
    readonly streams: readonly MediaStream[];
    readonly track: MediaStreamTrack;
  }

  // Add the missing 'ontrack' property to the RTCPeerConnection interface.
  // We use 'ontrack' as it's the most reliably implemented legacy hook.
  interface RTCPeerConnection {
    ontrack: ((event: RTCTrackEvent) => void) | null;
  }
}
