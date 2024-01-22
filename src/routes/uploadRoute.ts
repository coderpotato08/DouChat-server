import multer from 'koa-multer';
import Router from 'koa-router';
import path from 'node:path';
import {
  uploadImage
} from '../controllers/uploadController';

let storage = multer.diskStorage({
  destination(req, file, cb) {
    let savePath = 'imgs'
    const { mimetype } = file;
    if (mimetype.indexOf('image') > -1) {
      savePath = 'imgs' // 图片
    } else {
      savePath = 'files'  // 其他文件
    }
    cb(null, path.resolve(__dirname, `../public/upload/${savePath}`));
  },
  filename(req, file, cb) {
    let fileFormat = (file.originalname).split(".");
    cb(null, `CHAT_${Date.now()}.${fileFormat[fileFormat.length - 1]}`);
  }
})
//加载配置
let upload = multer({ storage: storage })

const router = new Router({
  prefix: '/upload'
})

router.post('/image', upload.single('image'), uploadImage);

export default router