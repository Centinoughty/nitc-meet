"use client";

import { useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { io } from "socket.io-client";

export default function Home() {
  const [isWaiting, setIsWaiting] = useState(true);
  const [messages, setMessages] = useState([]);
  const [localSocket, setLocalSocket] = useState(null);
  const [remoteSocket, setRemoteSocket] = useState(null);
  const [type, setType] = useState(null);
  const [roomid, setRoomid] = useState(null);

  const inputRef = useRef();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND, {
      transports: ["websocket"],
    });
    setLocalSocket(socket);

    const handleDisconnected = () => {
      console.log("Disconnected");
      cleanupMediaAndPeer();
    };

    const handleStart = (person) => {
      setType(person);
    };

    const handleRemoteSocket = async (id) => {
      setRemoteSocket(id);
      setIsWaiting(false);

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = peer;

      await startMediaCapture(peer);

      peer.onnegotiationneeded = async () => {
        try {
          if (type === "p1") {
            const offer = await peer.createOffer();
            console.log("Offer created:", offer);
            await peer.setLocalDescription(offer);
            socket.emit("sdp:send", { sdp: peer.localDescription });
          }
        } catch (err) {
          console.error("Error during negotiation:", err);
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate:", event.candidate);
          socket.emit("ice:send", { candidate: event.candidate, to: id });
        }
      };

      peer.ontrack = (event) => {
        console.log("Remote track received:", event);
        
        // Ensure the stream and video element are available before assigning the source
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          // Set the video source only if it's not already set
          if (remoteVideoRef.current.srcObject !== event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
      
          // Add event listener to ensure the video plays only when it is ready
          remoteVideoRef.current.oncanplay = () => {
            remoteVideoRef.current.play().catch((err) => console.error("Error playing remote video:", err));
          };
        } else {
          console.error("No remote streams or video element not ready.");
        }
      };
      
    };

    const handleSdpReply = async ({ sdp }) => {
      try {
        const peer = peerRef.current;
        if (!peer) return;
        console.log("SDP received:", sdp);
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        if (type === "p2") {
          const answer = await peer.createAnswer();
          console.log("Answer created:", answer);
          await peer.setLocalDescription(answer);
          socket.emit("sdp:send", { sdp: peer.localDescription });
        }
      } catch (err) {
        console.error("Error handling SDP reply:", err);
      }
    };

    const handleIceReply = async ({ candidate }) => {
      try {
        const peer = peerRef.current;
        if (!peer) return;
        console.log("Received ICE candidate:", candidate);
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };

    const handleMessage = (input) => {
      console.log("Message received on client:", input);
      if (input.sender !== type.p1id) {
        setMessages((prev) => [...prev, { sender: "Stranger", text: input.text }]);
      }
    };

    socket.on("disconnected", handleDisconnected);
    socket.emit("start", handleStart);
    socket.on("remote-socket", handleRemoteSocket);
    socket.on("sdp:reply", handleSdpReply);
    socket.on("ice:reply", handleIceReply);
    socket.on("roomid", (id) => setRoomid(id));
    socket.on("get-message", handleMessage);  // This is where the error occurred

    return () => {
      socket.off("disconnected", handleDisconnected);
      socket.off("remote-socket", handleRemoteSocket);
      socket.off("sdp:reply", handleSdpReply);
      socket.off("ice:reply", handleIceReply);
      socket.off("roomid", (id) => setRoomid(id));
      socket.off("get-message", handleMessage);
      socket.disconnect();
    };
  }, [type]);

  const startMediaCapture = async (peer) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
  
      if (peer.signalingState === "closed") {
        console.log("Peer connection is closed. Cannot add tracks.");
        return;
      }
  
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        
        // Wait for the video element to be ready to play
        localVideoRef.current.onloadedmetadata = () => {
          try {
            localVideoRef.current.play().catch((err) => {
              console.log("Error playing local video:", err);
            });
          } catch (err) {
            console.log("Error playing local video:", err);
          }
        };
      }
  
      // Add tracks only if peer connection is open
      stream.getTracks().forEach((track) => {
        if (peer.signalingState !== "closed") {
          console.log("Adding track to peer connection:", track);
          peer.addTrack(track, stream);
        } else {
          console.log("Peer connection is closed, cannot add track.");
        }
      });
    } catch (err) {
      console.log("Error capturing media:", err);
    }
  };
  
  const handleSendMessage = () => {
    const inputValue = inputRef.current.value;
    if (!inputValue) return;
  
    localSocket.emit("send-message", { text: inputValue, sender: "You", roomid });
    setMessages((prev) => [...prev, { sender: "You", text: inputValue }]);
    inputRef.current.value = "";
  };
  
  const handleEndCall = () => {
    localSocket.emit("end-call", { roomid });
    cleanupMediaAndPeer();
    window.location.href = "/";
  };
  
  const cleanupMediaAndPeer = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };
  

 return (
  <main>
    <section className="pt-[73px] grid grid-cols-2 h-screen">
      <div className="flex flex-col p-4">
        <div className="flex-grow">
          {messages.map((msg, idx) => (
            <div key={idx}>
              <p>{msg.sender}: <span>{msg.text}</span></p>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6">
          <div className="border-2 border-gray-500/50 px-3 py-2 rounded-full flex items-center">
            <input
              type="text"
              ref={inputRef}
              placeholder="Write a message!"
              className="outline-none w-72 text-lg tracking-wide"
            />
            <button onClick={handleSendMessage} className="rotate-12">
              <FiSend size={24} />
            </button>
          </div>
          <button
            onClick={handleEndCall}
            className="bg-red-500 text-white px-3 py-2 rounded-full mt-2"
          >
            End Call
          </button>
        </div>
      </div>
      <div className="flex justify-center items-center relative overflow-hidden">
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          className="w-full h-full object-cover rounded-3xl px-3 py-2" // Full screen and maintaining aspect ratio
        />
        {/* Local video */}
        <video
          ref={localVideoRef}
          muted
          autoPlay
          className="absolute bottom-4 left-4 w-40 h-40 bg-black/50 rounded-2xl object-cover" // Fixed small size for the local video
        />
      </div>
    </section>
  </main>
);
}
