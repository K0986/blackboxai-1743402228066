// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const reportBtn = document.getElementById('reportBtn');
const skipBtn = document.getElementById('skipBtn');

// WebRTC configuration
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Global variables
let localStream;
let peerConnection;
let currentRoom = Math.random().toString(36).substring(2, 8);
let isSearching = false;
let socket = null;

// Initialize the app
function init() {
  updateOnlineCount(0);
  getMedia();
  setupEventListeners();
  connectToPeer();
}

// Get user media
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    alert('Could not access your camera/microphone. Please check permissions.');
  }
}

// Setup event listeners
function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  muteBtn.addEventListener('click', toggleMute);
  cameraBtn.addEventListener('click', toggleCamera);
  reportBtn.addEventListener('click', reportUser);
  skipBtn.addEventListener('click', skipConnection);
}

// WebRTC connection functions
function connectToPeer() {
  if (isSearching) return;
  isSearching = true;
  
  peerConnection = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Connect to signaling server
  socket = new WebSocket(`ws://localhost:8001`);
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch(data.type) {
      case 'paired':
        if (data.isInitiator) {
          addMessageToChat('System', 'Connected to a new stranger!');
        }
        break;
      case 'skip-ack':
        addMessageToChat('System', 'Finding a new stranger...');
        currentRoom = Math.random().toString(36).substring(2, 8);
        connectToPeer();
        break;
      case 'online-count':
        updateOnlineCount(data.count);
        break;
      case 'chat':
        addMessageToChat('Stranger', data.message);
        break;
      case 'peer-disconnected':
        addMessageToChat('System', 'Stranger disconnected. Finding someone new...');
        skipConnection();
        break;
    }
  };
}

// Online count function
function updateOnlineCount(count) {
  const onlineCountElement = document.getElementById('onlineCount');
  if (onlineCountElement) {
    onlineCountElement.textContent = `${count} ${count === 1 ? 'person' : 'people'} online`;
  }
}

// Skip connection function
function skipConnection() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'skip', roomId: currentRoom }));
  }
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  addMessageToChat('System', 'Skipping to next stranger...');
}

// Chat functions
function sendMessage() {
  const message = chatInput.value.trim();
  if (message && socket) {
    socket.send(JSON.stringify({ type: 'chat', message }));
    addMessageToChat('You', message);
    chatInput.value = '';
  }
}

function addMessageToChat(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('mb-2');
  messageElement.innerHTML = `
    <span class="font-bold ${sender === 'You' ? 'text-blue-400' : 'text-green-400'}">${sender}:</span>
    <span>${message}</span>
  `;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Media control functions
function toggleMute() {
  const audioTracks = localStream.getAudioTracks();
  audioTracks.forEach(track => track.enabled = !track.enabled);
  muteBtn.innerHTML = audioTracks[0].enabled 
    ? '<i class="fas fa-microphone"></i>' 
    : '<i class="fas fa-microphone-slash text-red-500"></i>';
}

function toggleCamera() {
  const videoTracks = localStream.getVideoTracks();
  videoTracks.forEach(track => track.enabled = !track.enabled);
  cameraBtn.innerHTML = videoTracks[0].enabled
    ? '<i class="fas fa-video"></i>'
    : '<i class="fas fa-video-slash text-red-500"></i>';
}

function reportUser() {
  addMessageToChat('System', 'User reported. Finding someone new...');
  skipConnection();
}

// Initialize when page loads
window.addEventListener('load', init);