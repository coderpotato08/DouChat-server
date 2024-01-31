import mongoose from "mongoose";
import UserContacts from "../src/models/userContactsModel";
import User from "../src/models/usersModel";

mongoose.connect("mongodb://localhost/chat_db_v2")
.then(() => {
    console.log("mongodb connect success")
})
.catch((err) => {
    console.log("mongodb connect fail")
    console.log(err)
})

const args = process.argv.slice(2)

User.find().then(async (res) => {
    const currentUser = res.filter((item) => item.username == args[0])[0];
    const curDate = new Date();
    await UserContacts.deleteMany({sender: currentUser._id})
    const params = res.filter((item) => item.username !== args[0]).map((item) => ({
      contactId: [currentUser._id, item._id].join("_"),
      users: [currentUser._id, item._id],
      createTime: curDate,
    }))
    await UserContacts.insertMany(params);
    mongoose.connection.close(function() {  
      console.log('success!!! mongoose connection closed');  
    }); 
    return;
}).catch((err) => {
    console.log(err);
    mongoose.connection.close(function() {  
      console.log('fail!!! mongoose connection closed');  
    }); 
    return;
})