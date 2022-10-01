import FeieServer from "./feiehews.mjs";
let server = new FeieServer({
    https: true,
    key: "H:/server.key",//path to server.key
    cert: "H:/server.crt",//path to server.crt
    staticPath: "H:/Code/sync220801/",//path to work dir
    enableGzip: true,
    httpVersion: 2,
});
server.setServerPush({
    "/feieAni/index.html": [
        "/feieAni/main.js",
        "/feieAni/main.css",
        "/feieAni/home.css",
        "/feieAni/color.css",
        "/feieAni/theme.js",
        "/feieAni/player.css",
        "/feieAni/setting.css",
        "/feieAni/ui.js",
        "/feieAni/getAniList.json",
    ]
})
server.setHttpFallback(80)
server.listen(443, () => {
    console.log("Server started at port 443");
});