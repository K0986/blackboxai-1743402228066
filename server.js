const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();
const connectedUsers = new Set();
let onlineCount = 0;

function broadcastOnlineCount() {
    const count = connectedUsers.size;
    onlineCount = count;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'online-count',
                count
            }));
        }
    });
}

wss.on('connection', (ws) => {
    ws.id = Math.random().toString(36).substring(2, 9);
    console.log('New client connected:', ws.id);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch(data.type) {
            case 'join':
                handleJoin(ws, data.roomId);
                break;
            case 'skip':
                handleSkip(ws);
                break;
            case 'offer':
            case 'answer':
            case 'candidate':
                forwardMessage(data.roomId, ws, message);
                break;
            case 'chat':
                forwardChatMessage(data.roomId, ws, data.message);
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected:', ws.id);
        connectedUsers.delete(ws.id);
        broadcastOnlineCount();
        
        for (const [roomId, clients] of rooms.entries()) {
            if (clients.includes(ws)) {
                const updatedClients = clients.filter(client => client !== ws);
                if (updatedClients.length === 0) {
                    rooms.delete(roomId);
                } else {
                    rooms.set(roomId, updatedClients);
                    updatedClients.forEach(client => {
                        client.send(JSON.stringify({ type: 'peer-disconnected' }));
                    });
                }
                break;
            }
        }
    });
});

function handleJoin(ws, roomId) {
    if (connectedUsers.has(ws.id)) return;
    connectedUsers.add(ws.id);
    broadcastOnlineCount();

    if (!rooms.has(roomId)) {
        rooms.set(roomId, []);
    }

    const clients = rooms.get(roomId).filter(client => client.readyState === WebSocket.OPEN);
    clients.push(ws);
    rooms.set(roomId, clients);

    if (clients.length >= 2) {
        const [user1, user2] = clients.slice(-2);
        if (user1 !== user2) {
            user1.send(JSON.stringify({ type: 'paired', isInitiator: true }));
            user2.send(JSON.stringify({ type: 'paired', isInitiator: false }));
        }
    } else {
        ws.send(JSON.stringify({ type: 'waiting' }));
    }
}

function handleSkip(ws) {
    connectedUsers.delete(ws.id);
    broadcastOnlineCount();
    ws.send(JSON.stringify({ type: 'skip-ack' }));
}

function forwardMessage(roomId, sender, message) {
    const clients = rooms.get(roomId) || [];
    clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function forwardChatMessage(roomId, sender, message) {
    const clients = rooms.get(roomId) || [];
    clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
                type: 'chat',
                message
            }));
        }
    });
}

server.listen(8001, () => {
    console.log('Signaling server running on port 8001');
});