const { $SuccessCode } = require("../constant/errorData")
const { createRes } = require("../models/responseModel")

const uploadImage = (ctx) => {
  const { req: { file }, request } = ctx;
  ctx.body = createRes($SuccessCode, {
    filename: file ? `http://${request.hostname}:3030/upload/imgs/${file.filename}` : ''
  }, "")
}

module.exports = {
  uploadImage
}