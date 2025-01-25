"use client";

import { useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { io } from "socket.io-client";

export default function Home() {
  const [isWaiting, setIsWaiting] = useState(true);
  const [messages, setMessages] = useState([]);
  const [localSocket, setLocalSocket] = useState(null);
  const [remoteSocket, setRemoteSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [type, setType] = useState(null);
  const [roomId, setRoomId] = useState(null);

  const inputRef = useRef();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BACKEND);
    setLocalSocket(socket);

    socket.on("disconnected", () => {
      console.log("Disconnected");
    });

    socket.emit("start", (person) => {
      setType(person);
    });

    socket.on("remote-socket", (id) => {
      setRemoteSocket(id);
      setIsWaiting(false);
      const connectedUser = new RTCPeerConnection();
      setPeer(connectedUser);

      connectedUser.onnegotiationneeded = async () => {
        if (type === "p1") {
          const offer = await connectedUser.createOffer();
          await connectedUser.setLocalDescription(offer);
          socket.emit("sdp:send", { sdp: connectedUser.localDescription });
        }
      };

      connectedUser.onicecandidate = (event) => {
        socket.emit("ice:send", { candidate: event.candidate, to: id });
      };

      connectedUser.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play();
        }
      };

      // complete this
    });

    socket.on("sdp:reply", async ({ sdp }) => {
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      if (type === "p2") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("sdp:send", { sdp: peer.localDescription });
      }
    });

    socket.on("ice:reply", async ({ candidate }) => {
      await peer.addIceCandidate(candidate);
    });

    socket.on("room-id", (id) => {
      setRoomId(id);
    });

    socket.on("get-message", (input) => {
      setMessages((prev) => [...prev, { sender: "Stranger", text: input }]);
    });

    return () => socket.disconnect();
  }, [type, peer]);

  //Start audio and video capturing
  function startMediaCapture(newPeer) {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => newPeer.addTrack(track, stream));
      })
      .catch((err) => console.log(err));
  }

  // Function to send messages
  function handleSendMessage() {
    const inputValue = inputRef.current.value;
    if (!inputValue) {
      return;
    }

    localSocket.on("send-message", inputValue, type, roomId);
    setMessages((prev) => [...prev, { sender: "You", text: inputValue }]);
    inputRef.current.value = "";
  }

  return (
    <>
      <main>
        <section className="pt-[73px] grid grid-cols-2 h-screen">
          <div className="flex flex-col p-4">
            <div className="flex-grow">
              {messages.map((msg, idx) => (
                <>
                  <div key={idx + 1}>
                    <p>
                      {msg.sender}: <span>{msg.text}</span>
                    </p>
                  </div>
                </>
              ))}
            </div>
            <div className="flex justify-center">
              <div className="border-2 border-gray-500/50 px-3 py-2 rounded-full flex items-center">
                <input
                  type="text"
                  ref={inputRef}
                  name=""
                  id=""
                  placeholder="Write in a message!"
                  className="outline-none w-72 text-lg tracking-wide"
                />
                <button onClick={handleSendMessage} className="rotate-12">
                  <FiSend size={24} />
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 mx-auto p-4">
            <video
              ref={remoteVideoRef}
              autoPlay
              className="bg-black/20 h-full rounded-2xl"
            ></video>
            <video
              ref={localVideoRef}
              muted
              autoPlay
              className="bg-black/50 h-full rounded-2xl"
            ></video>
          </div>
        </section>
      </main>
    </>
  );
}
