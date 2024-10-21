import mongoose from 'mongoose';
import Log from '../console';

const initMongoose = () => {
  const log = new Log();
  new Promise((resolve, reject) => {
    mongoose.connect(process.env.MONGOOSE_URL!)
    .then(() => {
        log.time().success().printLog("mongodb connect success")
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