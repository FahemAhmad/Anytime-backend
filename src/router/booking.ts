import express from "express";
import { isAuthenticated } from "../middlewares";
import {
  addProof,
  bookASpot,
  bookingPayed,
  changeBookingStatus,
} from "../controllers/booking";

export default (router: express.Router) => {
  router.post(`/bookings`, isAuthenticated, bookASpot);
  router.put(`/bookings/:id/status`, isAuthenticated, changeBookingStatus);
  router.put(`/bookings/:id/payed`, isAuthenticated, bookingPayed);
  router.put(`/bookings/:id/proof`, isAuthenticated, addProof);
};
