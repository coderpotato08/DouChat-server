const mongoose = require("mongoose");
const UserContacts = require("../src/models/userContactsModel");
const User = require("../src/models/usersModel");

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
    const result = res.filter((item) => item.username !== args[0]).map((item) => ({
      sender: currentUser._id,
      receiver: item._id,
      createTime: curDate,
    }))
    await UserContacts.insertMany(result);
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