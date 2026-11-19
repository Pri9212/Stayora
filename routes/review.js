const express=require("express");
const router=express.Router({mergeParams:true});
const wrapAsync=require("../utils/wrapAsync.js");
const {listingSchema,reviewSchema}=require("../schema.js");
const ExpressError=require("../utils/ExpressError.js");
const Review= require("../modles/review.js");
const Listing = require("../modles/listing.js");
const {validateReview,Isloggedin,isReviewAuthor}=require("../middleware.js");
const reviewController=require("../controller/review.js");

router.post("/",Isloggedin,validateReview,wrapAsync(reviewController.createReview));
//delete review route
router.delete("/:reviewId",Isloggedin,wrapAsync( reviewController.destroyReview));

module.exports=router;