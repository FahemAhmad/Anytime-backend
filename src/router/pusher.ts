import express from "express";
import { pusherServer } from "../lib/pusher";
import { isAuthenticated } from "../middlewares";

export default (router: express.Router) => {
  router.post(
    "/pusher/auth",
    isAuthenticated,
    (req: express.Request, res: express.Response) => {
      const body = req.body;
      const socketId = body.socket_id;
      const channel = body.channel_name;
      const data = {
        user_id: (req as any).identity._id,
      };

      const authResponse = pusherServer.authorizeChannel(
        socketId,
        channel,
        data
      );

      return res.status(201).send(authResponse);
    }
  );
};
