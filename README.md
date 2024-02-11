启动mongodb服务：
`mongod --config /usr/local/mongodb/mongo/conf/mongo.conf`

## 查询：
### aggregate聚合管道
可以使用`$match`加`$lookup` 来代替`find`和`populate`，性能比`find`加`populate`要好，aggregate更接近原生mongodb语法。
