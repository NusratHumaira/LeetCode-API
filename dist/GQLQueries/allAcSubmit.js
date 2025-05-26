"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const query = `#graphql
query getACSubmissions ($username: String!) {
    recentAcSubmissionList(username: $username) {
        title
        titleSlug
        timestamp
        statusDisplay
        lang
    }
}`;
exports.default = query;
//# sourceMappingURL=allAcSubmit.js.map