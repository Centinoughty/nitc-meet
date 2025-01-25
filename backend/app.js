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

  socket.on("send-message", (input, type, roomId) => {
    console.log("Message received:", { input, type, roomId });
    io.to(roomId).emit("get-message", input);
  });
});

// Handle starting a new session
const handleStart = (roomArr, socket, cb, io) => {
  const closeRoom = (roomid, socketId) => {
    for (const room of roomArr) {
      if (room.roomid === roomid) {
        room.isAvailable = false;
        room.p2.id = socketId;
        break;
      }
    }
  };

  const checkAvailableRoom = (socketId) => {
    for (const room of roomArr) {
      if (room.isAvailable) {
        return { is: true, roomid: room.roomid, room };
      }
      if (room.p1.id === socketId || room.p2.id === socketId) {
        return { is: false, roomid: "", room: null };
      }
    }
    return { is: false, roomid: "", room: null };
  };

  const availableRoom = checkAvailableRoom(socket.id);
  if (availableRoom.is) {
    socket.join(availableRoom.roomid);
    cb("p2");
    closeRoom(availableRoom.roomid, socket.id);

    if (availableRoom.room) {
      io.to(availableRoom.room.p1.id).emit("remote-socket", socket.id);
      socket.emit("remote-socket", availableRoom.room.p1.id);
      socket.emit("roomid", availableRoom.room.roomid);
    }
  } else {
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
