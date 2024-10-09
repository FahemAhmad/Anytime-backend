import express from "express";
import authentication from "./authentication";
import users from "./users";
import conversation from "./conversation";
import messages from "./messages";
import pusher from "./pusher";
import session from "./session";
import comment from "./comment";
import rating from "./rating";
import lesson from "./lesson";
import payment from "./payment";
import booking from "./booking";
import notifications from "./notifications";
import transaction from "./transaction";
import feedback from "./feedback";
import statistics from "./statistics";

const router = express.Router();

export default (): express.Router => {
  conversation(router);
  authentication(router);
  pusher(router);
  users(router);
  messages(router);
  session(router);
  comment(router);
  rating(router);
  lesson(router);
  payment(router);
  booking(router);
  notifications(router);
  transaction(router);
  feedback(router);
  statistics(router);

  return router;
};
