const session = require('koa-session');
module.exports = (app) => {
  return session({
    key: "sessionid",
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    // rolling: true
  }, app)
}