const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    bookingId: {
        type: String,
        required: true,
        unique: true,
    },
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    checkIn: {
        type: Date,
        required: true,
    },
    checkOut: {
        type: Date,
        required: true,
    },
    guests: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    nights: {
        type: Number,
        required: true,
        min: 1,
    },
    pricePerNight: {
        type: Number,
        required: true,
    },
    cleaningFee: {
        type: Number,
        default: 500,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["Confirmed", "Cancelled"],
        default: "Confirmed",
    },
    emailSent: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
