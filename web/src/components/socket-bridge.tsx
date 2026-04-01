"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getSocketOrigin } from "@/lib/socket";

/**
 * Establishes a Socket.IO connection to the backend (foundation for realtime features).
 * Safe to mount globally; disconnects on unmount.
 */
export function SocketBridge() {
  useEffect(() => {
    const origin = getSocketOrigin();
    const socket: Socket = io(origin, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socket.on("connect", () => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[socket.io] connected", socket.id);
      }
    });
    socket.on("hello", () => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[socket.io] handshake ok");
      }
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}
