import mongoose from 'mongoose';

const initMongoose = () => {
  new Promise((resolve, reject) => {
    mongoose.connect(process.env.MONGOOSE_URL!)
    .then(() => {
        console.log("mongodb connect success")
        resolve({ status: "success"});
    })
    .catch((err) => {
        console.log("mongodb connect fail")
        console.log(err)
        reject()
    })
  })
}

export default initMongoose;