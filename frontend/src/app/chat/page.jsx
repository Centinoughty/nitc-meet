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
      transports: ["websocket"], // Ensure WebSocket transport is used
    });
    setLocalSocket(socket);

    const handleDisconnected = () => {
      console.log("Disconnected");
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

      await startMediaCapture(peer); // Ensure media capture starts before negotiation

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
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play();
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

    const handleRoomId = (id) => {
      setRoomid(id);
    };

    const handleMessage = (input) => {
      console.log("Message received on client:", input);
      setMessages((prev) => {
        if (
          !prev.some((msg) => msg.text === input && msg.sender === "Stranger")
        ) {
          return [
            ...prev,
            { sender: type === "Stranger" ? "Stranger" : "You", text: input },
          ];
        }
        return prev;
      });
    };

    socket.on("disconnected", handleDisconnected);
    socket.emit("start", handleStart);
    socket.on("remote-socket", handleRemoteSocket);
    socket.on("sdp:reply", handleSdpReply);
    socket.on("ice:reply", handleIceReply);
    socket.on("roomid", handleRoomId);
    socket.on("get-message", handleMessage);

    return () => {
      socket.off("disconnected", handleDisconnected);
      socket.off("remote-socket", handleRemoteSocket);
      socket.off("sdp:reply", handleSdpReply);
      socket.off("ice:reply", handleIceReply);
      socket.off("roomid", handleRoomId);
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

      // peer.addStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }

      stream.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track);
        peer.addTrack(track, stream);
      });
    } catch (err) {
      console.error("Error capturing media:", err);
    }
  };

  const handleSendMessage = () => {
    const inputValue = inputRef.current.value;
    if (!inputValue) return;

    // Only emit the message if it's not already in the message list
    if (
      !messages.some((msg) => msg.text === inputValue && msg.sender === "You")
    ) {
      localSocket.emit("send-message", inputValue, type, roomid);
    }

    // Update the state immediately with the message being sent
    // setMessages((prev) => [...prev, { sender: "You", text: inputValue }]);

    inputRef.current.value = "";
  };

  return (
    <>
      <main>
        <section className="pt-[73px] grid grid-cols-2 h-screen">
          <div className="flex flex-col p-4">
            <div className="flex-grow">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <p>
                    {msg.sender}: <span>{msg.text}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <div className="border-2 border-gray-500/50 px-3 py-2 rounded-full flex items-center">
                <input
                  type="text"
                  ref={inputRef}
                  placeholder="Write in a message!"
                  className="outline-none w-72 text-lg tracking-wide"
                />
                <button onClick={handleSendMessage} className="rotate-12">
                  <FiSend size={24} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-center ">
            <video
              ref={remoteVideoRef}
              autoPlay
              className="rounded-2xl p-4 h-fit"
            ></video>
            <video
              ref={localVideoRef}
              muted
              autoPlay
              className="absolute bottom-0 bg-black/50 rounded-2xl h-40"
            ></video>
          </div>
        </section>
      </main>
    </>
  );
}
