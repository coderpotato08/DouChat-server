export const $SuccessCode = 10000;
export const $ErrorCode = {
  Common: {
    SERVER_ERROR: 0,
    SIGNAL_SERVER_ERROR: 10000,
  },
  Register: {
    USERNAME_REPEATED_ERROR: 10001,
    EMAIL_REPEATED_ERROR: 10002,
    REGISTER_FAIL: 10007,
  },
  Login: {
    USERNAME_UNFOUND_ERROR: 10003,
    PASSWORD_INVALID_ERROR: 10004,
    TOKEN_ERROR: 10005,
    TOKEN_MISSING_ERROR: 10006,
  },
  Message: {
    ADD_MESSAGE_ERROR: 10008,
  },
  Meeting: {
    USER_LIST_EMPTY: 10009,
  },
  Relationship: {
    FRIENDSHIP_NOT_EXIST: 10010,
    GROUP_NUMBER_EXIST: 10011,
  },
  Auth: {
    github: {
      /** client_id或client_secret不正确 */
      incorrect_client_credentials: 10100,
      /** Authorization callback URL 不匹配 */
      redirect_uri_mismatch: 10101,
      /** code不正确或已过期 */
      bad_verification_code: 10102,
      /** 邮箱未核实 */
      unverified_user_email: 10103,
    },
  },
};

export const $ErrorMessage = {
  Common: {
    SERVER_ERROR: "系统异常",
  },
  Register: {
    USERNAME_REPEATED_ERROR: "用户名已被注册！",
    EMAIL_REPEATED_ERROR: "邮箱已被使用！",
    REGISTER_FAIL: "注册失败！",
  },
  Login: {
    USERNAME_UNFOUND_ERROR: "用户名错误！",
    PASSWORD_INVALID_ERROR: "密码错误!",
    TOKEN_ERROR: "token missing!",
    TOKEN_MISSING_ERROR: "会话已过期，请重新登陆！",
  },
  Message: {
    ADD_MESSAGE_ERROR: "发送消息失败，请检查网络状态",
  },
  Meeting: {
    USER_LIST_EMPTY: "会议邀请用户不能为空",
  },
  Relationship: {
    GROUP_NUMBER_EXIST: "该群号已被占用",
  },
  Auth: {
    github: {
      /** client_id或client_secret不正确 */
      incorrect_client_credentials: "client_id或client_secret不正确",
      /** Authorization callback URL 不匹配 */
      redirect_uri_mismatch: "Authorization callback URL 不匹配",
      /** code不正确或已过期 */
      bad_verification_code: "会话已过期，请重新登陆！",
      /** 邮箱未核实 */
      unverified_user_email: "邮箱未核实，请联系管理员",
    },
  },
};
