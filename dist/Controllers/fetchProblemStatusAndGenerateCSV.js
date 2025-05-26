"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProblemStatusAndGenerateCSV = void 0;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const node_fetch_1 = __importDefault(require("node-fetch"));
const sync_1 = require("csv-parse/sync");
require("dotenv/config");
const SHEET_ID = '1hTW1JnpOIWWSr51bJzekJrc5wEUbh0a0y9ijrDdavjw';
const SHEET1_RANGE = 'Sheet1';
const SHEET2_RANGE = 'Sheet2';
const auth = new google_auth_library_1.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
const fetchProblemStatusAndGenerateCSV = async (req, res, query) => {
    var _a;
    const { problemName } = req.query;
    if (!problemName) {
        return res.status(400).json({ error: 'Missing problemName' });
    }
    try {
        const csvResponse = await (0, node_fetch_1.default)(`https://docs.google.com/spreadsheets/d/e/2PACX-1vQhW0WdhfhQkGR3eLXJog9Z8ActeZmVaYtA1Tdl7b1TxKe_daVVQxYSAcAA6q72IdR-muQveHx6EAq0/pub?output=csv`);
        const csvText = await csvResponse.text();
        const records = (0, sync_1.parse)(csvText, { columns: true, skip_empty_lines: true });
        const usernames = records.map((r) => r.Username || r.username);
        const results = [];
        for (const username of usernames) {
            const leetRes = await (0, node_fetch_1.default)('https://leetcode.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Referer: 'https://leetcode.com',
                },
                body: JSON.stringify({
                    query,
                    variables: { username, limit: 50 },
                }),
            });
            const data = await leetRes.json();
            const recent = ((_a = data.data) === null || _a === void 0 ? void 0 : _a.recentAcSubmissionList) || [];
            const solved = recent.some((s) => { var _a; return ((_a = s === null || s === void 0 ? void 0 : s.titleSlug) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === problemName.toLowerCase(); });
            results.push({ username, solved });
        }
        const updatedRecords = records.map((row) => {
            const userResult = results.find((r) => { var _a; return r.username.toLowerCase() === ((_a = (row.Username || row.username)) === null || _a === void 0 ? void 0 : _a.toLowerCase()); });
            return Object.assign(Object.assign({}, row), { [problemName]: (userResult === null || userResult === void 0 ? void 0 : userResult.solved) ? 'Solved' : 'Not Solved' });
        });
        const headers = Object.keys(updatedRecords[0]);
        const values = [headers, ...updatedRecords.map(Object.values)];
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: SHEET1_RANGE,
            valueInputOption: 'RAW',
            requestBody: { values },
        });
        const sheet2Res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: SHEET2_RANGE,
        });
        const sheet2Rows = sheet2Res.data.values || [];
        const [sheet2Headers, ...sheet2Data] = sheet2Rows;
        const roomIndex = sheet2Headers.indexOf('Room');
        const usernameIndex = sheet2Headers.indexOf('Username');
        const userRoomMap = {};
        sheet2Data.forEach((row) => {
            const username = row[usernameIndex];
            const room = row[roomIndex];
            if (username && room) {
                userRoomMap[username.toLowerCase()] = room;
            }
        });
        const roomProblemStats = {};
        for (const row of updatedRecords) {
            const username = (row.Username || row.username || '').toLowerCase();
            const room = userRoomMap[username];
            if (!room)
                continue;
            Object.entries(row).forEach(([key, value]) => {
                var _a, _b;
                var _c;
                const keyLower = key.toLowerCase();
                if (['username', 'name', 'room'].includes(keyLower))
                    return;
                (_a = roomProblemStats[room]) !== null && _a !== void 0 ? _a : (roomProblemStats[room] = {});
                (_b = (_c = roomProblemStats[room])[key]) !== null && _b !== void 0 ? _b : (_c[key] = { solved: 0, total: 0 });
                roomProblemStats[room][key].total += 1;
                if (value.toLowerCase() === 'solved') {
                    roomProblemStats[room][key].solved += 1;
                }
            });
        }
        const allProblems = new Set();
        Object.values(roomProblemStats).forEach(stats => Object.keys(stats).forEach(p => allProblems.add(p)));
        const problemList = Array.from(allProblems);
        const rows = [];
        for (const room of Object.keys(roomProblemStats)) {
            const row = [];
            for (const problem of problemList) {
                const stats = roomProblemStats[room][problem];
                if (stats) {
                    const ratio = (stats.solved * 100 / stats.total).toFixed(2) + '%';
                    row.push(ratio);
                }
                else {
                    row.push('N/A');
                }
            }
            rows.push(row);
        }
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'Sheet2!E1',
            valueInputOption: 'RAW',
            requestBody: {
                values: [problemList, ...rows],
            },
        });
        return res.json({ success: true, updated: updatedRecords.length });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update sheet' });
    }
};
exports.fetchProblemStatusAndGenerateCSV = fetchProblemStatusAndGenerateCSV;
exports.default = exports.fetchProblemStatusAndGenerateCSV;
//# sourceMappingURL=fetchProblemStatusAndGenerateCSV.js.map