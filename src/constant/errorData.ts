export const $SuccessCode = 10000
export enum $ErrorType {
    // register_error_type
    USERNAME_REPEATED_ERROR = "USERNAME_REPEATED",
    EMAIL_REPEATED_ERROR = "EMAIL_REPEATED_ERROR",
    SERVER_ERROR = "SERVER_ERROR",
    // login_error_type
    USERNAME_UNFOUND_ERROR = "USERNAME_UNFOUND_ERROR",
}
export enum $ErrorCode {
    SERVER_ERROR = 0,
    // register_error_code
    USERNAME_REPEATED_ERROR = 10001,
    EMAIL_REPEATED_ERROR,
    // login_error_code
    USERNAME_UNFOUND_ERROR,
    PASSWORD_INVALID_ERROR,
    TOKEN_ERROR,
    TOKEN_MISSING_ERROR,
    REGISTER_FAIL,
    // message_error_code
    ADD_MESSAGE_ERROR,
    // server_error_code
    SIGNAL_SERVER_ERROR,
    // meeting_error_code
    USER_LIST_EMPTY,
    // friend_error_code
    FRIENDSHIP_NOT_EXIST,
    GROUP_NUMBER_EXIST,
}
export enum $ErrorMessage {
    // register_error_text
    SERVER_ERROR = "系统异常",
    USERNAME_REPEATED_ERROR = "用户名已被注册！",
    EMAIL_REPEATED_ERROR = "邮箱已被使用！",
    // login_error_text
    USERNAME_UNFOUND_ERROR = "用户名错误！",
    PASSWORD_INVALID_ERROR = "密码错误!",
    TOKEN_MISSING_ERROR = "token missing!",
    TOKEN_ERROR = "会话已过期，请重新登陆！",
    // message_error_text
    ADD_MESSAGE_ERROR = "发送消息失败",
    // meeting_error_text
    USER_LIST_EMPTY = "会议邀请用户不能为空",
    GROUP_NUMBER_EXIST = "该群号已被占用"
}
