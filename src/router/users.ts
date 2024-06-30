import {
  getAllUsers,
  getTutors,
  searchUsersByEmail,
} from "../controllers/users";
import express from "express";
import { isAuthenticated } from "../middlewares";

export default (router: express.Router) => {
  router.get(`/users`, isAuthenticated, getAllUsers);
  router.get(`/users/search`, isAuthenticated, searchUsersByEmail);
  router.get(`/users/tutors`, isAuthenticated, getTutors);
};
