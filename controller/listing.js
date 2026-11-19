const Listing = require("../modles/listing.js");
const Booking = require("../modles/booking.js");
const User = require("../modles/user.js");
const ExpressError = require("../utils/ExpressError.js");

module.exports.index = async (req, res) => {
    const { q, minPrice, maxPrice, minRating, sort } = req.query;
    let { amenities } = req.query;

    const query = {};

    // 1. Advanced Search across location, country, title, description
    if (q && q.trim().length > 0) {
        const trimmedQ = q.trim();
        const safeRegex = new RegExp(trimmedQ.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "i");
        query.$or = [
            { location: safeRegex },
            { country: safeRegex },
            { title: safeRegex },
            { description: safeRegex },
        ];
    }

    // 2. Price Range Filter (minPrice and maxPrice)
    const parsedMinPrice = minPrice !== undefined && minPrice !== "" ? Number(minPrice) : null;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;

    if ((parsedMinPrice !== null && !isNaN(parsedMinPrice)) || (parsedMaxPrice !== null && !isNaN(parsedMaxPrice))) {
        query.price = {};
        if (parsedMinPrice !== null && !isNaN(parsedMinPrice) && parsedMinPrice >= 0) {
            query.price.$gte = parsedMinPrice;
        }
        if (parsedMaxPrice !== null && !isNaN(parsedMaxPrice) && parsedMaxPrice >= 0) {
            query.price.$lte = parsedMaxPrice;
        }
    }

    // 3. Amenities Filter (Multiple simultaneous selection)
    let selectedAmenities = [];
    if (amenities) {
        if (Array.isArray(amenities)) {
            selectedAmenities = amenities.filter(a => typeof a === "string" && a.trim().length > 0);
        } else if (typeof amenities === "string" && amenities.trim().length > 0) {
            selectedAmenities = amenities.includes(",")
                ? amenities.split(",").map(a => a.trim()).filter(Boolean)
                : [amenities.trim()];
        }
    }

    if (selectedAmenities.length > 0) {
        query.amenities = { $all: selectedAmenities };
    }

    // 4. Fetch matching listings and populate reviews for Rating calculation
    let listings = await Listing.find(query).populate("reviews");

    // Calculate dynamic average rating and review count for each listing
    listings = listings.map(listing => {
        const listingObj = listing.toObject ? listing.toObject() : { ...listing };
        const reviews = listing.reviews || [];
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
            listingObj.avgRating = Math.round((sum / reviews.length) * 10) / 10;
            listingObj.reviewCount = reviews.length;
        } else {
            listingObj.avgRating = 0;
            listingObj.reviewCount = 0;
        }
        return listingObj;
    });

    // 5. Rating Filter (3+, 4+, 5 stars)
    const parsedMinRating = minRating !== undefined && minRating !== "" ? Number(minRating) : null;
    if (parsedMinRating !== null && !isNaN(parsedMinRating) && parsedMinRating > 0) {
        listings = listings.filter(l => l.avgRating >= parsedMinRating);
    }

    // 6. Sorting Options
    if (sort === "price_asc") {
        listings.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sort === "price_desc") {
        listings.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sort === "rating_desc") {
        listings.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else if (sort === "newest") {
        listings.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a._id ? a._id.getTimestamp().getTime() : 0);
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b._id ? b._id.getTimestamp().getTime() : 0);
            return dateB - dateA;
        });
    }

    const hasActiveFilters = Boolean(
        (q && q.trim().length > 0) ||
        (parsedMinPrice !== null && !isNaN(parsedMinPrice)) ||
        (parsedMaxPrice !== null && !isNaN(parsedMaxPrice)) ||
        (parsedMinRating !== null && !isNaN(parsedMinRating) && parsedMinRating > 0) ||
        (selectedAmenities.length > 0) ||
        (sort && sort !== "")
    );

    res.render("listings/index.ejs", {
        alllistings: listings,
        filters: {
            q: q ? q.trim() : "",
            minPrice: parsedMinPrice !== null && !isNaN(parsedMinPrice) ? parsedMinPrice : "",
            maxPrice: parsedMaxPrice !== null && !isNaN(parsedMaxPrice) ? parsedMaxPrice : "",
            minRating: parsedMinRating !== null && !isNaN(parsedMinRating) ? parsedMinRating : "",
            amenities: selectedAmenities,
            sort: sort || "",
        },
        hasActiveFilters,
        totalCount: listings.length,
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({
        listing: id,
        status: "Confirmed",
        checkOut: { $gte: today },
    }).select("checkIn checkOut");

    res.render("listings/show.ejs", { listing, bookings });
};

module.exports.creatingRoute = async (req, res) => {
    if (!req.body.listing) {
        throw new ExpressError(400, "send valid data for listing");
    }

    if (req.body.listing.amenities) {
        if (typeof req.body.listing.amenities === "string") {
            req.body.listing.amenities = [req.body.listing.amenities];
        }
    } else {
        req.body.listing.amenities = [];
    }

    const newlisting = new Listing(req.body.listing);
    newlisting.owner = req.user._id;

    if (req.file) {
        newlisting.image = req.file.path || req.file.url;
    }

    await newlisting.save();
    req.flash("success", "New listing created!");
    res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/edit.ejs", { listing });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let listingData = { ...req.body.listing };

    if (listingData.amenities) {
        if (typeof listingData.amenities === "string") {
            listingData.amenities = [listingData.amenities];
        }
    } else {
        listingData.amenities = [];
    }

    if (req.file) {
        listingData.image = req.file.path || req.file.url;
    }
    await Listing.findByIdAndUpdate(id, listingData);
    req.flash("success", "Listing updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.deleteListing = async (req, res) => {
    let { id } = req.params;
    let deletelist = await Listing.findByIdAndDelete(id);
    console.log(deletelist);
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};
