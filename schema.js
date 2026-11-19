const Joi = require("joi");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        amenities: Joi.alternatives()
            .try(Joi.array().items(Joi.string()), Joi.string())
            .allow(null, ""),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required(),
        comment: Joi.string().required(),
    }).required(),
});

module.exports.bookingSchema = Joi.object({
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref("checkIn")).required(),
    guests: Joi.number().integer().min(1).max(20).required(),
    paymentMethod: Joi.string().allow("", null),
});
