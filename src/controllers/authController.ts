import { Context } from "koa";
import { OAuthConfig } from "../constant/auth";
import superagent from "superagent";
import { $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";

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
    superagent
      .post(url)
      .send(params)
      .set("User-Agent", userAgent!)
      .set("Accept", "application/json")
      .end((err: any, accessInfo: any) => {
        if (err) return;
        const { access_token, scope, token_type } = accessInfo;
        console.log(accessInfo);
        const userInfo: any = superagent
          .get("https://api.github.com/user")
          .set("User-Agent", userAgent!)
          .set("Authorization", `${token_type} ${access_token}`)
          .end((err: any, userInfo: any) => {
            if (err) return;
            ctx.body = createRes($SuccessCode, userInfo, "");
          });
      });
  } catch (err) {
    console.log(err);
  }
};
