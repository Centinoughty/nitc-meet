const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

const io = new Server(server, { cors: { origin: "*" } });

let online = 0;
let roomArr = [];

// When a user connects
io.on("connection", (socket) => {
  online++;
  console.log(online)
  io.emit("online", online); // Notify all clients of the current online count

  socket.on("start", (cb) => {
    handleStart(roomArr, socket, cb, io);
  });

  socket.on("disconnect", () => {
    online--;
    io.emit("online", online); // Update online count
    handleDisconnect(socket.id, roomArr, io);
  });

  socket.on("ice:send", ({ candidate }) => {
    const type = getType(socket.id, roomArr);
    if (type) {
      const targetId = type.type === "p1" ? type.p2id : type.p1id;
      if (targetId) {
        io.to(targetId).emit("ice:reply", { candidate, from: socket.id });
      }
    }
  });

  socket.on("sdp:send", ({ sdp }) => {
    const type = getType(socket.id, roomArr);
    if (type) {
      const targetId = type.type === "p1" ? type.p2id : type.p1id;
      if (targetId) {
        io.to(targetId).emit("sdp:reply", { sdp, from: socket.id });
      }
    }
  });

  socket.on("send-message", ({ text, sender, roomid }) => {
    console.log("Message received:", { text, sender, roomid });
    
    // Broadcast the message to the other participant in the room with the sender's name
    io.to(roomid).emit("get-message", { text, sender: socket.id });

  });

  socket.on("skip", () => {
    handleSkip(socket.id, roomArr, io);
  });

  socket.on("end-call", () => {
    handleEndCall(socket.id, roomArr, io);
  });
  
  
  


});

const handleStart = (roomArr, socket, cb, io) => {
  const checkAvailableRoom = (socketId) => {
    for (const room of roomArr) {
      // If room is available or this socket is already in this room
      if (room.isAvailable || 
          room.p1.id === socketId || 
          room.p2.id === socketId) {
        return { is: false, roomid: "", room: null };
      }
    }
    return { is: true, roomid: "", room: null };
  };

  const availableRoom = checkAvailableRoom(socket.id);
  
  if (availableRoom.is) {
    // Create a new room for this socket
    const roomid = uuidv4();
    socket.join(roomid);
    roomArr.push({
      roomid,
      isAvailable: true,
      p1: { id: socket.id },
      p2: { id: null },
    });
    cb("p1");
    socket.emit("roomid", roomid);
  } else {
    // Find an available room to join
    const availableExistingRoom = roomArr.find(room => room.isAvailable);
    
    if (availableExistingRoom) {
      socket.join(availableExistingRoom.roomid);
      cb("p2");
      
      // Close the room
      availableExistingRoom.isAvailable = false;
      availableExistingRoom.p2.id = socket.id;

      // Notify both participants
      io.to(availableExistingRoom.p1.id).emit("remote-socket", socket.id);
      socket.emit("remote-socket", availableExistingRoom.p1.id);
      socket.emit("roomid", availableExistingRoom.roomid);
    } else {
      // If no rooms are available, create a new one
      const roomid = uuidv4();
      socket.join(roomid);
      roomArr.push({
        roomid,
        isAvailable: true,
        p1: { id: socket.id },
        p2: { id: null },
      });
      cb("p1");
      socket.emit("roomid", roomid);
    }
  }
};

// Handle disconnection
const handleDisconnect = (disconnectedId, roomArr, io) => {
  for (let i = 0; i < roomArr.length; i++) {
    const room = roomArr[i];
    if (room.p1.id === disconnectedId) {
      if (room.p2.id) {
        io.to(room.p2.id).emit("disconnected");
        room.isAvailable = true;
        room.p1.id = room.p2.id;
        room.p2.id = null;
      } else {
        roomArr.splice(i, 1);
      }
    } else if (room.p2.id === disconnectedId) {
      io.to(room.p1.id).emit("disconnected");
      room.isAvailable = true;
      room.p2.id = null;
    }
  }
};

const handleEndCall = (socketId, roomArr, io) => {
  for (let i = 0; i < roomArr.length; i++) {
    const room = roomArr[i];

    if (room.p1.id === socketId || room.p2.id === socketId) {
      const otherId = room.p1.id === socketId ? room.p2.id : room.p1.id;

      // Notify the other participant, if they exist
      if (otherId) {
        io.to(otherId).emit("call-ended");
      }

      // Remove the room from the list
      roomArr.splice(i, 1);
      break;
    }
  }
};


const handleSkip = (socketId, roomArr, io) => {
  for (let i = 0; i < roomArr.length; i++) {
    const room = roomArr[i];

    // If the skipping user is in this room
    if (room.p1.id === socketId || room.p2.id === socketId) {
      const otherId = room.p1.id === socketId ? room.p2.id : room.p1.id;

      // Notify the other participant, if they exist
      if (otherId) {
        io.to(otherId).emit("skipped");
        room.isAvailable = true;

        // Reassign the remaining participant as `p1` and reset `p2`
        if (room.p1.id === socketId) {
          room.p1.id = otherId;
          room.p2.id = null;
        } else {
          room.p2.id = null;
        }
      } else {
        // If the room is empty, remove it
        roomArr.splice(i, 1);
      }

      // Start a new match for the skipping user
      handleStart(roomArr, io.sockets.sockets.get(socketId), (peerType) => {
        io.to(socketId).emit("peer-type", peerType);
      });

      break;
    }
  }
};


// Get the peer type for a user
const getType = (id, roomArr) => {
  for (const room of roomArr) {
    if (room.p1.id === id) {
      return { type: "p1", p2id: room.p2.id };
    }
    if (room.p2.id === id) {
      return { type: "p2", p1id: room.p1.id };
    }
  }
  return false;
};
