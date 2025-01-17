import { Context } from "koa";
import UserModel, { ThirdPlatformEnum } from "../models/usersModel";
import { GitHubTokenError, OAuthConfig } from "../constant/auth";
import superagent from "superagent";
import { $ErrorCode, $ErrorMessage, $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";
import { GenderEnum } from "../constant/apiTypes";

const userCreateOrLogin = async (params: any, platform: ThirdPlatformEnum) => {
  const { name, login, avatar_url, accessToken } = params;
  let thirdPlatformParams: any = {};
  switch (platform) {
    case ThirdPlatformEnum.GITHUB:
      thirdPlatformParams = {
        thirdPlatform: platform,
        thirdAccessToken: accessToken,
      };
      console.log(thirdPlatformParams);
    default:
      break;
  }
  const existUser = await UserModel.findOne({ username: login });
  if (!existUser) {
    const newUser = await UserModel.create({
      nickname: name,
      username: login,
      password: OAuthConfig.github.defaultPassword,
      gender: GenderEnum.MAN,
      avatarImage: avatar_url,
      email: "",
      phoneNumber: "",
      ...thirdPlatformParams,
    });
    return Promise.resolve(newUser);
  } else {
    await UserModel.updateOne(
      { _id: existUser._id },
      { ...thirdPlatformParams }
    );
    return Promise.resolve({ ...existUser, ...thirdPlatformParams });
  }
};

export const githubAuth = async (ctx: Context) => {
  const date = new Date().valueOf();
  let authPath = "https://github.com/login/oauth/authorize";
  authPath += "?client_id=" + OAuthConfig.github.clientID;
  authPath += "&scope=user";
  authPath += "&state=" + date;
  //转发到授权服务器
  ctx.redirect(authPath);
};

export const githubAuthAccess = async (ctx: Context) => {
  const { code, state } = ctx.request.body as any;
  const userAgent = ctx.request.headers["user-agent"];
  const url = "https://github.com/login/oauth/access_token";
  const params = {
    client_id: OAuthConfig.github.clientID,
    client_secret: OAuthConfig.github.clientSecret,
    code,
    state,
  };
  try {
    const tokenRes = await superagent
      .post(url)
      .send(params)
      .set("User-Agent", userAgent!)
      .accept("application/json");
    const { access_token, token_type, error } = tokenRes.body || {};
    /** 处理access_token接口返回的错误 */
    if (error) {
      ctx.body = createRes(
        $ErrorCode.Auth.github[error as GitHubTokenError],
        null,
        $ErrorMessage.Auth.github[error as GitHubTokenError]
      );
      return;
    }
    const userRes = await superagent
      .get("https://api.github.com/user")
      .set("User-Agent", userAgent!)
      .set("Authorization", `${token_type} ${access_token}`);
    await userCreateOrLogin(
      {
        ...userRes.body,
        accessToken: access_token,
      },
      ThirdPlatformEnum.GITHUB
    );
    ctx.body = createRes($SuccessCode, userRes.body, "");
  } catch (err) {
    console.log(err);
  }
};
