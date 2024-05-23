import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: "1800044",
  key: "933060bd7549076211fe",
  secret: "f2e3343428aa4f2389bb",
  cluster: "ap4",
  useTLS: true,
});
