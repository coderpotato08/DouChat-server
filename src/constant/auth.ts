export const OAuthConfig = {
  github: {
    clientID: 'Ov23lisqdv5ujigOtdPh',
    clientSecret: 'dede08624ed50aee562b6e38b9b2827306587523',
    defaultPassword: 'git123456',
  },
  google: {
    clientID: 'google_client_id',
    clientSecret: 'google_client_secret',
    defaultPassword: 'google123456',
  }
}

export const redirectUrl = 'http://localhost:3000/login';

export enum GitHubTokenError {
  /** client_id或client_secret不正确 */
  incorrect_client_credentials = 'incorrect_client_credentials',
  /** Authorization callback URL 不匹配 */
  redirect_uri_mismatch = 'redirect_uri_mismatch', 
  /** code不正确或已过期 */
  bad_verification_code = 'bad_verification_code',
  /** 邮箱未核实 */
  unverified_user_email = 'unverified_user_email',
}