// Simple manual test for the game flow
// Run this in the browser console to test the connection

const testGameFlow = async () => {
  console.log('Testing game flow...');
  
  // Test connection to backend
  try {
    const response = await fetch('http://localhost:3000');
    const text = await response.text();
    console.log('Backend response:', text);
  } catch (error) {
    console.error('Failed to connect to backend:', error);
  }
  
  // Test WebSocket connection manually
  const socket = io('http://localhost:3000');
  
  socket.on('connect', () => {
    console.log('✅ Connected to backend');
    
    // Test joining a room
    socket.emit('joinRoom', { roomId: 'new', playerName: 'TestPlayer' });
  });
  
  socket.on('playerJoined', (data) => {
    console.log('✅ Player joined event received:', data);
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Disconnected from backend');
  });
};

// Run the test
// testGameFlow();
