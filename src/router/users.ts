import { getAllUsers } from "../controllers/users";
import express from "express";
import { isAuthenticated } from "../middlewares";

export default (router: express.Router) => {
  router.get(`/users`, getAllUsers);
};
