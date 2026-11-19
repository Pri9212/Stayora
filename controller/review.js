const Listing=require("../modles/listing.js");
const Review=require("../modles/review.js")
module.exports.createReview=async(req,res)=>{
let  listing=await Listing.findById(req.params.id);
let newreview=new Review(req.body.review);
let {id}=req.params;
newreview.author=req.user._id;

listing.reviews.push(newreview);
await newreview.save();
await listing.save();
res.redirect(`/listings/${id}`);
}

module.exports.destroyReview=async(req,res)=>{
    let{id,reviewId}=req.params;
await Listing.findByIdAndUpdate(id,{$pull:{reviews:reviewId}});
await Review.findByIdAndDelete(reviewId);
res.redirect(`/listings/${id}`);
}