import mongoose from "mongoose";
import { SystemLogger } from "../console";

const initMongoose = async () => {
  mongoose.set("strictQuery", false);
  return new Promise((resolve, reject) => {
    mongoose
      .connect(process.env.MONGOOSE_URL!)
      .then(() => {
        SystemLogger.time().success().printLog("mongodb connect success");
        resolve({ status: "success" });
      })
      .catch((err) => {
        console.log("mongodb connect fail");
        console.log(err);
        reject();
      });
  });
};

export default initMongoose;
