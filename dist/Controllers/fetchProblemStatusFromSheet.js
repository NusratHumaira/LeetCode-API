"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProblemStatusFromSheet = void 0;
const userData_1 = require("../FormatUtils/userData");
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhW0WdhfhQkGR3eLXJog9Z8ActeZmVaYtA1Tdl7b1TxKe_daVVQxYSAcAA6q72IdR-muQveHx6EAq0/pub?output=csv';
const fetchProblemStatusFromSheet = async (req, res, query) => {
    var _a;
    const { problemName } = req.query;
    if (!problemName) {
        return res.status(400).json({ error: 'Missing problemName' });
    }
    try {
        const usernames = await (0, userData_1.fetchUsernamesFromSheet)(SHEET_URL);
        const results = [];
        for (const username of usernames) {
            const response = await fetch('https://leetcode.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Referer: 'https://leetcode.com',
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        username,
                        limit: 50,
                    },
                }),
            });
            const result = await response.json();
            if (result.errors) {
                results.push({ username, solved: false });
                continue;
            }
            const recentSubmissions = ((_a = result.data) === null || _a === void 0 ? void 0 : _a.recentAcSubmissionList) || [];
            const solved = recentSubmissions.some((submission) => (submission === null || submission === void 0 ? void 0 : submission.titleSlug) &&
                submission.titleSlug.toLowerCase() === problemName.toLowerCase());
            results.push({ username, solved });
        }
        return res.json({ results });
    }
    catch (err) {
        console.error('Error: ', err);
        return res.status(500).json({ error: 'Failed to fetch problem statuses' });
    }
};
exports.fetchProblemStatusFromSheet = fetchProblemStatusFromSheet;
exports.default = exports.fetchProblemStatusFromSheet;
//# sourceMappingURL=fetchProblemStatusFromSheet.js.map