import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { logger } from "../lib/logger";

let io: SocketServer | null = null;

// spins up the socket.io server on top of the http server
export function initSocket(httpServer: HttpServer): void {
  if (io) {
    return;
  }

  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket client connected");

    socket.on("join:org", (orgId: string) => {
      if (!orgId) {
        return;
      }

      socket.join(`org:${orgId}`);

      logger.debug(
        {
          socketId: socket.id,
          orgId,
        },
        "Socket joined org room",
      );
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket client disconnected");
    });
  });
}

// returns the socket.io server instance (null if not set up yet)
export function getIo(): SocketServer | null {
  return io;
}

/**
 * Emits an event to all sockets in an organization room.
 * Silently no-ops if Socket.io is not initialized.
 */
export function emitToOrg(
  organizationId: string,
  event: string,
  data: unknown,
): void {
  if (!io) {
    logger.warn(
      { event, organizationId },
      "Socket.io not initialized — event not emitted",
    );
    return;
  }

  io.to(`org:${organizationId}`).emit(event, data);

  logger.debug({ event, organizationId }, "Socket event emitted to org room");
}
