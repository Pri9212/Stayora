const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { Isloggedin } = require("../middleware.js");
const bookingController = require("../controller/booking.js");

// API to get already booked dates for a listing
router.get("/listings/:id/booked-dates", wrapAsync(bookingController.getBookedDates));

// Checkout and demo payment review page
router.get("/listings/:id/book", Isloggedin, wrapAsync(bookingController.renderCheckout));

// Confirm booking and process demo payment
router.post("/listings/:id/book", Isloggedin, wrapAsync(bookingController.confirmBooking));

// Booking confirmation page
router.get("/bookings/:id/confirmation", Isloggedin, wrapAsync(bookingController.showConfirmation));

// User's bookings
router.get("/my-bookings", Isloggedin, wrapAsync(bookingController.myBookings));
router.get("/bookings/my-bookings", Isloggedin, wrapAsync(bookingController.myBookings));

// Cancel booking
router.post("/bookings/:id/cancel", Isloggedin, wrapAsync(bookingController.cancelBooking));

// Property owner dashboard
router.get("/owner/bookings", Isloggedin, wrapAsync(bookingController.ownerBookings));
router.get("/bookings/owner-dashboard", Isloggedin, wrapAsync(bookingController.ownerBookings));

module.exports = router;

