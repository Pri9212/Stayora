if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const ejsmate = require("ejs-mate");

const ExpressError = require("./utils/ExpressError.js");

const listings = require("./routes/listing.js");
const reviews = require("./routes/review.js");
const users = require("./routes/user.js");
const bookings = require("./routes/booking.js");

const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./modles/user.js");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsmate);

main()
    .then(() => {
        console.log("connection successful");
    })
    .catch((err) => console.log(err));

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
}

const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.curruser = req.user;
    res.locals.searchQuery = req.query.q || "";
    next();
});

// Root route redirects to listings
app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Bookings, listings, reviews, and users routes
app.use("/", bookings);
app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);
app.use("/", users);

app.all("/{*splat}", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    let { statuscode = 500, message = "Something Went Wrong!" } = err;
    res.status(statuscode).render("error.ejs", { message });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`App is listening at port ${PORT}`);
});