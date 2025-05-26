"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetchProblemStatus = async (options, res, query) => {
    var _a;
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Referer: 'https://leetcode.com',
            },
            body: JSON.stringify({
                query: query,
                variables: {
                    username: options.username,
                    limit: 100,
                },
            }),
        });
        const result = await response.json();
        if (result.errors) {
            return res.send(result);
        }
        const recentSubmissions = ((_a = result.data) === null || _a === void 0 ? void 0 : _a.recentAcSubmissionList) || [];
        const solved = recentSubmissions.some((submission) => (submission === null || submission === void 0 ? void 0 : submission.titleSlug) &&
            submission.titleSlug.toLowerCase() === options.problemName.toLowerCase());
        return res.json({ solved });
    }
    catch (err) {
        console.error('Error: ', err);
        return res.send(err);
    }
};
exports.default = fetchProblemStatus;
//# sourceMappingURL=fetchProblemStatus.js.map