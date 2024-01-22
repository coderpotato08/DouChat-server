export const createRes = (code: string | number, data: any, msg: string = "") => {
  return { code, data, msg }
}