const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose"); // Import mongoose for MongoDB connection
require("dotenv").config();
const User = require("./models/userModel"); // Ensure this path is correct
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/nitc_meet";
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// Set up Socket.IO
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

  socket.on("send-message", ({ text, sender, roomid }) => {
    console.log("Message received:", { text, sender, roomid });
    
    // Broadcast the message to the other participant in the room with the sender's name
    io.to(roomid).emit("get-message", { text, sender });
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


// add user

app.post("/add-user", async (req, res) => {
  try {
    const { email, name, profilePic, keywords } = req.body;

    // Create new user instance
    const user = new User({
      email,
      name,
      profilePic,
      keywords
    });

    // Save the user to the database
    await user.save();

    res.status(201).json({
      message: "User added successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error adding user",
      error: error.message,
    });
  }
});

app.post("/report", async (req, res) => {
  const { reporterEmail, reportedEmail } = req.body;

  try {
    // Fetch the reporter and the reported user
    const reporter = await User.findOne({ email: reporterEmail });
    const reportedUser = await User.findOne({ email: reportedEmail });

    if (!reporter || !reportedUser) {
      return res.status(404).json({ message: "User(s) not found" });
    }

    // Check if the reported user is banned
    if (reportedUser.reports.isBanned && new Date() < reportedUser.reports.banUntil) {
      return res.status(400).json({ message: "This user is currently banned." });
    }

    // Increment the report count
    reportedUser.reports.count += 1;
    reportedUser.reports.lastReported = new Date();

    let banDuration = 0;
    if (reportedUser.reports.count === 2) {
      banDuration = 5 * 60 * 1000; // 5 minutes
    } else if (reportedUser.reports.count === 3) {
      banDuration = 60 * 60 * 1000; // 1 hour
    } else if (reportedUser.reports.count === 4) {
      banDuration = 24 * 60 * 60 * 1000; // 1 day
    } else if (reportedUser.reports.count >= 5) {
      reportedUser.reports.isBanned = true;
      reportedUser.reports.banUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Banned permanently
    }

    // Apply the ban if needed
    if (banDuration > 0) {
      reportedUser.reports.isBanned = true;
      reportedUser.reports.banUntil = new Date(Date.now() + banDuration);
    }

    // Save the changes to the reported user
    await reportedUser.save();

    // Disconnect the video chat session
    io.to(reporter.socketId).emit("disconnected");
    io.to(reportedUser.socketId).emit("disconnected");

    res.status(200).json({
      message: `User ${reportedEmail} reported successfully.`,
      reportedUser,
    });
  } catch (error) {
    console.error("Error reporting user:", error);
    res.status(500).json({ message: "Error reporting user", error: error.message });
  }
});
