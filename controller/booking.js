const Booking = require("../modles/booking.js");
const Listing = require("../modles/listing.js");
const User = require("../modles/user.js");
const ExpressError = require("../utils/ExpressError.js");
const {
    sendBookingConfirmationEmail,
    sendBookingCancellationEmail,
    sendOwnerBookingNotificationEmail,
} = require("../utils/email.js");

/**
 * Generate a unique, professional booking ID (e.g. WL-K8L9M2-X4Y1)
 */
function generateBookingId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WL-${timestamp}-${random}`;
}

/**
 * Normalize a date string (YYYY-MM-DD) to midnight UTC
 */
function normalizeDate(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
}

/**
 * Check if two date ranges overlap: [startA, endA) and [startB, endB)
 */
function datesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

/**
 * 1. Render Booking Summary / Review Page
 */
module.exports.renderCheckout = async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.query;

    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    // Prevent owner from booking own listing
    if (listing.owner && listing.owner._id.equals(req.user._id)) {
        req.flash("error", "You cannot book your own property!");
        return res.redirect(`/listings/${id}`);
    }

    if (!checkIn || !checkOut) {
        req.flash("error", "Please select both check-in and check-out dates.");
        return res.redirect(`/listings/${id}`);
    }

    const start = normalizeDate(checkIn);
    const end = normalizeDate(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!start || !end) {
        req.flash("error", "Invalid check-in or check-out dates provided.");
        return res.redirect(`/listings/${id}`);
    }

    if (start < today) {
        req.flash("error", "Check-in date cannot be in the past.");
        return res.redirect(`/listings/${id}`);
    }

    if (end <= start) {
        req.flash("error", "Check-out date must be later than check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    // Availability validation on backend
    const overlappingBooking = await Booking.findOne({
        listing: id,
        status: "Confirmed",
        $and: [
            { checkIn: { $lt: end } },
            { checkOut: { $gt: start } },
        ],
    });

    if (overlappingBooking) {
        req.flash("error", "Sorry, this property is already booked for the selected dates. Please choose another date range.");
        return res.redirect(`/listings/${id}`);
    }

    const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const cleaningFee = 500;
    const basePrice = listing.price * nights;
    const totalPrice = basePrice + cleaningFee;
    const guestsCount = Math.max(1, parseInt(guests, 10) || 1);

    res.render("bookings/checkout.ejs", {
        listing,
        checkIn,
        checkOut,
        nights,
        guests: guestsCount,
        cleaningFee,
        basePrice,
        totalPrice,
    });
};

/**
 * 2. Confirm Booking (Direct confirmation without simulated payment)
 */
module.exports.confirmBooking = async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.body;

    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    // Security check: Prevent property owners from booking their own properties
    if (listing.owner && listing.owner._id.equals(req.user._id)) {
        req.flash("error", "You cannot book your own property!");
        return res.redirect(`/listings/${id}`);
    }

    const start = normalizeDate(checkIn);
    const end = normalizeDate(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!start || !end) {
        req.flash("error", "Invalid dates provided.");
        return res.redirect(`/listings/${id}`);
    }

    if (start < today) {
        req.flash("error", "Check-in date cannot be in the past.");
        return res.redirect(`/listings/${id}`);
    }

    if (end <= start) {
        req.flash("error", "Check-out date must be later than check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    // Availability validation: Prevent overlapping bookings
    const overlapping = await Booking.findOne({
        listing: id,
        status: "Confirmed",
        $and: [
            { checkIn: { $lt: end } },
            { checkOut: { $gt: start } },
        ],
    });

    if (overlapping) {
        req.flash("error", "These dates are no longer available. Please select another date range.");
        return res.redirect(`/listings/${id}`);
    }

    const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const cleaningFee = 500;
    const pricePerNight = listing.price;
    const totalPrice = (pricePerNight * nights) + cleaningFee;
    const guestsCount = Math.max(1, parseInt(guests, 10) || 1);

    const bookingId = generateBookingId();

    const newBooking = new Booking({
        bookingId,
        listing: listing._id,
        user: req.user._id,
        owner: listing.owner ? listing.owner._id : null,
        checkIn: start,
        checkOut: end,
        guests: guestsCount,
        nights,
        pricePerNight,
        cleaningFee,
        totalPrice,
        status: "Confirmed",
        emailSent: false,
    });

    await newBooking.save();

    // Actual Email Notifications using Nodemailer
    let guestEmailSent = false;
    try {
        const guestEmailRes = await sendBookingConfirmationEmail({
            booking: newBooking,
            guest: req.user,
            listing,
        });

        if (guestEmailRes && guestEmailRes.success) {
            guestEmailSent = true;
        }

        if (listing.owner) {
            await sendOwnerBookingNotificationEmail({
                booking: newBooking,
                guest: req.user,
                owner: listing.owner,
                listing,
            });
        }
    } catch (emailErr) {
        console.error("[Email Notification Warning] Failed to dispatch emails:", emailErr.message);
    }

    // Update actual email delivery status on the booking document
    newBooking.emailSent = guestEmailSent;
    await newBooking.save();

    if (guestEmailSent) {
        req.flash("success", `Booking confirmed! A confirmation email has been sent to ${req.user.email}.`);
    } else {
        req.flash("success", `Booking confirmed successfully! Booking ID: ${bookingId}`);
    }

    res.redirect(`/bookings/${newBooking._id}/confirmation`);
};

/**
 * 3. Booking Confirmation Page
 */
module.exports.showConfirmation = async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id)
        .populate("listing")
        .populate("user")
        .populate("owner");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }

    // Authorization: only the guest or listing owner may view the confirmation
    const isGuest = booking.user && booking.user._id.equals(req.user._id);
    const isOwner = booking.owner && booking.owner._id.equals(req.user._id);
    if (!isGuest && !isOwner) {
        req.flash("error", "You are not authorized to view this booking.");
        return res.redirect("/listings");
    }

    res.render("bookings/confirmation.ejs", { booking });
};

/**
 * 4. My Bookings Section
 */
module.exports.myBookings = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .populate("owner")
        .sort({ createdAt: -1 });

    res.render("bookings/myBookings.ejs", { bookings });
};

/**
 * 5. Cancel Booking
 */
module.exports.cancelBooking = async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id)
        .populate("listing")
        .populate("user")
        .populate("owner");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/my-bookings");
    }

    // Authorization: only the guest who booked can cancel
    if (!booking.user || !booking.user._id.equals(req.user._id)) {
        req.flash("error", "You do not have permission to cancel this booking.");
        return res.redirect("/my-bookings");
    }

    if (booking.status === "Cancelled") {
        req.flash("error", "This booking is already cancelled.");
        return res.redirect("/my-bookings");
    }

    booking.status = "Cancelled";
    await booking.save();

    // Automated Cancellation Email Notification
    try {
        await sendBookingCancellationEmail({
            booking,
            guest: req.user,
            listing: booking.listing,
        });
    } catch (emailErr) {
        console.error("[Email Notification Warning] Failed to send cancellation email:", emailErr.message);
    }

    req.flash("success", "Booking has been successfully cancelled.");
    res.redirect("/my-bookings");
};

/**
 * 6. Property Owner Dashboard
 */
module.exports.ownerBookings = async (req, res) => {
    // Find all listings belonging to current logged in owner
    const ownerListings = await Listing.find({ owner: req.user._id }).select("_id");
    const ownerListingIds = ownerListings.map((l) => l._id);

    const bookings = await Booking.find({ listing: { $in: ownerListingIds } })
        .populate("listing")
        .populate("user")
        .sort({ createdAt: -1 });

    // Compute summary stats
    const totalBookings = bookings.length;
    const activeBookings = bookings.filter((b) => b.status === "Confirmed").length;
    const totalEarnings = bookings
        .filter((b) => b.status === "Confirmed")
        .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    res.render("bookings/ownerDashboard.ejs", {
        bookings,
        totalBookings,
        activeBookings,
        totalEarnings,
    });
};

/**
 * 7. API: Get booked date ranges for a listing (for client-side calendar validation)
 */
module.exports.getBookedDates = async (req, res) => {
    const { id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({
        listing: id,
        status: "Confirmed",
        checkOut: { $gte: today },
    }).select("checkIn checkOut");

    res.json({
        bookedRanges: bookings.map((b) => ({
            checkIn: b.checkIn,
            checkOut: b.checkOut,
        })),
    });
};
