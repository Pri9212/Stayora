const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const passposrtmongoose=require("passport-local-mongoose");

const userSchema=new Schema({
    email:{
        type:String,
        required:true,
    }
});

userSchema.plugin(passposrtmongoose.default||passposrtmongoose);
const User=mongoose.model("User",userSchema);
module.exports=User;