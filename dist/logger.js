"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log4js_1 = __importDefault(require("log4js"));
const log4jsLogger = log4js_1.default.getLogger();
class KueasmLogger {
    constructor(kueasm, logLevel) {
        this.debug = (msg) => log4jsLogger.debug(msg, ` (l.${this.kueasm._currentLineNumber})`);
        this.info = (msg) => log4jsLogger.info(msg, ` (l.${this.kueasm._currentLineNumber})`);
        this.warn = (msg) => log4jsLogger.warn(msg, ` (l.${this.kueasm._currentLineNumber})`);
        this.error = (msg) => log4jsLogger.error(msg, ` (l.${this.kueasm._currentLineNumber})`);
        this.kueasm = kueasm;
        log4jsLogger.level = 'debug';
        if (logLevel) {
            log4jsLogger.level = logLevel;
        }
    }
}
exports.default = KueasmLogger;
