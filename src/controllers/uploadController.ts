import { Context } from "koa";
import { $SuccessCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";

export const uploadImage = (ctx: Context) => {
  const { request } = ctx;
  const { file } = (ctx.req as any);
  ctx.body = createRes($SuccessCode, {
    filename: file ? `http://${request.hostname}:3030/upload/imgs/${file.filename}` : ''
  }, "")
}

export const uploadFile = (ctx: Context) => {
  const { request } = ctx;
  const { file } = (ctx.req as any);
  ctx.body = createRes($SuccessCode, {
    mimetype: file.mimetype,
    filename: file.filename,
    size: file.size,
    url: file ? `http://${request.hostname}:3030/upload/files/${file.filename}` : ''
  }, "")
}