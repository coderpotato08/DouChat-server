const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const privateCret = fs.readFileSync(path.join(__dirname, '../pem/rsa_private_key.pem'));
const publicCret = fs.readFileSync(path.join(__dirname, '../pem/rsa_public_key.pem'));
class JwtUtil {
    constructor(data) {
        this.data = data;
    }

    generateToken() {
        const data = this.data;
        const created = Date.now();
        //私钥 加密
        const token = jwt.sign(
            {
                data,
                exp: created + 60 * 60 * 1000
            },
            privateCret,
            { 
                algorithm: 'RS256',
                allowInsecureKeySizes: true,
            }
        );
        return token;
    }

     // 校验token
    verifyToken() {
        const token = this.data;
        let res;
        try {
            //公钥 解密
            const result = jwt.verify(token, publicCret, { algorithms: ['RS256'] }) || {};
            const { exp = 0 } = result;
            const current = Date.now();
            //验证时效性
            if (current <= exp) {
                res = result.data || {};
            }
        } catch (e) {
            res = 'err';
        }
        return res;
    }
}

module.exports = JwtUtil