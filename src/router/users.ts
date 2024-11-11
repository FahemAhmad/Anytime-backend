import {
  addCard,
  deductCredits,
  followUnfollowUser,
  getAdminUser,
  getAllAdmins,
  getAllUsers,
  getBankDetails,
  getStatistics,
  getTutors,
  getUserCards,
  getUserDetails,
  removeCard,
  searchUsers,
  tutorFollowers,
  updateProfile,
} from "../controllers/users";
import express from "express";
import { authenticateAdmin, isAuthenticated } from "../middlewares";

export default (router: express.Router) => {
  // Admin routes
  router.get(`/users/admin-search`, authenticateAdmin, searchUsers);
  router.get("/users/get-admins", authenticateAdmin, getAllAdmins);
  router.get("/users/admin/:id", authenticateAdmin, getUserDetails);

  // User routes
  router.get("/users/bank-details", isAuthenticated, getBankDetails);
  router.get(`/users/search`, isAuthenticated, searchUsers);
  router.get(`/users/tutors`, isAuthenticated, getTutors);
  router.put(`/users/follow`, isAuthenticated, followUnfollowUser);
  router.get(`/users/listFollow`, isAuthenticated, tutorFollowers);
  router.get("/users/statistics", isAuthenticated, getStatistics);
  router.put("/users/profile", isAuthenticated, updateProfile);
  router.post("/users/cards", isAuthenticated, addCard);
  router.get("/users/cards", isAuthenticated, getUserCards);
  router.delete("/users/cards", isAuthenticated, removeCard);
  router.post("/users/deduct-credits", isAuthenticated, deductCredits);

  // Routes for dashboard

  router.get(`/users`, authenticateAdmin, getAllUsers);
  router.get("/users/admin-details", authenticateAdmin, getAdminUser);
};
