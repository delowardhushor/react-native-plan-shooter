import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { GameCanvas } from './src/components/GameCanvas';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <GameCanvas />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default App;
