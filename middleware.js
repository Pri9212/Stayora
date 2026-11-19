const Listing = require("./modles/listing.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, bookingSchema } = require("./schema.js");
const Review = require("./modles/review.js");
const Booking = require("./modles/booking.js");

module.exports.Isloggedin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirecturl = req.originalUrl;
        req.flash("error", "You must be logged in!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirecturl = (req, res, next) => {
    if (req.session.redirecturl) {
        res.locals.redirecturl = req.session.redirecturl;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }
    if (res.locals.curruser && !listing.owner._id.equals(res.locals.curruser._id)) {
        req.flash("error", "you are not owner of this listing");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg);
    } else {
        next();
    }
};

module.exports.validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg);
    } else {
        next();
    }
};

module.exports.validateBooking = (req, res, next) => {
    let { error } = bookingSchema.validate(req.body);
    if (error) {
        let errmsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errmsg);
    } else {
        next();
    }
};

module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if (!review.author._id.equals(res.locals.curruser._id)) {
        req.flash("error", "you are not Author of the reviews");
        return res.redirect(`/listings/${id}`);
    }
    next();
};
