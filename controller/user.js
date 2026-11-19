const User = require("../modles/user.js");

module.exports.renderSignUpForm = (req, res) => {
    res.render("users/signup.ejs");
};

module.exports.singUp = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;

        if (!email || !username || !password) {
            req.flash("error", "Username, email and password are all required.");
            return res.redirect("/signup");
        }

        // Check for duplicate email
        const existingEmailUser = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingEmailUser) {
            req.flash("error", "A user with the given email is already registered");
            return res.redirect("/signup");
        }

        const newuser = new User({ email: email.trim().toLowerCase(), username: username.trim() });
        const registeruser = await User.register(newuser, password);
        console.log("Registered user:", registeruser.username);

        req.login(registeruser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Stayora!");
            res.redirect("/listings");
        });
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
};

// Alias for proper spelling while preserving existing code
module.exports.signUp = module.exports.singUp;

module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
    console.log("Authenticated:", req.isAuthenticated());
    console.log("User:", req.user);

    req.flash("success", "Welcome to Stayora!");
    res.redirect(res.locals.redirecturl || "/listings");
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You have logged out successfully");
        res.redirect("/listings");
    });
};
