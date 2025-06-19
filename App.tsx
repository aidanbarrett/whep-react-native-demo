import React, { useState, useEffect, useRef, FC } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { WHEPClient } from './src/whepClient';

const WHEP_URL: string = ''; // Replace with your WHEP server URL
const App: FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const whepClientRef = useRef<WHEPClient | null>(null);

  useEffect(() => {
    return () => {
      whepClientRef.current?.close();
    };
  }, []);

  const handlePlay = async (): Promise<void> => {
    if (isPlaying || isLoading) return;
    setIsLoading(true);

    const client = new WHEPClient(WHEP_URL);
    whepClientRef.current = client;

    client.onStreamReady((stream: MediaStream) => {
      console.log('App: Stream is ready!');
      setRemoteStream(stream);
      setIsPlaying(true);
      setIsLoading(false);
    });

    client.onConnectionStateChange((state: string) => {
      console.log('App: WHEP client connection state:', state);
      if (['failed', 'disconnected', 'closed'].includes(state)) {
        handlePause();
      }
    });

    try {
      await client.connect();
    } catch (error) {
      console.error('WHEP Connection Error:', error);
      handlePause();
    }
  };

  const handlePause = (): void => {
    if (!whepClientRef.current) return;
    whepClientRef.current.close();
    whepClientRef.current = null;
    setRemoteStream(null);
    setIsPlaying(false);
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>WHEP Audio PoC</Text>
      <Text style={styles.instructions}>
        {isPlaying
          ? 'Press PAUSE to disconnect to the connnection'
          : 'Press PLAY to connect and start playing.'}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={isPlaying ? handlePause : handlePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
        )}
      </TouchableOpacity>

      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.hiddenRtcView}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  instructions: { textAlign: 'center', color: '#333333', marginBottom: 20 },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 50,
    paddingVertical: 20,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 180,
    minHeight: 60,
  },
  buttonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  hiddenRtcView: { width: 0, height: 0, position: 'absolute' },
});

export default App;
