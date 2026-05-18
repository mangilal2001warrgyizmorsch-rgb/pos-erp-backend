import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO Server
 * @param {import('http').Server} server 
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get Socket.IO instance
 */
export const getIO = () => {
  return io;
};

/**
 * Central emit helper
 * @param {String} event 
 * @param {any} data 
 */
export const emitSocketEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`[Socket Broadcast] Emitted event: ${event}`);
  } else {
    console.warn(`[Socket Broadcast] Socket.IO not initialized yet. Skipping: ${event}`);
  }
};
