# Feiehew A simple http server
## 例子
```
import FeieServer from "./feiehews.mjs";
let server = new FeieServer({
    https: true,
    key: "./server.key", //path to server.key
    cert: "./server.crt", //path to server.crt
    staticPath: "./", //path to work dir
    enableGzip: true,
    httpVersion: 2,
});
server.setHttpFallback(80)
server.listen(443, () => {
    console.log("Server started at port 443");
});
```
## 构造函数
```
let server = new FeieServer(
    {
        httpVersion: 2 //设置http版本，1或2
        https: true //是否使用https
        enableGzip: true //是否启用gzip
        key: "./server.key" //https密钥
        cert: "./server.crt" //https证书
        staticPath: "/yourpath/" //静态文件路径
        logOutputer: console.log //日志输出器
        enableServerPush: true //是否启用服务端推送
        enableHttpCache: true //是否启用http缓存
    }
)
```
## API
### FeieServer.listen()
监听指定端口
```
server.listen(443, //port
    () => {console.log("Server started at port 443"); //启动成功后触发
});
```
### FeieServer.setHttpFallback()
当用户使用http访问时重定向至https
```
server.setHttpFallback(80) 
```
### FeieServer.setExtraHeader()
设置额外的响应头
```
server.setExtraHeader([
    {'Cross-Origin-Embedder-Policy': 'require-corp'},
    {'Cross-Origin-Opener-Policy': 'same-origin'},
])

server.setExtraHeader({'Cross-Origin-Embedder-Policy': 'require-corp'})
```
### FeieServer.setServerPush
设置http2服务端推送
```
server.setServerPush({
    "/feieAni/index.html": [
        "/feieAni/main.js",
        "/feieAni/main.css",
        "/feieAni/home.css",
        ...
    ]
})
```
### FeieServer.setLogOutputer()
设置日志处理器
```
server.setLogOutputer(console.log)
```
### FeieServer.setStatic()
更改工作目录
```
server.setStatic("/yourpath/")
```