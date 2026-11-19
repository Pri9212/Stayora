const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { Isloggedin, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controller/listing.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

//index route
router.get("/", wrapAsync(listingController.index));
//new route
router.get("/new", Isloggedin, listingController.renderNewForm);
//show route
router.get("/:id", wrapAsync(listingController.showListing));
//create route
router.post(
    "/",
    Isloggedin,
    upload.single("listing[image]"),
    wrapAsync(listingController.creatingRoute)
);

//EDIT Route
router.get("/:id/edit", Isloggedin, wrapAsync(listingController.renderEditForm));
//update route
router.put(
    "/:id",
    Isloggedin,
    isOwner,
    validateListing,
    wrapAsync(listingController.updateListing)
);
//DELETE ROUTE
router.delete("/:id", Isloggedin, isOwner, wrapAsync(listingController.deleteListing));

module.exports = router;
