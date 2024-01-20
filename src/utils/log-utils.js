const chalk = require('chalk');

const logUtil = (type) => {
  switch(type) {
    case "online-user":
      return logOnlineUserInfo
  }
}
const logOnlineUserInfo = (addUser, num) => {
  const { username, _id } = addUser;
  console.log(
    chalk.bgGreen.bold(`user ${username} has login`), 
    "online user number：",
    chalk.bgGreen.bold(num)
  )
}

module.exports = logUtil