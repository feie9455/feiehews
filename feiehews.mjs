import { readFileSync, createReadStream } from 'fs';
import { access, readFile, stat, writeFile } from 'fs/promises';
import { createGzip } from 'zlib';
import http from 'http';
import https from 'https';
import http2 from 'http2';
import pkg from 'mime';
import { URL } from 'url';
import path from 'path';
const { getType } = pkg;
const { HTTP2_HEADER_PATH } = http2.constants
/**
 * 创建一个HTTP/HTTPS服务器
 * @class
 */
class FeieServer {

    /**
     * 设置使用gzip的文件类型
     */
    gzipTypes = [
        'html', 'css', 'js', 'json', 'svg', 'xml', 'txt', 'md', 'wasm', 'mjs', 'jsm', 'ts', 'tsx', 'jsx', 'map', 'ttf', 'otf', 'eot', 'woff', 'woff2',
    ]

    /**
     * 设置额外api
     * @type {Array.<{path:String,callback:Function,method:String}>}
     */
    apis = []


    /**
     * 设置额外响应头
     * @type {Object}
     */
    aditionalHeader = {}

    /** 服务端推送
     * @type {Object} 应用服务端推送的path:要推送的相对路径[]
     */
    serverPush = {}

    /** 允许http缓存的文件类型
     * @type {Array.<String>}
     */
    enableCache = ['mp3', 'mp4', 'webm', 'ogg', 'wav', 'flac', 'aac', 'm4a', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'webp', 'bmp', 'avif']

    /**
     * 生成一个feieServer实例
     * @param {Object} options 
     * @param {?Number} options.httpVersion 设置http版本，1或2
     * @param {?Boolean} options.https 是否使用https
     * @param {?Boolean} options.enableGzip 是否启用gzip
     * @param {?String} options.key https密钥
     * @param {?String} options.cert https证书
     * @param {?String} options.staticPath 静态文件路径
     * @param {?Function} options.logOutputer 日志输出器
     * @param {?Boolean} options.enableServerPush 是否启用服务端推送
     * @param {?Boolean} options.enableHttpCache 是否启用http缓存
     * @returns {FeieServer}
     * @constructor
     */
    constructor(options) {
        this.enableHttpCache = options.enableHttpCache ?? true;
        this.enableServerPush = options.enableServerPush ?? true;
        this.enableGzip = options.enableGzip ?? true;
        this.logOutputer = options.logOutputer ?? console.log;
        options.httpVersion = options.httpVersion ?? 2;
        options.https = options.https ?? true;

        this.createOptions = options;
        this.staticPath = options.staticPath;
        if (options.httpVersion == 2) {
            this.server = http2.createSecureServer(
                {
                    key: readFileSync(options.key),
                    cert: readFileSync(options.cert),
                    allowHTTP1: true
                }
            );
            this
        } else {
            if (options.https) {
                this.server = https.createServer(
                    {
                        key: readFileSync(options.key),
                        cert: readFileSync(options.cert),
                    },
                    this._handleRequest
                );
            } else {
                this.server = http.createServer(
                    this._handleRequest
                );
            }
        }

        if (options.enableGzip) {
            this.enableGzip = true;
        }

        this.server.on('request', (req, res) => {
            this._handleRequest(req, res);
        });
    }

    /**
     * 开始监听
     * @param {Number} port 
     * @param {Function} callback 
     * @returns {FeieServer}
     */
    listen(port, callback) {
        this.server.listen(port, callback);
        this.server.on('error', (err) => {
            if (err.code == 'EADDRINUSE') {
                this.logOutputer(`端口${port}被占用`);
            } else {
                this.logOutputer(err);
            }
        });

        return this;
    }


    /**
     * 设置静态路径
     * @param {String} path 
     */
    setStatic(path) {
        this.staticPath = path;
    }


    /**
     * 当用户使用http时，重定向到https
     * @param {Number} port 
     * @returns {FeieServer}
     */
    setHttpFallback(port) {
        if (this.createOptions.https || this.createOptions.httpVersion == 2) {
            let httpFallbackServer = http.createServer((req, res) => {
                res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
                this.logOutputer(`用户使用http访问，重定向到https://${req.headers['host'] + req.url}`);
                res.end();
            });
            httpFallbackServer.listen(port);
            return this;
        } else {
            throw new Error('httpFallback can only be used in https mode');
        }
    }

    /**
     * 处理请求
     * @param {*} req 
     * @param {*} res 
     */
    _handleRequest = (req, res) => {
        let url = new URL(req.url, `https://${req.headers.host}`)
        let path = url.pathname;
        let method = req.method;
        let headers = req.headers;
        this.logOutputer(`[${new Date().toLocaleString()}] ${method} ${path} ${headers['user-agent']}`);
        let body = '';
        let allowPost = false;
        let responseCallback
        let useApi = false;
        this.apis.forEach(api => {
            if (path.includes(api.path)) {
                useApi = true;
                if (api.method == 'POST') {
                    allowPost = true;
                    responseCallback = api.callback;
                } else {
                    api.callback(req, res);
                }
            }
        })
        if (allowPost) {
            req.on('data', (chunk) => {
                if (!chunk) return;
                body += chunk;
            }
            );
            req.on('end', (chuck) => {
                if (chuck) body += chuck;
                responseCallback(req, res, body);
            });
        }
        if (!useApi && this.staticPath) {
            this._handleStatic(req, res);
        }
    }


    /**
     * 处理静态文件请求
     * @param {*} req 
     * @param {*} res 
     */
    _handleStatic = (req, res) => {
        let url = new URL(req.url, `https://${req.headers.host}`)
        let path = url.pathname;
        let filePath = decodeURI(this.staticPath + path);
        let ext = path.split('.').pop();
        let contentType = getType(ext);
        if (contentType == null) {
            contentType = 'text/plain';
        }
        stat(filePath).then((stats) => {
            if (stats.isDirectory()) {
                if (path[path.length - 1] != '/') {
                    res.writeHead(301, { "Location": path + '/' });
                    res.end();
                    return;
                }
                stat(filePath + '/index.html').then((stats) => {
                    if (stats.isFile()) {
                        this._sendFile(res, filePath + '/index.html', 'text/html');
                    } else {
                        this._setHeader({
                            res,
                            contentType: 'text/html',
                            statusCode: 404
                        });
                    }
                }).catch((err) => {
                    this._setHeader({
                        res,
                        contentType: 'text/html',
                        statusCode: 404
                    });
                    res.end();
                })
            } else if (stats.isFile()) {
                this._sendFile(res, filePath, contentType);
            }
        }).catch((err) => {
            this._setHeader({
                res,
                contentType: 'text/html',
                statusCode: 404
            });
            res.end();
        })
    }

    /**
     * 设置响应头
     * @param {Object} options
     * @param {*} options.res 
     * @param {String} [options.contentType = 'text/html']
     * @param {Number} [options.statusCode = 200]
     * @param {?String} options.encoding 
     * @param {Object} [options.headers = {}]
     */
    _setHeader({ res, contentType = "text/html", statusCode = 200, encoding, headers = {} }) {
        if (res.isSent) return;
        res.isSent = true;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Server', 'feieServer');
        res.setHeader('X-Powered-By', 'feieServer');
        if (encoding) res.setHeader('Content-Encoding', encoding);
        for (let key in headers) {
            if (!this.enableHttpCache && key == 'Cache-Control') continue;
            res.setHeader(key, headers[key]);
        }
        for (let key in this.aditionalHeader) {
            if (!this.enableHttpCache && key == 'Cache-Control') continue;   
            res.setHeader(key, this.aditionalHeader[key]);
        }

        res.writeHead(statusCode);
    }

    /**
     * 设置额外的响应头
     * @param {(Object[]|Object)} headers 
     */
    setExtraHeader(headers) {
        if (typeof headers == 'object') {
            this.aditionalHeader.push(headers);
        }
        else if (headers instanceof Array) {
            headers.forEach(header => {
                this.aditionalHeader.push(header);
            })
        }
        else {
            throw new Error('Headers must be an object or an array.');
        }
    }

    _sendFile = (res, filePath, contentType, isServerPush = false, serverPushPath) => {
        let extName = filePath.split('.').pop();
        let stream
        if (this.enableGzip && this.gzipTypes.includes(extName)) {
            this._setHeader({
                res,
                contentType: contentType + ";charset=utf-8",
                statusCode: 200,
                encoding: 'gzip'
            });
            stream = createReadStream(filePath).pipe(createGzip());
        } else {
            if (this.enableCache.includes(extName)) {
                this._setHeader({
                    res,
                    contentType,
                    statusCode: 200,
                    headers: {
                        'Cache-Control': 'max-age=31536000'
                    }
                });
            } else {
                this._setHeader({
                    res,
                    contentType: contentType + ";charset=utf-8",
                    statusCode: 200,
                });
            }
            stream = createReadStream(filePath);
        }

        if (!isServerPush ) {
            console.log(res.stream.pushAllowed);
            stream.pipe(res.stream);
            if (res.stream.pushAllowed&&this.enableServerPush) {
                Object.keys(this.serverPush).forEach(key => {
                    filePath = removeDoubleSlash(filePath);
                    if (filePath.includes(key)) {
                        let pushPath = this.serverPush[key];
                        this.logOutputer(`Server Push: ${pushPath}`);
                        pushPath.forEach(path => {
                            console.log('Server Push: ' + path);
                            this._sendFile(res, this.staticPath + path, getType(path.split('.').pop()), true, path);
                        })
                    }
                })
            }
        }
        else {
            try {
                res.stream.pushStream({ [HTTP2_HEADER_PATH]: serverPushPath }, (err, pushStream) => {
                    if (err) console.log(err);;
                    pushStream.respond({
                        ':status': 200,
                        'content-type': contentType + ";charset=utf-8",
                        'content-encoding': 'gzip'
                    });
                    stream.pipe(pushStream);
                });

            } catch (error) {
                this.logOutputer(error);
            }

        }
    }

    /**
     * 添加新的服务端推送 
     * @param {Object} push 应用服务端推送的path:要推送的相对路径[]
     */
    setServerPush = (push) => {
        for (const key in push) {
            if (Object.hasOwnProperty.call(push, key)) {
                const element = push[key];
                this.serverPush[key] = element;
                this.logOutputer(`Server Push: ${key} -> ${element}`);
            }
        }
    }

    /**
     * 设置日志输出器
     * @param {Function} outputer 
     */
    setLogOutputer = (outputer) => {
        this.logOutputer = outputer;
    }
}

function removeDoubleSlash(path) {
    return path.replace(/\/\//g, '/');
}

export default FeieServer;