const mongoose = require("mongoose");
const Listing = require("../modles/listing.js");
const User = require("../modles/user.js");
const initdata = require("./data.js");

main()
    .then(() => {
        console.log("connection successful");
        initDB();
    })
    .catch((err) => console.log(err));

async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/wonderlust");
}

const initDB = async () => {
    await Listing.deleteMany({});
    const hostUser = await User.findOne({ username: "Priyanshu" });
    const hostId = hostUser ? hostUser._id : "6ae49dbe9086252e4959f783";
    initdata.data = initdata.data.map((obj) => ({ ...obj, owner: hostId }));
    await Listing.insertMany(initdata.data);
    console.log("data was initialized with host Priyanshu");
};
