import {
  addCard,
  deductCredits,
  followUnfollowUser,
  getAllUsers,
  getStatistics,
  getTutors,
  getUserCards,
  removeCard,
  searchUsersByEmail,
  tutorFollowers,
  updateProfile,
} from "../controllers/users";
import express from "express";
import { isAuthenticated } from "../middlewares";

export default (router: express.Router) => {
  router.get(`/users`, isAuthenticated, getAllUsers);
  router.get(`/users/search`, isAuthenticated, searchUsersByEmail);
  router.get(`/users/tutors`, isAuthenticated, getTutors);
  router.put(`/users/follow`, isAuthenticated, followUnfollowUser);
  router.get(`/users/listFollow`, isAuthenticated, tutorFollowers);
  router.get("/users/statistics", isAuthenticated, getStatistics);
  router.put("/users/profile", isAuthenticated, updateProfile);
  router.post("/users/cards", isAuthenticated, addCard);
  router.get("/users/cards", isAuthenticated, getUserCards);
  router.delete("/users/cards", isAuthenticated, removeCard);
  router.post("/users/deduct-credits", isAuthenticated, deductCredits);
};
