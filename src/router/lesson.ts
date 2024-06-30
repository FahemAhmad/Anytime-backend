import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  createNewLesson,
  getBookedLessonsOfuser,
  getOfferedLessons,
} from "../controllers/lesson";

export default (router: express.Router) => {
  router.get(`/lessons`, isAuthenticated, getOfferedLessons);
  router.post(`/lessons`, isAuthenticated, createNewLesson);
  router.get("/lessons/booked", isAuthenticated, getBookedLessonsOfuser);
};
