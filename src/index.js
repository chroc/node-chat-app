const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom }= require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;

// Define the path
const publicDirectoryPath = path.join(__dirname, '../public');
// Setup static directory to serve
app.use(express.static(publicDirectoryPath));

// Server (emit) -> Client (receive) - countUpdated
// Client (emit) -> Server (receive) - increment
  
let count = 0;

io.on('connection', (socket) => {
    console.log('New WebSocket connection');

    // Listen for join event
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options });

        if(error){
            return callback(error);
        }
        socket.join(user.room);

        // Send a welcome message to the nuew client
        socket.emit('message', generateMessage('admin', `Welcome ${user.username}`));
        // Emit to everybody but this particular connection
        socket.broadcast.to(user.room).emit('message', generateMessage('admin', `${user.username} has joined!`));
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });
        callback();
    });

    // Listen for sendMessage
    socket.on('sendMessage', (message, callback) => {
        // Filter bad words
        const filter = new Filter();
        if(filter.isProfane(message)){
            return callback('Profanity is not allowed');
        }
        const user = getUser(socket.id);
        if(!user){
            return callback('User not found');
        }
        // Emit the message to all clients
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    });

    // Listen for sendLocation
    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id);
        if(!user){
            return callback('User not found');
        }
        // Emit message with location to everyone
        const locationLink = `https://google.com/maps?q=${location.latitude},${location.longitude}`;
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, locationLink));
        callback();
    });

    // Listen for disconnection
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if(user){
            io.to(user.room).emit('message', generateMessage('admin', `${user.username} has left`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

server.listen(port, () => {
    console.log('Chat App running on Port: ' + port);
});