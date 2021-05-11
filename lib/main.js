"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.downloadToFile = void 0;
const os_1 = require("os");
const fs_1 = require("fs");
const process_1 = require("process");
const node_fetch_1 = __importDefault(require("node-fetch"));
const core_1 = require("@actions/core");
const exec_1 = require("@actions/exec");
const github_1 = require("@actions/github");
const glob = __importStar(require("@actions/glob"));
const utils_1 = require("./utils");
const DOWNLOAD_URL = `https://codeclimate.com/downloads/test-reporter/test-reporter-latest-${os_1.platform()}-amd64`;
const EXECUTABLE = './cc-reporter';
const DEFAULT_COVERAGE_COMMAND = '';
const DEFAULT_WORKING_DIRECTORY = '';
const DEFAULT_CODECLIMATE_DEBUG = 'false';
const DEFAULT_COVERAGE_LOCATIONS = '';
function downloadToFile(url, file, mode = 0o755) {
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield node_fetch_1.default(url, { timeout: 2 * 60 * 1000 }); // Timeout in 2 minutes.
            const writer = fs_1.createWriteStream(file, { mode });
            response.body.pipe(writer);
            writer.on('close', () => {
                return resolve();
            });
        }
        catch (err) {
            return reject(err);
        }
    }));
}
exports.downloadToFile = downloadToFile;
function prepareEnv() {
    var _a, _b, _c, _d;
    const env = process.env;
    if (process.env.GITHUB_SHA !== undefined)
        env.GIT_COMMIT_SHA = process.env.GITHUB_SHA;
    if (process.env.GITHUB_REF !== undefined)
        env.GIT_BRANCH = process.env.GITHUB_REF;
    if (env.GIT_BRANCH)
        env.GIT_BRANCH = env.GIT_BRANCH.replace(/^refs\/heads\//, ''); // Remove 'refs/heads/' prefix (See https://github.com/paambaati/codeclimate-action/issues/42)
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
        env.GIT_BRANCH = process.env.GITHUB_HEAD_REF || env.GIT_BRANCH; // Report correct branch for PRs (See https://github.com/paambaati/codeclimate-action/issues/86)
        env.GIT_COMMIT_SHA = (_b = (_a = github_1.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a['head']) === null || _b === void 0 ? void 0 : _b['sha']; // Report correct SHA for the head branch (See https://github.com/paambaati/codeclimate-action/issues/140)
    }
    if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
        env.GIT_BRANCH = (_c = github_1.context.payload.pull_request) === null || _c === void 0 ? void 0 : _c.head.ref.replace(/^refs\/heads\//, '');
        env.GIT_COMMIT_SHA = (_d = github_1.context.payload.pull_request) === null || _d === void 0 ? void 0 : _d.head.sha;
    }
    return env;
}
function getLocationLines(coverageLocationPatternsParam) {
    return __awaiter(this, void 0, void 0, function* () {
        const coverageLocationPatternsLines = coverageLocationPatternsParam
            .split(/\r?\n/)
            .filter((pat) => pat)
            .map((pat) => pat.trim());
        const patternsAndFormats = coverageLocationPatternsLines.map((line) => {
            const lineParts = line.split(':');
            const format = lineParts.slice(-1)[0];
            const pattern = lineParts.slice(0, -1)[0];
            return { format, pattern };
        });
        const pathsWithFormat = yield Promise.all(patternsAndFormats.map(({ format, pattern }) => __awaiter(this, void 0, void 0, function* () {
            const globber = yield glob.create(pattern);
            const paths = yield globber.glob();
            const pathsWithFormat = paths.map((singlePath) => `${singlePath}:${format}`);
            return pathsWithFormat;
        })));
        const coverageLocationLines = [].concat(...pathsWithFormat);
        return coverageLocationLines;
    });
}
function run(downloadUrl = DOWNLOAD_URL, executable = EXECUTABLE, coverageCommand = DEFAULT_COVERAGE_COMMAND, workingDirectory = DEFAULT_WORKING_DIRECTORY, codeClimateDebug = DEFAULT_CODECLIMATE_DEBUG, coverageLocationsParam = DEFAULT_COVERAGE_LOCATIONS, coveragePrefix) {
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        let lastExitCode = 1;
        if (workingDirectory) {
            core_1.debug(`Changing working directory to ${workingDirectory}`);
            try {
                process_1.chdir(workingDirectory);
                lastExitCode = 0;
                core_1.debug('✅ Changing working directory completed...');
            }
            catch (err) {
                core_1.error(err.message);
                core_1.setFailed('🚨 Changing working directory failed!');
                return reject(err);
            }
        }
        try {
            core_1.debug(`ℹ️ Downloading CC Reporter from ${downloadUrl} ...`);
            yield downloadToFile(downloadUrl, executable);
            core_1.debug('✅ CC Reporter downloaded...');
        }
        catch (err) {
            core_1.error(err.message);
            core_1.setFailed('🚨 CC Reporter download failed!');
            core_1.warning(`Could not download ${downloadUrl}`);
            core_1.warning(`Please check if your platform is supported — see https://docs.codeclimate.com/docs/configuring-test-coverage#section-locations-of-pre-built-binaries`);
            return reject(err);
        }
        const execOpts = {
            env: prepareEnv(),
        };
        try {
            lastExitCode = yield exec_1.exec(executable, ['before-build'], execOpts);
            if (lastExitCode !== 0) {
                throw new Error(`Coverage after-build exited with code ${lastExitCode}`);
            }
            core_1.debug('✅ CC Reporter before-build checkin completed...');
        }
        catch (err) {
            core_1.error(err.message);
            core_1.setFailed('🚨 CC Reporter before-build checkin failed!');
            return reject(err);
        }
        if (coverageCommand) {
            try {
                lastExitCode = yield exec_1.exec(coverageCommand, undefined, execOpts);
                if (lastExitCode !== 0) {
                    throw new Error(`Coverage run exited with code ${lastExitCode}`);
                }
                core_1.debug('✅ Coverage run completed...');
            }
            catch (err) {
                core_1.error(err.message);
                core_1.setFailed('🚨 Coverage run failed!');
                return reject(err);
            }
        }
        else {
            core_1.info(`ℹ️ 'coverageCommand' not set, so skipping building coverage report!`);
        }
        const coverageLocations = yield getLocationLines(coverageLocationsParam);
        if (coverageLocations.length > 0) {
            core_1.debug(`Parsing ${coverageLocations.length} coverage location(s) — ${coverageLocations} (${typeof coverageLocations})`);
            // Run format-coverage on each location.
            const parts = [];
            for (const i in coverageLocations) {
                const [location, type] = coverageLocations[i].split(':');
                if (!type) {
                    const err = new Error(`Invalid formatter type ${type}`);
                    core_1.debug(`⚠️ Could not find coverage formatter type! Found ${coverageLocations[i]} (${typeof coverageLocations[i]})`);
                    core_1.error(err.message);
                    core_1.setFailed('🚨 Coverage formatter type not set! Each coverage location should be of the format <file_path>:<coverage_format>');
                    return reject(err);
                }
                const commands = [
                    'format-coverage',
                    location,
                    '-t',
                    type,
                    '-o',
                    `codeclimate.${i}.json`,
                ];
                if (codeClimateDebug === 'true')
                    commands.push('--debug');
                if (coveragePrefix) {
                    commands.push('--prefix', coveragePrefix);
                }
                parts.push(`codeclimate.${i}.json`);
                try {
                    lastExitCode = yield exec_1.exec(executable, commands, execOpts);
                    if (lastExitCode !== 0) {
                        throw new Error(`Coverage formatter exited with code ${lastExitCode}`);
                    }
                }
                catch (err) {
                    core_1.error(err.message);
                    core_1.setFailed('🚨 CC Reporter coverage formatting failed!');
                    return reject(err);
                }
            }
            // Run sum coverage.
            const sumCommands = [
                'sum-coverage',
                ...parts,
                '-p',
                `${coverageLocations.length}`,
                '-o',
                `coverage.total.json`,
            ];
            if (codeClimateDebug === 'true')
                sumCommands.push('--debug');
            try {
                lastExitCode = yield exec_1.exec(executable, sumCommands, execOpts);
                if (lastExitCode !== 0) {
                    throw new Error(`Coverage sum process exited with code ${lastExitCode}`);
                }
            }
            catch (err) {
                core_1.error(err.message);
                core_1.setFailed('🚨 CC Reporter coverage sum failed!');
                return reject(err);
            }
            // Upload to Code Climate.
            const uploadCommands = ['upload-coverage', '-i', `coverage.total.json`];
            if (codeClimateDebug === 'true')
                uploadCommands.push('--debug');
            try {
                lastExitCode = yield exec_1.exec(executable, uploadCommands, execOpts);
                if (lastExitCode !== 0) {
                    throw new Error(`Coverage upload exited with code ${lastExitCode}`);
                }
                core_1.debug('✅ CC Reporter upload coverage completed!');
                return resolve();
            }
            catch (err) {
                core_1.error(err.message);
                core_1.setFailed('🚨 CC Reporter coverage upload failed!');
                return reject(err);
            }
        }
        try {
            const commands = ['after-build', '--exit-code', lastExitCode.toString()];
            if (codeClimateDebug === 'true')
                commands.push('--debug');
            if (coveragePrefix) {
                commands.push('--prefix', coveragePrefix);
            }
            lastExitCode = yield exec_1.exec(executable, commands, execOpts);
            if (lastExitCode !== 0) {
                throw new Error(`Coverage after-build exited with code ${lastExitCode}`);
            }
            core_1.debug('✅ CC Reporter after-build checkin completed!');
            return resolve();
        }
        catch (err) {
            core_1.error(err.message);
            core_1.setFailed('🚨 CC Reporter after-build checkin failed!');
            return reject(err);
        }
    }));
}
exports.run = run;
if (require.main === module) {
    const coverageCommand = utils_1.getOptionalString('coverageCommand', DEFAULT_COVERAGE_COMMAND);
    const workingDirectory = utils_1.getOptionalString('workingDirectory', DEFAULT_WORKING_DIRECTORY);
    const codeClimateDebug = utils_1.getOptionalString('debug', DEFAULT_CODECLIMATE_DEBUG);
    const coverageLocations = utils_1.getOptionalString('coverageLocations', DEFAULT_COVERAGE_LOCATIONS);
    const coveragePrefix = utils_1.getOptionalString('prefix');
    run(DOWNLOAD_URL, EXECUTABLE, coverageCommand, workingDirectory, codeClimateDebug, coverageLocations, coveragePrefix);
}
