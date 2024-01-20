module.exports = {
  $SuccessCode: 10000,
  $ErrorType: {
      // register_error_type
      USERNAME_REPEATED_ERROR: "USERNAME_REPEATED",
      EMAIL_REPEATED_ERROR: "EMAIL_REPEATED_ERROR",
      SERVER_ERROR: "SERVER_ERROR",
      // login_error_type
      USERNAME_UNFOUND_ERROR: "USERNAME_UNFOUND_ERROR",
  },
  $ErrorCode: {
      // register_error_code
      USERNAME_REPEATED_ERROR: 10001,
      EMAIL_REPEATED_ERROR: 10002,
      // login_error_code
      USERNAME_UNFOUND_ERROR: 10003,
      PASSWORD_INVALID_ERROR: 10004,
      TOKEN_ERROR: 10005,
      TOKEN_MISSING_ERROR: 10006,
      // message_error_code
      ADD_MESSAGE_ERROR: 10006,
      // server_error_code
      SERVER_ERROR: 0,
      SIGNAL_SERVER_ERROR: 10007,
      // meeting_error_code
      USER_LIST_EMPTY: 10008,
  },
  $ErrorMessage: {
      // register_error_text
      SERVER_ERROR: "系统异常",
      USERNAME_REPEATED_ERROR: "用户名已被注册！",
      EMAIL_REPEATED_ERROR: "邮箱已被使用！",
      // login_error_text
      USERNAME_UNFOUND_ERROR: "用户名错误！",
      PASSWORD_INVALID_ERROR: "密码错误!",
      TOKEN_MISSING_ERROR: "token missing!",
      TOKEN_ERROR: "会话已过期，请重新登陆！",
      // message_error_text
      ADD_MESSAGE_ERROR: "发送消息失败",
      // meeting_error_text
      USER_LIST_EMPTY: "会议邀请用户不能为空",
  },
}